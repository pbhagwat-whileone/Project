-- Redefine match_knowledge_chunks to include blog_url
DROP FUNCTION IF EXISTS match_knowledge_chunks(vector, int);
DROP FUNCTION IF EXISTS match_knowledge_chunks(uuid, vector, int);

CREATE OR REPLACE FUNCTION match_knowledge_chunks(
  query_embedding vector(768),
  match_count INT DEFAULT 3
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  chunk_text TEXT,
  project_name TEXT,
  industry TEXT,
  similarity FLOAT,
  blog_url TEXT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    kc.id,
    kc.document_id,
    kc.chunk_text,
    kc.project_name,
    kc.industry,
    (1 - (kc.embedding <=> query_embedding))::FLOAT AS similarity,
    COALESCE(kc.blog_url, kd.blog_url) AS blog_url
  FROM knowledge_chunks kc
  LEFT JOIN knowledge_documents kd
    ON kd.id = kc.document_id
  WHERE kc.embedding IS NOT NULL
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
$$;
