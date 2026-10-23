import { generateNativeLlmAnswer } from "./nativeBridge";
import { answerFromSources, retrieveRelevantChunks } from "./retrieval";
import type { AppConfig, ProjectDocument } from "./types";

function normalizeResponse(value: string) {
  return value.replace(/\n{3,}/g, "\n\n").trim();
}

export async function answerQuestionWithLocalModel(
  question: string,
  documents: ProjectDocument[],
  config: AppConfig,
) {
  const matches = retrieveRelevantChunks(question, documents);

  if (matches.length === 0) {
    return answerFromSources(question, documents);
  }

  if (config.modelProvider !== "ollama" && config.modelProvider !== "local-native") {
    return answerFromSources(question, documents);
  }

  const modelAnswer = await generateNativeLlmAnswer({
    modelName: config.modelName,
    question,
    context: matches.map((match) => ({
      documentName: match.document.name,
      chunkId: match.chunk.id,
      sourceRef: match.chunk.sourceRef,
      text: match.chunk.text,
    })),
  });

  if (!modelAnswer?.content?.trim()) {
    return answerFromSources(question, documents);
  }

  const fallback = answerFromSources(question, documents);
  return {
    content: normalizeResponse(modelAnswer.content),
    citations: fallback.citations,
  };
}
