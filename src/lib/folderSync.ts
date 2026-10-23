import type { NativeDirectoryEntryRecord } from "./types";

export function isSupportedImportFileName(fileName: string) {
  return /\.(pdf|epub|mobi|azw3|txt|md|markdown|csv|json|log)$/i.test(fileName);
}

export function filterImportableFolderEntries(entries: NativeDirectoryEntryRecord[]) {
  return entries.filter((entry) => !entry.isDirectory && isSupportedImportFileName(entry.name));
}

export function buildFolderWatchSignature(entries: NativeDirectoryEntryRecord[]) {
  return [...filterImportableFolderEntries(entries)]
    .sort((left, right) => left.path.localeCompare(right.path))
    .map((entry) => `${entry.path}:${entry.size ?? 0}:${entry.modified ?? ""}`)
    .join("|");
}
