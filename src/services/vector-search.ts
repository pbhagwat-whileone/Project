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
  console.log("VECTOR SEARCH QUERY:", query);

  const embedding = await generateEmbedding(query);

  console.log("SEARCH EMBEDDING LENGTH:", embedding.length);

  const vector = embeddingToPgVector(embedding);

  const { data, error } = await supabase.rpc(
    "match_knowledge_chunks",
    {
      p_user_id: userId,
      query_embedding: vector,
      match_count: matchCount,
    }
  )
  console.log("VECTOR SEARCH RESULT COUNT:", data?.length ?? 0);

  console.log("VECTOR SEARCH RESULT:", data);
  console.log("VECTOR SEARCH ERROR:", error);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as MatchedChunk[];
}