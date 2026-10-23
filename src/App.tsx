import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  cancelNativeImportJob,
  completeNativeImportBatch,
  createProjectDraft,
  defaultAppConfig,
  createNativeImportJob,
  hydrateAppConfig,
  hydrateAppState,
  loadAppConfig,
  loadAppState,
  loadNativeProjectIndex,
  listNativeImportJobs,
  listNativeDirectoryEntries,
  resetAllNativeProjectIndexes,
  resetNativeProjectIndex,
  readNativeFileBytes,
  saveNativeProjectIndex,
  updateNativeImportJob,
  resetPersistentAppData,
  saveAppConfig,
  saveAppState,
} from "./lib/storage";
import { open as openNativeDialog } from "@tauri-apps/plugin-dialog";
import { detectDocumentKind } from "./lib/projectHelpers";
import { answerFromSources } from "./lib/retrieval";
import { prepareImportedDocument, readImportedText } from "./lib/importPipeline";
import { ImportActions } from "./features/import/ImportActions";
import { ProjectSidebar } from "./features/projects/ProjectSidebar";
import { ChatPanel } from "./features/chat/ChatPanel";
import { SourcePanel } from "./features/documents/SourcePanel";
import { SettingsPanel } from "./features/settings/SettingsPanel";
import { StudyPanel } from "./features/study/StudyPanel";
import {
  downloadTextFile,
  formatProjectBackupJson,
  formatProjectStudyMarkdown,
} from "./lib/exporting";
import { answerQuestionWithLocalModel } from "./lib/llm";
import {
  createLocalModelStatusEntry,
  inspectLocalModel,
  prepareLocalModel,
} from "./lib/modelRuntime";
import {
  createSavedAnswer,
  createStudyBookmark,
  createStudyHighlight,
  createStudyNote,
} from "./lib/study";
import {
  buildFolderWatchSignature,
  filterImportableFolderEntries,
  isSupportedImportFileName,
} from "./lib/folderSync";
import type {
  AppConfig,
  AppState,
  ChatMessage,
  LocalModelStatusRecord,
  NativeDirectoryEntryRecord,
  ImportJobRecord,
  NativeImportFileInput,
  NativeImportedDocumentRecord,
  ProjectDocument,
  ChatCitation,
  ProjectRecord,
  StudyNote,
} from "./lib/types";

export default function App() {
  const [state, setState] = useState<AppState>(() => loadAppState());
  const [config, setConfig] = useState<AppConfig>(() => loadAppConfig());
  const [newProjectName, setNewProjectName] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [question, setQuestion] = useState(
    "What are the key arguments for using local embeddings over cloud search in privacy-sensitive research workflows?",
  );
  const [isImporting, setIsImporting] = useState(false);
  const [isGeneratingAnswer, setIsGeneratingAnswer] = useState(false);
  const [localModelStatus, setLocalModelStatus] = useState("Checking local AI...");
  const [localModelProgress, setLocalModelProgress] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importJobs, setImportJobs] = useState<ImportJobRecord[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const hasHydratedRef = useRef(false);
  const preparedModelRef = useRef<string | null>(null);
  const folderWatcherRef = useRef<number | null>(null);

  function applyLocalModelStatus(status: LocalModelStatusRecord) {
    setLocalModelStatus(status.message);
    setLocalModelProgress(
      typeof status.progress === "number" && Number.isFinite(status.progress)
        ? Math.max(0, Math.min(100, status.progress))
        : null,
    );
    setState((current) => {
      const lastMessage = current.modelStatusLog?.at(-1)?.message;
      if (lastMessage === status.message) {
        return current;
      }

      return {
        ...current,
        modelStatusLog: [
          ...(current.modelStatusLog ?? []),
          createLocalModelStatusEntry(status.message),
        ],
      };
    });

    if (status.modelReady) {
      preparedModelRef.current = status.modelName;
    }
  }

  useEffect(() => {
    if (!hasHydratedRef.current) {
      return;
    }

    saveAppState(state);
  }, [state]);

  useEffect(() => {
    if (!hasHydratedRef.current) {
      return;
    }

    saveAppConfig(config);
  }, [config]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const [nativeState, nativeConfig, nativeJobs] = await Promise.all([
        hydrateAppState(),
        hydrateAppConfig(),
        listNativeImportJobs(),
      ]);

      if (cancelled) {
        return;
      }

      hasHydratedRef.current = true;
      setIsHydrated(true);

      if (nativeState) {
        setState(nativeState);
      }

      if (nativeConfig) {
        setConfig(nativeConfig);
      }

      if (nativeJobs) {
        setImportJobs(nativeJobs);
      }

      void listen<ImportJobRecord>("import-job-updated", (event) => {
        setImportJobs((current) => {
          const exists = current.some((job) => job.id === event.payload.id);
          if (exists) {
            return current.map((job) =>
              job.id === event.payload.id ? event.payload : job,
            );
          }
          return [event.payload, ...current];
        });
      });

      const hydratedState = nativeState ?? loadAppState();
      const indexedProjects = await Promise.all(
        hydratedState.projects.map(async (project) => {
          const projectIndex = await loadNativeProjectIndex(project.id);
          if (!projectIndex) {
            return project;
          }

          return {
            ...project,
            documents: projectIndex,
            indexingState: projectIndex.length > 0 ? "ready" : project.indexingState,
          };
        }),
      );

      if (indexedProjects.length > 0) {
        setState((current) => ({
          ...current,
          projects: indexedProjects,
          activeProjectId:
            hydratedState.activeProjectId ??
            indexedProjects[0]?.id ??
            current.activeProjectId,
          modelStatusLog: hydratedState.modelStatusLog ?? current.modelStatusLog,
        }));
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  const activeProject = useMemo(
    () =>
      state.projects.find((project) => project.id === state.activeProjectId) ??
      state.projects[0] ??
      null,
    [state.activeProjectId, state.projects],
  );

  const visibleProjects = useMemo(() => {
    const trimmed = projectFilter.trim().toLowerCase();
    if (!trimmed) {
      return state.projects;
    }

    return state.projects.filter((project) =>
      [project.name, project.description, project.documents.length.toString()]
        .join(" ")
        .toLowerCase()
        .includes(trimmed),
    );
  }, [projectFilter, state.projects]);

  const visibleDocuments = useMemo(() => {
    if (!activeProject) {
      return [];
    }

    const trimmed = sourceFilter.trim().toLowerCase();
    if (!trimmed) {
      return activeProject.documents;
    }

    return activeProject.documents.filter((document) =>
      [document.name, document.kind, document.note ?? "", document.sourceLabel]
        .join(" ")
        .toLowerCase()
        .includes(trimmed),
    );
  }, [activeProject, sourceFilter]);

  const activeImportJob = useMemo(() => {
    const sortedJobs = [...importJobs].sort(
      (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
    );

    return sortedJobs.find((job) => job.stage !== "ready") ?? null;
  }, [importJobs]);

  const activeImportProgress =
    activeImportJob && Number.isFinite(activeImportJob.progress)
      ? Math.max(0, Math.min(100, activeImportJob.progress))
      : null;

  function basename(path: string) {
    return path.split(/[/\\]/).filter(Boolean).at(-1) ?? path;
  }

  async function collectNativeFolderFiles(folderPath: string): Promise<NativeImportFileInput[]> {
    const files: NativeImportFileInput[] = [];
    const stack = [folderPath];

    while (stack.length > 0) {
      const currentPath = stack.pop();
      if (!currentPath) {
        continue;
      }

      const entries = await listNativeDirectoryEntries(currentPath);
      if (!entries) {
        continue;
      }

      for (const entry of entries) {
        if (entry.isDirectory) {
          stack.push(entry.path);
          continue;
        }

        if (!isSupportedImportFileName(entry.name)) {
          continue;
        }

        const bytes = await readNativeFileBytes(entry.path);
        if (!bytes) {
          continue;
        }

        files.push({
          name: entry.name,
          bytes,
        });
      }
    }

    return files;
  }

  async function fingerprintNativeFolder(folderPath: string) {
    const entries: NativeDirectoryEntryRecord[] = [];
    const stack = [folderPath];

    while (stack.length > 0) {
      const currentPath = stack.pop();
      if (!currentPath) {
        continue;
      }

      const currentEntries = await listNativeDirectoryEntries(currentPath);
      if (!currentEntries) {
        continue;
      }

      for (const entry of currentEntries) {
        if (entry.isDirectory) {
          stack.push(entry.path);
          continue;
        }

        entries.push(entry);
      }
    }

    return buildFolderWatchSignature(filterImportableFolderEntries(entries));
  }

  useEffect(() => {
    const hasValidActiveProject =
      state.activeProjectId !== null &&
      state.projects.some((project) => project.id === state.activeProjectId);

    if (!hasValidActiveProject && state.projects.length > 0) {
      setState((current) => ({
        ...current,
        activeProjectId: current.projects[0]?.id ?? null,
      }));
    }
  }, [state.activeProjectId, state.projects]);

  useEffect(() => {
    if (state.projects.length === 0 && config.showWelcome) {
      setSettingsOpen(true);
    }
  }, [config.showWelcome, state.projects.length]);

  useEffect(() => {
    if (!isHydrated) {
      return undefined;
    }

    if (config.modelProvider !== "ollama" && config.modelProvider !== "local-native") {
      setLocalModelStatus(
        "Local AI is disabled in settings, so the app will use source summaries only.",
      );
      setLocalModelProgress(null);
      return undefined;
    }

    let cancelled = false;
    let unlisten: (() => void) | undefined;
    let pollHandle: number | undefined;

    async function syncLocalModelStatus() {
      const status = await inspectLocalModel(config.modelName);
      if (cancelled || !status) {
        return;
      }

      applyLocalModelStatus(status);

      if (status.modelReady || status.state === "unavailable") {
        if (pollHandle !== undefined) {
          window.clearInterval(pollHandle);
          pollHandle = undefined;
        }
      }
    }

    void prepareLocalModel(config.modelName);
    void syncLocalModelStatus();
    pollHandle = window.setInterval(() => {
      void syncLocalModelStatus();
    }, 2000);

    void listen<LocalModelStatusRecord>("local-model-status", (event) => {
      if (cancelled || event.payload.modelName !== config.modelName) {
        return;
      }

      applyLocalModelStatus(event.payload);
    }).then((cleanup) => {
      unlisten = cleanup;
    });

    return () => {
      cancelled = true;
      if (pollHandle !== undefined) {
        window.clearInterval(pollHandle);
      }
      unlisten?.();
    };
  }, [config.modelName, config.modelProvider, isHydrated]);

  useEffect(() => {
    if (!isHydrated) {
      return undefined;
    }

    if (folderWatcherRef.current !== null) {
      window.clearInterval(folderWatcherRef.current);
    }

    folderWatcherRef.current = window.setInterval(() => {
      void refreshWatchedFolders();
    }, 120000);

    return () => {
      if (folderWatcherRef.current !== null) {
        window.clearInterval(folderWatcherRef.current);
        folderWatcherRef.current = null;
      }
    };
  }, [isHydrated, state.projects]);

  function createProject() {
    const name = newProjectName.trim();
    if (!name) {
      return;
    }

    const project = createProjectDraft(name);
    setState((current) => ({
      ...current,
      projects: [project, ...current.projects],
      activeProjectId: project.id,
    }));
    setNewProjectName("");
  }

  function openProject(projectId: string) {
    setState((current) => ({
      ...current,
      activeProjectId: projectId,
    }));
  }

  function renameProject(projectId: string, nextName: string) {
    const trimmed = nextName.trim();
    if (!trimmed) {
      return;
    }

    setState((current) => ({
      ...current,
      projects: current.projects.map((project) =>
        project.id === projectId
          ? {
              ...project,
              name: trimmed,
              updatedAt: new Date().toISOString(),
            }
          : project,
      ),
    }));
  }

  function deleteProject(projectId: string) {
    const project = state.projects.find((item) => item.id === projectId);
    if (!project) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${project.name}"? This removes the project from the app.`,
    );
    if (!confirmed) {
      return;
    }

    setState((current) => {
      const remaining = current.projects.filter((project) => project.id !== projectId);
      const nextActiveProjectId =
        current.activeProjectId === projectId
          ? remaining[0]?.id ?? null
          : current.activeProjectId;

      return {
        ...current,
        projects: remaining,
        activeProjectId: nextActiveProjectId,
      };
    });

    void resetNativeProjectIndex(projectId);
  }

  function updateActiveProject(
    projectId: string,
    updater: (project: ProjectRecord) => ProjectRecord,
  ) {
    setState((current) => ({
      ...current,
      projects: current.projects.map((project) =>
        project.id === projectId
          ? {
              ...updater(project),
              updatedAt: new Date().toISOString(),
            }
          : project,
      ),
    }));
  }

  function saveAnswer(message: ChatMessage) {
    if (!activeProject) {
      return;
    }

    const assistantIndex = activeProject.chat.findIndex((item) => item.id === message.id);
    const previousUserMessage =
      assistantIndex > 0 ? activeProject.chat[assistantIndex - 1] : null;

    updateActiveProject(activeProject.id, (project) => ({
      ...project,
      savedAnswers: [
        {
          ...createSavedAnswer(
            previousUserMessage?.content ?? question,
            message.content,
            message.citations ?? [],
          ),
          projectId: project.id,
        },
        ...project.savedAnswers,
      ],
    }));
  }

  function createNoteFromAnswer(message: ChatMessage) {
    if (!activeProject) {
      return;
    }

    const assistantIndex = activeProject.chat.findIndex((item) => item.id === message.id);
    const previousUserMessage =
      assistantIndex > 0 ? activeProject.chat[assistantIndex - 1] : null;
    const firstCitation = message.citations?.[0];

    updateActiveProject(activeProject.id, (project) => ({
      ...project,
      notes: [
        {
          ...createStudyNote(
            previousUserMessage?.content ?? "Study note",
            message.content,
            firstCitation?.documentId,
            firstCitation?.chunkId,
          ),
          projectId: project.id,
        },
        ...project.notes,
      ],
    }));
  }

  function bookmarkCitation(citation: ChatCitation) {
    if (!activeProject) {
      return;
    }

    updateActiveProject(activeProject.id, (project) => ({
      ...project,
      bookmarks: [
        {
          ...createStudyBookmark(citation),
          projectId: project.id,
        },
        ...project.bookmarks,
      ],
    }));
  }

  function highlightCitation(citation: ChatCitation) {
    if (!activeProject) {
      return;
    }

    updateActiveProject(activeProject.id, (project) => ({
      ...project,
      highlights: [
        {
          ...createStudyHighlight(citation),
          projectId: project.id,
        },
        ...project.highlights,
      ],
    }));
  }

  function deleteStudyNote(noteId: string) {
    if (!activeProject) {
      return;
    }

    updateActiveProject(activeProject.id, (project) => ({
      ...project,
      notes: project.notes.filter((note) => note.id !== noteId),
    }));
  }

  function updateStudyNote(noteId: string, patch: Partial<Pick<StudyNote, "title" | "body">>) {
    if (!activeProject) {
      return;
    }

    updateActiveProject(activeProject.id, (project) => ({
      ...project,
      notes: project.notes.map((note) =>
        note.id === noteId
          ? {
              ...note,
              ...patch,
              updatedAt: new Date().toISOString(),
            }
          : note,
      ),
    }));
  }

  function deleteStudyBookmark(bookmarkId: string) {
    if (!activeProject) {
      return;
    }

    updateActiveProject(activeProject.id, (project) => ({
      ...project,
      bookmarks: project.bookmarks.filter((bookmark) => bookmark.id !== bookmarkId),
    }));
  }

  function deleteStudyHighlight(highlightId: string) {
    if (!activeProject) {
      return;
    }

    updateActiveProject(activeProject.id, (project) => ({
      ...project,
      highlights: project.highlights.filter((highlight) => highlight.id !== highlightId),
    }));
  }

  function deleteSavedAnswer(answerId: string) {
    if (!activeProject) {
      return;
    }

    updateActiveProject(activeProject.id, (project) => ({
      ...project,
      savedAnswers: project.savedAnswers.filter((answer) => answer.id !== answerId),
    }));
  }

  function exportStudyArtifacts() {
    if (!activeProject) {
      return;
    }

    const markdown = formatProjectStudyMarkdown(activeProject);
    downloadTextFile(
      `${activeProject.name.replace(/\s+/g, "_").toLowerCase()}-study.md`,
      markdown,
      "text/markdown;charset=utf-8",
    );
  }

  function backupProject() {
    if (!activeProject) {
      return;
    }

    const backup = formatProjectBackupJson(activeProject);
    downloadTextFile(
      `${activeProject.name.replace(/\s+/g, "_").toLowerCase()}-backup.json`,
      backup,
      "application/json;charset=utf-8",
    );
  }

  async function importNativeFiles(
    projectId: string,
    nativeFiles: NativeImportFileInput[],
    sourceKind: "file" | "folder",
    sourcePath: string,
    sourceLabel: string,
    options?: { replaceExistingSourceId?: string; watchSignature?: string },
  ) {
    if (nativeFiles.length === 0) {
      return;
    }

    setIsImporting(true);
    let importJobId: string | null = null;

    try {
      const now = new Date().toISOString();
      const importJob =
        (await createNativeImportJob({
          projectId,
          sourceLabel,
          sourcePath,
          sourceKind,
        })) ?? null;

      if (importJob) {
        importJobId = importJob.id;
        await updateNativeImportJob(importJob.id, {
          stage: "extracting",
          progress: 15,
          message: "Reading source files",
        });
      }

      setState((current) => ({
        ...current,
        projects: current.projects.map((project) =>
          project.id === projectId
            ? {
                ...project,
                updatedAt: now,
                indexingState: "indexing",
              }
            : project,
        ),
      }));

      const nativeImportedDocuments = await completeNativeImportBatch({
        jobId: importJob?.id ?? crypto.randomUUID(),
        projectId,
        sourceLabel,
        sourcePath,
        sourceKind,
        chunkSize: config.chunkSize,
        files: nativeFiles,
      });

      let importedDocuments: ProjectDocument[] = [];
      if (nativeImportedDocuments) {
        importedDocuments = nativeImportedDocuments.map(
          (document): ProjectDocument => ({
            ...document,
            kind: detectDocumentKind(document.name),
            chunks: document.chunks?.map((chunk) => ({
              ...chunk,
              sourceLabel: chunk.sourceLabel ?? document.sourceLabel,
            })),
          }),
        );
      }

      const existingProject = state.projects.find((project) => project.id === projectId);
      const nextDocuments = [
        ...importedDocuments,
        ...(options?.replaceExistingSourceId
          ? existingProject?.documents.filter(
              (document) => document.sourcePath !== sourcePath,
            ) ?? []
          : existingProject?.documents ?? []),
      ];

      setState((current) => ({
        ...current,
        projects: current.projects.map((project) =>
          project.id === projectId
            ? {
                ...project,
                updatedAt: new Date().toISOString(),
                indexingState: "ready",
                sources: [
                  ...(options?.replaceExistingSourceId
                    ? project.sources.filter((source) => source.id !== options.replaceExistingSourceId)
                    : project.sources),
                  {
                    id: options?.replaceExistingSourceId ?? crypto.randomUUID(),
                    kind: sourceKind,
                    label: sourceLabel,
                    pathLabel: sourcePath,
                    watchSignature: options?.watchSignature,
                    addedAt: new Date().toISOString(),
                  },
                ],
                documents: nextDocuments,
              }
            : project,
        ),
      }));

      if (importJob) {
        await updateNativeImportJob(importJob.id, {
          stage: "ready",
          progress: 100,
          message: "Import complete",
        });
      }

      await saveNativeProjectIndex(projectId, nextDocuments);

      const jobs = await listNativeImportJobs();
      if (jobs) {
        setImportJobs(jobs);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import failed";
      setState((current) => ({
        ...current,
        projects: current.projects.map((project) =>
          project.id === projectId
            ? {
                ...project,
                updatedAt: new Date().toISOString(),
                indexingState: "idle",
              }
            : project,
        ),
      }));
      if (importJobId) {
        await updateNativeImportJob(importJobId, {
          stage: "error",
          progress: 100,
          message,
        }).catch(() => undefined);
      }
      const jobs = await listNativeImportJobs();
      if (jobs) {
        setImportJobs(jobs);
      }
    } finally {
      setIsImporting(false);
    }
  }

  async function addDocuments(
    projectId: string,
    files: FileList | File[],
    sourceKind: "file" | "folder",
  ) {
    const items = Array.from(files);
    if (items.length === 0) {
      return;
    }

    const now = new Date().toISOString();
    const sourceLabel =
      sourceKind === "folder"
        ? items[0]?.webkitRelativePath.split("/")[0] || items[0]?.name || "Folder"
        : items[0]?.name || "Selected file";
    const sourcePath =
      sourceKind === "folder"
        ? items[0]?.webkitRelativePath.split("/").slice(0, 1).join("/") || sourceLabel
        : items[0]?.name || sourceLabel;

    const nativeFiles: NativeImportFileInput[] = await Promise.all(
      items.map(async (file) => ({
        name: file.name,
        bytes: Array.from(new Uint8Array(await file.arrayBuffer())),
      })),
    );

    await importNativeFiles(projectId, nativeFiles, sourceKind, sourcePath, sourceLabel);

    setState((current) => ({
      ...current,
      projects: current.projects.map((project) =>
        project.id === projectId
          ? {
              ...project,
              updatedAt: now,
            }
          : project,
      ),
    }));
  }

  function isLikelyFilesystemPath(value: string) {
    return value.includes("/") || value.includes("\\") || /^[a-zA-Z]:[\\/]/.test(value);
  }

  async function importNativeFolderPath(
    projectId: string,
    folderPath: string,
    replaceExistingSourceId?: string,
  ) {
    const files = await collectNativeFolderFiles(folderPath);
    if (files.length === 0) {
      return;
    }

    const signature = await fingerprintNativeFolder(folderPath);
    const sourceLabel = basename(folderPath);
    await importNativeFiles(projectId, files, "folder", folderPath, sourceLabel, {
      replaceExistingSourceId,
      watchSignature: signature,
    });
  }

  async function pickNativeFolderPath() {
    try {
      const selected = await openNativeDialog({
        directory: true,
        multiple: false,
        title: "Choose a folder of study files",
      });

      return typeof selected === "string" ? selected : null;
    } catch {
      return null;
    }
  }

  async function refreshWatchedFolders() {
    for (const project of state.projects) {
      for (const source of project.sources.filter(
        (candidate) => candidate.kind === "folder" && isLikelyFilesystemPath(candidate.pathLabel),
      )) {
        const nextSignature = await fingerprintNativeFolder(source.pathLabel).catch(() => null);
        if (!nextSignature || nextSignature === source.watchSignature) {
          continue;
        }

        await importNativeFolderPath(project.id, source.pathLabel, source.id);
      }
    }
  }

  function importFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || !activeProject) {
      return;
    }

    void addDocuments(activeProject.id, files, "file");
    event.target.value = "";
  }

  function importFolder(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || !activeProject) {
      return;
    }

    void addDocuments(activeProject.id, files, "folder");
    event.target.value = "";
  }

  async function generateAnswer() {
    if (!activeProject) {
      return;
    }

    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      return;
    }

    const now = new Date().toISOString();
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmedQuestion,
      createdAt: now,
    };

    setState((current) => ({
      ...current,
      projects: current.projects.map((project) =>
        project.id === activeProject.id
          ? {
              ...project,
              updatedAt: new Date().toISOString(),
              chat: [...project.chat, userMessage],
            }
          : project,
      ),
    }));

    setIsGeneratingAnswer(true);

    try {
      const assistantResponse = await answerQuestionWithLocalModel(
        trimmedQuestion,
        activeProject.documents,
        config,
      );
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: assistantResponse.content,
        createdAt: new Date().toISOString(),
        citations: assistantResponse.citations,
      };

      setState((current) => ({
        ...current,
        projects: current.projects.map((project) =>
          project.id === activeProject.id
            ? {
                ...project,
                updatedAt: new Date().toISOString(),
                chat: [...project.chat, assistantMessage],
              }
            : project,
        ),
      }));
    } catch {
      const fallback = answerFromSources(trimmedQuestion, activeProject.documents);
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: fallback.content,
        createdAt: new Date().toISOString(),
        citations: fallback.citations,
      };

      setState((current) => ({
        ...current,
        projects: current.projects.map((project) =>
          project.id === activeProject.id
            ? {
                ...project,
                updatedAt: new Date().toISOString(),
                chat: [...project.chat, assistantMessage],
              }
            : project,
        ),
      }));
    } finally {
      setIsGeneratingAnswer(false);
    }
  }

  function updateConfig(patch: Partial<AppConfig>) {
    setConfig((current) => ({
      ...current,
      ...patch,
    }));
  }

  function dismissWelcome() {
    setConfig((current) => ({
      ...current,
      showWelcome: false,
    }));
    setSettingsOpen(false);
  }

  function resetAllLocalData() {
    const confirmed = window.confirm(
      "Clear all local projects, imported sources, chat history, and settings?",
    );
    if (!confirmed) {
      return;
    }

    void resetPersistentAppData();

    setState({
      projects: [],
      activeProjectId: null,
      version: 1,
      modelStatusLog: [],
    });
    setConfig(defaultAppConfig);
    setNewProjectName("");
    setProjectFilter("");
    setSourceFilter("");
    setImportJobs([]);
    setQuestion(
      "What are the key arguments for using local embeddings over cloud search in privacy-sensitive research workflows?",
    );
    setSettingsOpen(true);
    void resetAllNativeProjectIndexes();
  }

  if (!isHydrated) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <div className="loading-spinner" />
          <h2>AI eBook Tool</h2>
          <p>Loading your workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      <ProjectSidebar
        projects={state.projects}
        visibleProjects={visibleProjects}
        activeProjectId={activeProject?.id ?? null}
        settingsOpen={settingsOpen}
        newProjectName={newProjectName}
        projectFilter={projectFilter}
        onToggleSettings={() => setSettingsOpen((value) => !value)}
        onProjectFilterChange={setProjectFilter}
        onNewProjectNameChange={setNewProjectName}
        onCreateProject={createProject}
        onOpenProject={openProject}
      />

      <main className="main">
        <section className="hero">
          <div className="hero-header">
            <div>
              <p className="eyebrow">AI eBook Tool</p>
              <h2>Ask questions about your books and PDFs</h2>
              <p className="muted">Import documents, then ask questions with source citations.</p>
            </div>
          </div>
          <div className="hero-status-card">
            <div className="status-pill">
              <div className="status-indicator">
                <span className="status-dot"></span>
                <strong>Local AI</strong>
              </div>
              <span>{localModelStatus}</span>
            </div>
            {localModelProgress !== null ? (
              <div className="hero-progress">
                <div className="hero-progress-label">
                  <span>Preparing local AI</span>
                  <strong>{Math.round(localModelProgress)}%</strong>
                </div>
                <progress value={localModelProgress} max={100} />
              </div>
            ) : null}
          </div>
          {activeImportJob ? (
            <div className="hero-progress">
              <div className="hero-progress-header">
                <span>{activeImportJob.message ?? `Analyzing ${activeImportJob.sourceLabel}`}</span>
                <strong>{Math.round(activeImportProgress ?? 0)}%</strong>
              </div>
              <progress value={activeImportProgress ?? 0} max={100} />
              <button
                type="button"
                className="cancel-button"
                onClick={() => {
                  if (activeImportJob) {
                    void cancelNativeImportJob(activeImportJob.id);
                  }
                }}
              >
                Cancel
              </button>
            </div>
          ) : null}
          <ImportActions
            disabled={!activeProject}
            onUploadFiles={() => fileInputRef.current?.click()}
            onAddFolder={async () => {
              if (!activeProject) {
                return;
              }

              const nativeFolderPath = await pickNativeFolderPath();
              if (nativeFolderPath) {
                await importNativeFolderPath(activeProject.id, nativeFolderPath);
                return;
              }

              const input = folderInputRef.current;
              if (!input) {
                return;
              }

              input.setAttribute("webkitdirectory", "");
              input.click();
            }}
          />
        </section>

        <section className="grid">
          <ChatPanel
            activeProject={activeProject}
            question={question}
            isImporting={isImporting}
            isGeneratingAnswer={isGeneratingAnswer}
            onQuestionChange={setQuestion}
            onGenerateAnswer={generateAnswer}
            onRenameProject={renameProject}
            onDeleteProject={deleteProject}
            onSaveAnswer={saveAnswer}
            onCreateNote={createNoteFromAnswer}
            onBookmarkCitation={bookmarkCitation}
            onHighlightCitation={highlightCitation}
          />

          <SourcePanel
            activeProject={activeProject}
            visibleDocuments={visibleDocuments}
            importJobs={importJobs}
            activeImportJob={activeImportJob}
            sourceFilter={sourceFilter}
            onSourceFilterChange={setSourceFilter}
          />
        </section>

        <StudyPanel
          activeProject={activeProject}
          onDeleteNote={deleteStudyNote}
          onUpdateNote={updateStudyNote}
          onDeleteBookmark={deleteStudyBookmark}
          onDeleteHighlight={deleteStudyHighlight}
          onDeleteSavedAnswer={deleteSavedAnswer}
          onExportStudy={exportStudyArtifacts}
          onBackupProject={backupProject}
        />

        {settingsOpen ? (
      <SettingsPanel
        config={config}
        showWelcome={config.showWelcome}
        localModelStatus={localModelStatus}
        localModelProgress={localModelProgress}
        modelStatusLog={state.modelStatusLog ?? []}
        onDismiss={dismissWelcome}
        onUpdateConfig={updateConfig}
        onResetAllLocalData={resetAllLocalData}
      />
        ) : null}

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.epub,.mobi,.azw3,.txt"
          multiple
          hidden
          onChange={importFiles}
        />
        <input
          ref={folderInputRef}
          type="file"
          multiple
          hidden
          onChange={importFolder}
        />
      </main>
    </div>
  );
}
