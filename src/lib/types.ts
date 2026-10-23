export type DocumentKind = "pdf" | "ebook" | "other";

export type DocumentStatus = "queued" | "indexed" | "error";

export type SourceKind = "file" | "folder";

export type IndexingState = "idle" | "indexing" | "ready";

export type ImportJobStage = "queued" | "extracting" | "chunking" | "ready" | "error";

export type ModelProvider = "ollama" | "local-native" | "manual";
export type OcrMode = "off" | "auto" | "enhanced";

export interface AppConfig {
  modelProvider: ModelProvider;
  modelName: string;
  chunkSize: number;
  showWelcome: boolean;
  ocrMode: OcrMode;
}

export interface DocumentChunk {
  id: string;
  text: string;
  order: number;
  sourceLabel: string;
  sourceRef?: string;
  termWeights?: Record<string, number>;
  embedding?: number[];
}

export interface ChatCitation {
  documentId: string;
  documentName: string;
  chunkId: string;
  sourceRef?: string;
  snippet: string;
}

export interface LlmContextChunk {
  documentName: string;
  chunkId: string;
  sourceRef?: string;
  text: string;
}

export interface GenerateAnswerInput {
  modelName: string;
  question: string;
  context: LlmContextChunk[];
}

export interface GenerateAnswerOutput {
  content: string;
}

export type LocalModelState = "idle" | "starting" | "downloading" | "ready" | "unavailable";

export interface LocalModelStatusRecord {
  modelName: string;
  state: LocalModelState;
  message: string;
  serverRunning: boolean;
  modelReady: boolean;
  progress?: number;
}

export interface LocalModelStatusEntry {
  at: string;
  message: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  citations?: ChatCitation[];
}

export interface StudyNote {
  id: string;
  projectId: string;
  title: string;
  body: string;
  documentId?: string;
  chunkId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudyHighlight {
  id: string;
  projectId: string;
  documentId: string;
  documentName: string;
  chunkId: string;
  snippet: string;
  color: "yellow" | "blue" | "green";
  createdAt: string;
}

export interface StudyBookmark {
  id: string;
  projectId: string;
  documentId?: string;
  documentName: string;
  chunkId?: string;
  label: string;
  createdAt: string;
}

export interface SavedAnswer {
  id: string;
  projectId: string;
  question: string;
  answer: string;
  citations: ChatCitation[];
  createdAt: string;
}

export interface ProjectDocument {
  id: string;
  name: string;
  kind: DocumentKind;
  sourceLabel: string;
  sourcePath: string;
  status: DocumentStatus;
  importedAt: string;
  note?: string;
  extractedText?: string;
  chunkCount?: number;
  chunks?: DocumentChunk[];
}

export interface ProjectSource {
  id: string;
  kind: SourceKind;
  label: string;
  pathLabel: string;
  watchSignature?: string;
  addedAt: string;
}

export interface ImportJobRecord {
  id: string;
  projectId: string;
  sourceLabel: string;
  sourcePath: string;
  sourceKind: SourceKind;
  stage: ImportJobStage;
  progress: number;
  message?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateImportJobInput {
  projectId: string;
  sourceLabel: string;
  sourcePath: string;
  sourceKind: SourceKind;
}

export interface NativeImportFileInput {
  name: string;
  bytes: number[];
}

export interface NativeImportBatchInput {
  jobId: string;
  projectId: string;
  sourceLabel: string;
  sourcePath: string;
  sourceKind: SourceKind;
  chunkSize: number;
  files: NativeImportFileInput[];
}

export interface NativeImportedDocumentRecord {
  id: string;
  name: string;
  kind: DocumentKind;
  sourceLabel: string;
  sourcePath: string;
  status: DocumentStatus;
  importedAt: string;
  note?: string;
  extractedText?: string;
  chunkCount?: number;
  chunks?: DocumentChunk[];
}

export interface NativeDirectoryEntryRecord {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  modified?: string;
}

export interface ProjectRecord {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  indexingState: IndexingState;
  sources: ProjectSource[];
  documents: ProjectDocument[];
  chat: ChatMessage[];
  notes: StudyNote[];
  highlights: StudyHighlight[];
  bookmarks: StudyBookmark[];
  savedAnswers: SavedAnswer[];
}

export interface AppState {
  projects: ProjectRecord[];
  activeProjectId: string | null;
  version: number;
  modelStatusLog?: LocalModelStatusEntry[];
}
