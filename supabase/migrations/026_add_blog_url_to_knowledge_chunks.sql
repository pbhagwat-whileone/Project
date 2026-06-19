ALTER TABLE "public"."knowledge_chunks" ADD COLUMN IF NOT EXISTS "blog_url" TEXT;

UPDATE "public"."knowledge_chunks" kc
SET blog_url = kd.blog_url
FROM "public"."knowledge_documents" kd
WHERE kc.document_id = kd.id AND kd.blog_url IS NOT NULL;

DROP FUNCTION IF EXISTS match_knowledge_chunks(vector(768), INT);

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
  blog_url TEXT,
  similarity FLOAT
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
    kc.blog_url,
    (1 - (kc.embedding <=> query_embedding))::FLOAT AS similarity
  FROM knowledge_chunks kc
  JOIN knowledge_documents kd
    ON kd.id = kc.document_id
  WHERE kc.embedding IS NOT NULL
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
$$;
