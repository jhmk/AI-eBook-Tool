import {
  inspectNativeLocalModelStatus,
  prepareNativeLocalModelWithBundle,
} from "./nativeBridge";
import type { LocalModelStatusRecord, LocalModelStatusEntry } from "./types";

async function resolveBundledRuntimeDir() {
  try {
    const { resolveResource } = await import("@tauri-apps/api/path");
    return await resolveResource("runtime/ollama");
  } catch {
    return null;
  }
}

export async function prepareLocalModel(modelName: string) {
  const runtimeBundleDir = await resolveBundledRuntimeDir();
  return (await prepareNativeLocalModelWithBundle(
    modelName,
    runtimeBundleDir,
  )) as LocalModelStatusRecord | null;
}

export async function inspectLocalModel(modelName: string) {
  const runtimeBundleDir = await resolveBundledRuntimeDir();
  return (await inspectNativeLocalModelStatus(
    modelName,
    runtimeBundleDir,
  )) as LocalModelStatusRecord | null;
}

export function createLocalModelStatusEntry(message: string): LocalModelStatusEntry {
  return {
    at: new Date().toISOString(),
    message,
  };
}
