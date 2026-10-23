import type {
  AppConfig,
  AppState,
  CreateImportJobInput,
  GenerateAnswerInput,
  GenerateAnswerOutput,
  ImportJobRecord,
  LocalModelStatusRecord,
  NativeImportBatchInput,
  NativeDirectoryEntryRecord,
  NativeImportedDocumentRecord,
  ProjectDocument,
} from "./types";

type NativeModule = typeof import("@tauri-apps/api/core");

let invokeModulePromise: Promise<NativeModule> | null = null;

function hasWindow() {
  return typeof window !== "undefined";
}

async function invokeNative<T>(command: string, args?: Record<string, unknown>) {
  if (!hasWindow()) {
    return null;
  }

  try {
    invokeModulePromise ||= import("@tauri-apps/api/core");
    const { invoke } = await invokeModulePromise;
    return await invoke<T>(command, args);
  } catch {
    return null;
  }
}

export async function loadNativeAppState() {
  return invokeNative<AppState | null>("load_app_state");
}

export async function saveNativeAppState(state: AppState) {
  await invokeNative("save_app_state", { state });
}

export async function loadNativeAppConfig() {
  return invokeNative<AppConfig | null>("load_app_config");
}

export async function saveNativeAppConfig(config: AppConfig) {
  await invokeNative("save_app_config", { config });
}

export async function resetNativeAppData() {
  await invokeNative("reset_app_data");
}

export async function createNativeImportJob(job: CreateImportJobInput) {
  return invokeNative<ImportJobRecord | null>("create_import_job", { job });
}

export async function updateNativeImportJob(
  jobId: string,
  patch: Partial<Pick<ImportJobRecord, "stage" | "progress" | "message">>,
) {
  return invokeNative<ImportJobRecord | null>("update_import_job", { jobId, patch });
}

export async function listNativeImportJobs() {
  return invokeNative<ImportJobRecord[] | null>("list_import_jobs");
}

export async function cancelNativeImportJob(jobId: string) {
  return invokeNative<ImportJobRecord | null>("cancel_import_job", { jobId });
}

export async function listNativeDirectoryEntries(path: string) {
  return invokeNative<NativeDirectoryEntryRecord[] | null>("list_directory_entries", { path });
}

export async function readNativeFileBytes(path: string) {
  return invokeNative<number[] | null>("read_file_bytes", { path });
}

export async function completeNativeImportBatch(batch: NativeImportBatchInput) {
  return invokeNative<NativeImportedDocumentRecord[] | null>("complete_import_batch", {
    batch,
  });
}

export async function loadNativeProjectIndex(projectId: string) {
  return invokeNative<ProjectDocument[] | null>("load_project_index", { projectId });
}

export async function saveNativeProjectIndex(projectId: string, documents: ProjectDocument[]) {
  await invokeNative("save_project_index", {
    record: {
      projectId,
      documents,
      updatedAt: new Date().toISOString(),
    },
  });
}

export async function resetNativeProjectIndex(projectId: string) {
  await invokeNative("reset_project_index", { projectId });
}

export async function resetAllNativeProjectIndexes() {
  await invokeNative("reset_all_indexes");
}

export async function generateNativeLlmAnswer(input: GenerateAnswerInput) {
  return invokeNative<GenerateAnswerOutput | null>("generate_llm_answer", { input });
}

export async function prepareNativeLocalModel(modelName: string) {
  return invokeNative<LocalModelStatusRecord | null>("prepare_local_model_command", {
    modelName,
  });
}

export async function prepareNativeLocalModelWithBundle(
  modelName: string,
  runtimeBundleDir?: string | null,
) {
  return invokeNative<LocalModelStatusRecord | null>("prepare_local_model_command", {
    modelName,
    runtimeBundleDir,
  });
}

export async function inspectNativeLocalModelStatus(
  modelName: string,
  runtimeBundleDir?: string | null,
) {
  return invokeNative<LocalModelStatusRecord | null>("inspect_local_model_command", {
    modelName,
    runtimeBundleDir,
  });
}
