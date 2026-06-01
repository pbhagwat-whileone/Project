import {
  EMBEDDING_MODEL,
  getGeminiClient,
} from "@/ai/gemini";

export async function generateEmbedding(
  text: string
): Promise<number[]> {
  const ai = getGeminiClient();

  const response = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
    config: {
      outputDimensionality: 768,
    },
  });

  const values = response.embeddings?.[0]?.values;

  if (!values || values.length === 0) {
    throw new Error("Failed to generate embedding");
  }

  return values;
}

export function embeddingToPgVector(
  embedding: number[]
): string {
  return `[${embedding.join(",")}]`;
}