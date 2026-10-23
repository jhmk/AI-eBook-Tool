import type { DocumentChunk, ProjectDocument } from "./types";

export interface DocumentTextSection {
  text: string;
  sourceRef?: string;
}

const tokenCache = new Map<string, string[]>();
const termWeightsCache = new Map<string, Record<string, number>>();
const embeddingCache = new Map<string, number[]>();

const CACHE_MAX_SIZE = 500;

function evictOldestEntry(cache: Map<string, unknown>) {
  if (cache.size > CACHE_MAX_SIZE) {
    const firstKey = cache.keys().next().value;
    if (firstKey) {
      cache.delete(firstKey);
    }
  }
}

export function tokenize(value: string) {
  const cached = tokenCache.get(value);
  if (cached) {
    return cached;
  }

  const result = value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .map((token) => {
      if (token.length <= 3) {
        return token;
      }

      if (token.endsWith("ies")) {
        return `${token.slice(0, -3)}y`;
      }

      if (token.endsWith("ing") && token.length > 5) {
        return token.slice(0, -3);
      }

      if (token.endsWith("ed") && token.length > 4) {
        return token.slice(0, -2);
      }

      if (token.endsWith("s") && !token.endsWith("ss")) {
        return token.slice(0, -1);
      }

      return token;
    })
    .filter((token) => token.length > 2);

  evictOldestEntry(tokenCache);
  tokenCache.set(value, result);
  return result;
}

export function buildTermWeights(value: string) {
  const cached = termWeightsCache.get(value);
  if (cached) {
    return cached;
  }

  const weights: Record<string, number> = {};
  for (const token of tokenize(value)) {
    weights[token] = (weights[token] ?? 0) + 1;
  }

  evictOldestEntry(termWeightsCache);
  termWeightsCache.set(value, weights);
  return weights;
}

export function buildEmbeddingVector(value: string, dimensions = 128) {
  const cacheKey = `${value}:${dimensions}`;
  const cached = embeddingCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const vector = new Array<number>(dimensions).fill(0);
  for (const token of tokenize(value)) {
    let hash = 0;
    for (let index = 0; index < token.length; index += 1) {
      hash = (hash * 31 + token.charCodeAt(index)) >>> 0;
    }
    const slot = hash % dimensions;
    vector[slot] += 1;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  const normalized = magnitude > 0 ? vector.map((value) => value / magnitude) : vector;

  evictOldestEntry(embeddingCache);
  embeddingCache.set(cacheKey, normalized);
  return normalized;
}

function chunkSingleSection(
  text: string,
  chunkSize = 700,
  sourceLabel = "Imported text",
  sourceRef?: string,
  startOrder = 0,
): DocumentChunk[] {
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!normalized) {
    return [];
  }

  const paragraphs = normalized.split(/\n{2,}/).map((paragraph) => paragraph.trim());
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (!paragraph) continue;
    const next = current ? `${current}\n\n${paragraph}` : paragraph;
    if (next.length <= chunkSize) {
      current = next;
      continue;
    }

    if (current) {
      chunks.push(current);
    }

    if (paragraph.length <= chunkSize) {
      current = paragraph;
      continue;
    }

    const sentences = paragraph.match(/[^.!?]+[.!?]*/g) ?? [paragraph];
    let sentenceBuffer = "";
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (!trimmed) continue;
      const candidate = sentenceBuffer ? `${sentenceBuffer} ${trimmed}` : trimmed;
      if (candidate.length <= chunkSize) {
        sentenceBuffer = candidate;
      } else {
        if (sentenceBuffer) {
          chunks.push(sentenceBuffer);
        }
        sentenceBuffer = trimmed;
      }
    }
    if (sentenceBuffer) {
      current = sentenceBuffer;
    } else {
      current = "";
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks.map((chunk, index) => ({
    id: crypto.randomUUID(),
    text: chunk,
    order: startOrder + index,
    sourceLabel,
    sourceRef,
    termWeights: buildTermWeights(chunk),
    embedding: buildEmbeddingVector(chunk),
  }));
}

export function buildChunksForDocument(text: string, sourceLabel: string, chunkSize = 700) {
  return chunkSingleSection(text, chunkSize, sourceLabel);
}

export function buildChunksForSections(
  sections: DocumentTextSection[],
  sourceLabel: string,
  chunkSize = 700,
) {
  const chunks: DocumentChunk[] = [];
  let order = 0;

  for (const section of sections) {
    const sectionChunks = chunkSingleSection(
      section.text,
      chunkSize,
      sourceLabel,
      section.sourceRef,
      order,
    );
    chunks.push(...sectionChunks);
    order += sectionChunks.length;
  }

  return chunks;
}

export function chunkText(text: string, chunkSize = 700): DocumentChunk[] {
  return buildChunksForDocument(text, "Imported text", chunkSize);
}

export function prepareImportedDocument(
  file: { name: string },
  text: string,
  note: string,
  status: ProjectDocument["status"],
  chunkSize = 700,
  sections?: DocumentTextSection[],
): Pick<ProjectDocument, "extractedText" | "chunkCount" | "chunks" | "note" | "status"> {
  const chunks = sections
    ? buildChunksForSections(sections, file.name, chunkSize)
    : buildChunksForDocument(text, file.name, chunkSize);

  return {
    extractedText: text,
    chunkCount: chunks.length,
    chunks,
    note,
    status,
  };
}
