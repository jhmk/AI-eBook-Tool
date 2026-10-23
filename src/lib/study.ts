import type {
  ChatCitation,
  SavedAnswer,
  StudyBookmark,
  StudyHighlight,
  StudyNote,
} from "./types";

function nowIso() {
  return new Date().toISOString();
}

function clipText(value: string, length: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= length) {
    return normalized;
  }

  return `${normalized.slice(0, length - 1).trimEnd()}…`;
}

export function createSavedAnswer(question: string, answer: string, citations: ChatCitation[]): SavedAnswer {
  return {
    id: crypto.randomUUID(),
    projectId: "",
    question: clipText(question, 140),
    answer,
    citations,
    createdAt: nowIso(),
  };
}

export function createStudyNote(
  title: string,
  body: string,
  documentId?: string,
  chunkId?: string,
): StudyNote {
  return {
    id: crypto.randomUUID(),
    projectId: "",
    title: clipText(title, 80),
    body,
    documentId,
    chunkId,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

export function createStudyHighlight(
  citation: ChatCitation,
  color: StudyHighlight["color"] = "yellow",
): StudyHighlight {
  return {
    id: crypto.randomUUID(),
    projectId: "",
    documentId: citation.documentId,
    documentName: citation.documentName,
    chunkId: citation.chunkId,
    snippet: clipText(citation.snippet, 260),
    color,
    createdAt: nowIso(),
  };
}

export function createStudyBookmark(citation: ChatCitation): StudyBookmark {
  return {
    id: crypto.randomUUID(),
    projectId: "",
    documentId: citation.documentId,
    documentName: citation.documentName,
    chunkId: citation.chunkId,
    label: clipText(citation.snippet, 120),
    createdAt: nowIso(),
  };
}
