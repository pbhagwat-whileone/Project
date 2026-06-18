import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, MatchedChunk } from "@/types/database";
import {
  embeddingToPgVector,
  generateEmbedding,
} from "@/services/ai/embeddings/embeddings";

export async function searchKnowledgeChunks(
  supabase: SupabaseClient<Database>,
  userId: string,
  query: string,
  matchCount = 3
): Promise<MatchedChunk[]> {
  const embedding = await generateEmbedding(query);
  const vector = embeddingToPgVector(embedding);

  const { data, error } = await (supabase as any).rpc("match_knowledge_chunks", {
    query_embedding: vector,
    match_count: 20,
  });

  if (error) {
    throw new Error(error.message);
  }

  const chunks = (data ?? []) as MatchedChunk[];
  

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


  // Return early if no relevant projects are found
  if (topUnique.length === 0) return topUnique;

  const docIds = [...new Set(topUnique.map(c => c.document_id))];
  const { data: docs } = await supabase
    .from("knowledge_documents")
    .select("id, google_file_id, source_type")
    .in("id", docIds);

  const docMap = new Map(docs?.map(d => [d.id, { fileId: d.google_file_id, sourceType: d.source_type }]));

  for (const chunk of topUnique) {
    const docInfo = docMap.get(chunk.document_id);
    if (docInfo && docInfo.fileId) {
      if (docInfo.sourceType === "google_sheet") {
        chunk.reference_link = `https://docs.google.com/spreadsheets/d/${docInfo.fileId}/edit`;
      } else {
        chunk.reference_link = `https://docs.google.com/document/d/${docInfo.fileId}/edit`;
      }
    }
  }


  return topUnique;
}
