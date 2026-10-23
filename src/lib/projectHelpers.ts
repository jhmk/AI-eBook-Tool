import type { ProjectDocument, ProjectRecord } from "./types";

export function detectDocumentKind(fileName: string): ProjectDocument["kind"] {
  const extension = fileName.split(".").pop()?.toLowerCase();

  if (extension === "pdf") return "pdf";
  if (extension === "epub" || extension === "mobi" || extension === "azw3") {
    return "ebook";
  }

  return "other";
}

export function formatProjectStatus(project: ProjectRecord): string {
  if (project.indexingState === "indexing") {
    return "Indexing";
  }

  if (project.documents.length === 0) {
    return "Empty";
  }

  return project.indexingState === "ready" ? "Ready" : "Idle";
}
