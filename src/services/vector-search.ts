import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, MatchedChunk } from "@/types/database";
import {
  embeddingToPgVector,
  generateEmbedding,
} from "@/services/embeddings";

export async function searchKnowledgeChunks(
  supabase: SupabaseClient<Database>,
  userId: string,
  query: string,
  matchCount = 3
): Promise<MatchedChunk[]> {
  const embedding = await generateEmbedding(query);
  const vector = embeddingToPgVector(embedding);

  const { data, error } = await supabase.rpc("match_knowledge_chunks", {
    p_user_id: userId,
    query_embedding: vector,
    match_count: matchCount,
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as MatchedChunk[];
}
