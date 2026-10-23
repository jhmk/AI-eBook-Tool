import {
  cancelNativeImportJob,
  completeNativeImportBatch,
  createNativeImportJob,
  loadNativeAppConfig,
  loadNativeAppState,
  loadNativeProjectIndex,
  listNativeDirectoryEntries,
  listNativeImportJobs,
  resetNativeAppData,
  resetAllNativeProjectIndexes,
  resetNativeProjectIndex,
  readNativeFileBytes,
  saveNativeAppConfig,
  saveNativeAppState,
  saveNativeProjectIndex,
  updateNativeImportJob,
} from "./nativeBridge";
import type { AppConfig, AppState, ProjectRecord } from "./types";

const STORAGE_KEY = "ai-ebook-tool.state.v1";
const CONFIG_KEY = "ai-ebook-tool.config.v1";

const defaultState: AppState = {
  projects: [],
  activeProjectId: null,
  version: 1,
};

export const defaultAppConfig: AppConfig = {
  modelProvider: "ollama",
  modelName: "gemma3:1b",
  chunkSize: 700,
  showWelcome: true,
  ocrMode: "auto",
};

export function normalizeAppState(input: unknown): AppState {
  if (!input || typeof input !== "object") {
    return defaultState;
  }

  const candidate = input as Partial<AppState>;

  return {
    projects: Array.isArray(candidate.projects)
      ? candidate.projects.map((project) => ({
          ...project,
          sources: Array.isArray(project.sources) ? project.sources : [],
          documents: Array.isArray(project.documents) ? project.documents : [],
          chat: Array.isArray(project.chat) ? project.chat : [],
          notes: Array.isArray(project.notes) ? project.notes : [],
          highlights: Array.isArray(project.highlights) ? project.highlights : [],
          bookmarks: Array.isArray(project.bookmarks) ? project.bookmarks : [],
          savedAnswers: Array.isArray(project.savedAnswers) ? project.savedAnswers : [],
        }))
      : [],
    activeProjectId:
      typeof candidate.activeProjectId === "string" ? candidate.activeProjectId : null,
    version: typeof candidate.version === "number" ? candidate.version : 1,
  };
}

export function normalizeAppConfig(input: unknown): AppConfig {
  if (!input || typeof input !== "object") {
    return defaultAppConfig;
  }

  const candidate = input as Partial<AppConfig>;

  return {
    modelProvider:
      candidate.modelProvider === "local-native" ||
      candidate.modelProvider === "manual" ||
      candidate.modelProvider === "ollama"
        ? candidate.modelProvider
        : defaultAppConfig.modelProvider,
    modelName:
      typeof candidate.modelName === "string" && candidate.modelName.trim()
        ? candidate.modelName
        : defaultAppConfig.modelName,
    chunkSize:
      typeof candidate.chunkSize === "number" && candidate.chunkSize >= 200
        ? candidate.chunkSize
        : defaultAppConfig.chunkSize,
    showWelcome:
      typeof candidate.showWelcome === "boolean"
        ? candidate.showWelcome
        : defaultAppConfig.showWelcome,
    ocrMode:
      candidate.ocrMode === "off" ||
      candidate.ocrMode === "auto" ||
      candidate.ocrMode === "enhanced"
        ? candidate.ocrMode
        : defaultAppConfig.ocrMode,
  };
}

function isBrowserStorageAvailable() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function createProjectDraft(name: string): ProjectRecord {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    name,
    description: "Local project for PDFs and ebooks.",
    createdAt: now,
    updatedAt: now,
    indexingState: "idle",
    sources: [],
    documents: [],
    chat: [],
    notes: [],
    highlights: [],
    bookmarks: [],
    savedAnswers: [],
  };
}

export function loadAppState(): AppState {
  if (!isBrowserStorageAvailable()) {
    return defaultState;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return defaultState;
  }

  try {
    return normalizeAppState(JSON.parse(raw));
  } catch {
    return defaultState;
  }
}

export function saveAppState(state: AppState) {
  if (!isBrowserStorageAvailable()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  void saveNativeAppState(state);
}

export async function hydrateAppState() {
  const nativeState = await loadNativeAppState();
  return nativeState ? normalizeAppState(nativeState) : null;
}

export function loadAppConfig(): AppConfig {
  if (!isBrowserStorageAvailable()) {
    return defaultAppConfig;
  }

  const raw = window.localStorage.getItem(CONFIG_KEY);
  if (!raw) {
    return defaultAppConfig;
  }

  try {
    return normalizeAppConfig(JSON.parse(raw));
  } catch {
    return defaultAppConfig;
  }
}

export function saveAppConfig(config: AppConfig) {
  if (!isBrowserStorageAvailable()) {
    return;
  }

  window.localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  void saveNativeAppConfig(config);
}

export async function hydrateAppConfig() {
  const nativeConfig = await loadNativeAppConfig();
  return nativeConfig ? normalizeAppConfig(nativeConfig) : null;
}

export async function resetPersistentAppData() {
  if (isBrowserStorageAvailable()) {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(CONFIG_KEY);
  }

  await resetNativeAppData();
}

export {
  cancelNativeImportJob,
  completeNativeImportBatch,
  createNativeImportJob,
  loadNativeProjectIndex,
  listNativeDirectoryEntries,
  listNativeImportJobs,
  resetAllNativeProjectIndexes,
  resetNativeProjectIndex,
  readNativeFileBytes,
  saveNativeProjectIndex,
  updateNativeImportJob,
};
