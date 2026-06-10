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
    match_count: 20,
  });

  if (error) {
    throw new Error(error.message);
  }

  const chunks = (data ?? []) as MatchedChunk[];
  
  console.log("[PROJECT_RETRIEVAL] Retrieved:", chunks.map(c => c.project_name || c.document_id));

  const preFilterCount = chunks.length;
  
  const uniqueProjects = new Map<string, MatchedChunk>();
  for (const chunk of chunks) {
    const key = chunk.project_name || chunk.document_id;
    if (!uniqueProjects.has(key)) {
      uniqueProjects.set(key, chunk);
    } else {
      const existing = uniqueProjects.get(key)!;
      if (chunk.similarity > existing.similarity) {
        uniqueProjects.set(key, chunk);
      }
    }
  }

  const topUnique = Array.from(uniqueProjects.values())
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, matchCount);

  console.log("[PROJECT_RETRIEVAL] After Dedupe:", topUnique.map(c => c.project_name || c.document_id));

  // Return early if no relevant projects are found
  if (topUnique.length === 0) return topUnique;

  const docIds = [...new Set(topUnique.map(c => c.document_id))];
  const { data: docs } = await supabase
    .from("knowledge_documents")
    .select("id, google_file_id")
    .in("id", docIds);

  const docMap = new Map(docs?.map(d => [d.id, d.google_file_id]));

  for (const chunk of topUnique) {
    const fileId = docMap.get(chunk.document_id);
    if (fileId) {
      chunk.reference_link = `https://docs.google.com/document/d/${fileId}/edit`;
    }
  }

  return topUnique;
}
