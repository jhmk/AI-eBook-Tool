import type { ChatCitation, ProjectDocument } from "./types";
import { buildEmbeddingVector, buildTermWeights, tokenize } from "./textProcessing";

interface ChunkMeta {
  weights: Record<string, number>;
  embedding: number[];
}

const chunkMetaCache = new Map<string, ChunkMeta>();
const CACHE_MAX_SIZE = 1000;

function getChunkMeta(chunkId: string, text: string): ChunkMeta {
  const cached = chunkMetaCache.get(chunkId);
  if (cached) {
    return cached;
  }

  if (chunkMetaCache.size > CACHE_MAX_SIZE) {
    const firstKey = chunkMetaCache.keys().next().value;
    if (firstKey) {
      chunkMetaCache.delete(firstKey);
    }
  }

  const meta: ChunkMeta = {
    weights: buildTermWeights(text),
    embedding: buildEmbeddingVector(text),
  };
  chunkMetaCache.set(chunkId, meta);
  return meta;
}

function scoreText(haystack: string, queryTokens: string[]) {
  const lower = haystack.toLowerCase();
  let score = 0;

  for (const token of queryTokens) {
    if (lower.includes(token)) {
      score += 1;
    }
  }

  return score;
}

function uniqueTokens(tokens: string[]) {
  return [...new Set(tokens)];
}

function tokenCoverage(queryTokens: string[], targetText: string) {
  const uniqueQueryTokens = uniqueTokens(queryTokens);
  if (uniqueQueryTokens.length === 0) {
    return 0;
  }

  const targetTokens = new Set(tokenize(targetText));
  if (targetTokens.size === 0) {
    return 0;
  }

  let matches = 0;
  for (const token of uniqueQueryTokens) {
    if (targetTokens.has(token)) {
      matches += 1;
    }
  }

  return matches / uniqueQueryTokens.length;
}

function lengthBalanceScore(text: string, preferredLength = 900) {
  const normalizedLength = text.trim().length;
  if (normalizedLength === 0) {
    return 0;
  }

  const distance = Math.abs(normalizedLength - preferredLength);
  const balance = 1 - distance / preferredLength;
  return Math.max(0, Math.min(1, balance));
}

function cosineSimilarity(left: number[], right: number[]) {
  if (left.length === 0 || right.length === 0) {
    return 0;
  }

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    dot += leftValue * rightValue;
    leftMagnitude += leftValue * leftValue;
    rightMagnitude += rightValue * rightValue;
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

function weightSimilarity(left: Record<string, number>, right: Record<string, number>) {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  if (keys.size === 0) {
    return 0;
  }

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (const key of keys) {
    const leftValue = left[key] ?? 0;
    const rightValue = right[key] ?? 0;
    dot += leftValue * rightValue;
    leftMagnitude += leftValue * leftValue;
    rightMagnitude += rightValue * rightValue;
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

export function retrieveRelevantChunks(question: string, documents: ProjectDocument[]) {
  const queryTokens = tokenize(question);
  const queryWeights = buildTermWeights(question);
  const queryEmbedding = buildEmbeddingVector(question);

  const scoredEntries = documents.flatMap((document) =>
    (document.chunks ?? []).map((chunk) => {
      const chunkMeta = getChunkMeta(chunk.id, chunk.text);

      const lexicalScore =
        scoreText(document.name, queryTokens) * 1.25 +
        scoreText(document.note ?? "", queryTokens) * 0.75 +
        scoreText(chunk.text, queryTokens) * 1.1;
      const semanticScore = weightSimilarity(
        queryWeights,
        chunk.termWeights ?? chunkMeta.weights,
      );
      const vectorScore = cosineSimilarity(
        queryEmbedding,
        chunk.embedding ?? chunkMeta.embedding,
      );
      const coverageScore = tokenCoverage(queryTokens, chunk.text);
      const documentCoverage = tokenCoverage(queryTokens, `${document.name} ${document.note ?? ""}`);
      const lengthScore = lengthBalanceScore(chunk.text);

      return {
        document,
        chunk,
        lexicalScore,
        semanticScore,
        vectorScore,
        coverageScore,
        documentCoverage,
        lengthScore,
        score:
          lexicalScore * 1.2 +
          semanticScore * 2.5 +
          vectorScore * 2 +
          coverageScore * 3 +
          documentCoverage * 0.75 +
          lengthScore * 0.35,
      };
    }),
  );

  const rankedEntries = scoredEntries
    .filter(
      (entry) =>
        entry.coverageScore > 0 ||
        entry.documentCoverage > 0 ||
        entry.semanticScore > 0 ||
        entry.vectorScore > 0 ||
        entry.lexicalScore > 0,
    )
    .sort((left, right) => right.score - left.score);

  const selectedEntries: typeof rankedEntries = [];
  const perDocumentCounts = new Map<string, number>();

  for (const entry of rankedEntries) {
    const currentCount = perDocumentCounts.get(entry.document.id) ?? 0;
    if (currentCount >= 2) {
      continue;
    }

    selectedEntries.push(entry);
    perDocumentCounts.set(entry.document.id, currentCount + 1);

    if (selectedEntries.length >= 4) {
      break;
    }
  }

  return selectedEntries;
}

export function answerFromSources(question: string, documents: ProjectDocument[]) {
  const matches = retrieveRelevantChunks(question, documents);

  if (matches.length === 0) {
    return {
      content:
        "I could not find enough support in the indexed sources to answer that yet. Import more text or wait for the native PDF/ebook extractor.",
      citations: [] as ChatCitation[],
    };
  }

  const citations: ChatCitation[] = matches.map((match) => ({
    documentId: match.document.id,
    documentName: match.document.name,
    chunkId: match.chunk.id,
    sourceRef: match.chunk.sourceRef,
    snippet: match.chunk.text.slice(0, 220),
  }));

  const summaryBullets = matches.map((match) => {
    const snippet = match.chunk.text.slice(0, 180).replace(/\s+/g, " ").trim();
    const location = match.chunk.sourceRef ? ` (${match.chunk.sourceRef})` : "";
    return `- ${snippet} [${match.document.name}${location}]`;
  });

  return {
    content: [
      "Based on the indexed sources, the strongest relevant passages are:",
      ...summaryBullets,
      "",
      "This answer is grounded in the imported content that matched your question.",
    ].join("\n"),
    citations,
  };
}
