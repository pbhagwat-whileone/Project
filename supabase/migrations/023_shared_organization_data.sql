-- knowledge_documents
DROP POLICY IF EXISTS knowledge_documents_all ON knowledge_documents;
CREATE POLICY knowledge_documents_all ON knowledge_documents FOR ALL USING (auth.role() = 'authenticated');

-- knowledge_chunks
DROP POLICY IF EXISTS knowledge_chunks_select ON knowledge_chunks;
DROP POLICY IF EXISTS knowledge_chunks_insert ON knowledge_chunks;
DROP POLICY IF EXISTS knowledge_chunks_delete ON knowledge_chunks;
CREATE POLICY knowledge_chunks_all ON knowledge_chunks FOR ALL USING (auth.role() = 'authenticated');

-- connections
DROP POLICY IF EXISTS connections_all ON connections;
CREATE POLICY connections_all ON connections FOR ALL USING (auth.role() = 'authenticated');

-- prospects
DROP POLICY IF EXISTS prospects_all ON prospects;
CREATE POLICY prospects_all ON prospects FOR ALL USING (auth.role() = 'authenticated');

-- prospect_analysis
DROP POLICY IF EXISTS prospect_analysis_all ON prospect_analysis;
CREATE POLICY prospect_analysis_all ON prospect_analysis FOR ALL USING (auth.role() = 'authenticated');

-- generated_emails
DROP POLICY IF EXISTS generated_emails_all ON generated_emails;
CREATE POLICY generated_emails_all ON generated_emails FOR ALL USING (auth.role() = 'authenticated');

-- sync_logs
DROP POLICY IF EXISTS sync_logs_all ON sync_logs;
CREATE POLICY sync_logs_all ON sync_logs FOR ALL USING (auth.role() = 'authenticated');

-- linkedin_messages
DROP POLICY IF EXISTS linkedin_messages_all ON linkedin_messages;
CREATE POLICY linkedin_messages_all ON linkedin_messages FOR ALL USING (auth.role() = 'authenticated');

-- connection_relationship_metrics
DROP POLICY IF EXISTS connection_relationship_metrics_all ON connection_relationship_metrics;
CREATE POLICY connection_relationship_metrics_all ON connection_relationship_metrics FOR ALL USING (auth.role() = 'authenticated');

-- company_industry_cache
DROP POLICY IF EXISTS company_industry_cache_all ON company_industry_cache;
CREATE POLICY company_industry_cache_all ON company_industry_cache FOR ALL USING (auth.role() = 'authenticated');

-- company_score_cache
DROP POLICY IF EXISTS company_score_cache_all ON company_score_cache;
CREATE POLICY company_score_cache_all ON company_score_cache FOR ALL USING (auth.role() = 'authenticated');

-- company_similar_contacts_cache
DROP POLICY IF EXISTS company_similar_contacts_cache_all ON company_similar_contacts_cache;
CREATE POLICY company_similar_contacts_cache_all ON company_similar_contacts_cache FOR ALL USING (auth.role() = 'authenticated');

-- company_context_cache
DROP POLICY IF EXISTS company_context_cache_all ON company_context_cache;
CREATE POLICY company_context_cache_all ON company_context_cache FOR ALL USING (auth.role() = 'authenticated');

-- Update unique constraints to be global

-- connections
DROP INDEX IF EXISTS connections_user_id_profile_url_idx;
DROP INDEX IF EXISTS connections_user_id_profile_url_owner_idx;
CREATE UNIQUE INDEX IF NOT EXISTS connections_profile_url_owner_idx ON connections (profile_url, connection_owner_name);

-- linkedin_messages
ALTER TABLE linkedin_messages DROP CONSTRAINT IF EXISTS unique_user_message_hash;
ALTER TABLE linkedin_messages DROP CONSTRAINT IF EXISTS unique_message_hash;
ALTER TABLE linkedin_messages ADD CONSTRAINT unique_message_hash UNIQUE(message_hash);

-- company_industry_cache
ALTER TABLE company_industry_cache DROP CONSTRAINT IF EXISTS company_industry_cache_pkey;
ALTER TABLE company_industry_cache ADD PRIMARY KEY (company_name);

-- company_score_cache
ALTER TABLE company_score_cache DROP CONSTRAINT IF EXISTS company_score_cache_pkey;
ALTER TABLE company_score_cache ADD PRIMARY KEY (company_name);

-- company_similar_contacts_cache
ALTER TABLE company_similar_contacts_cache DROP CONSTRAINT IF EXISTS company_similar_contacts_cache_user_id_company_name_key;
ALTER TABLE company_similar_contacts_cache DROP CONSTRAINT IF EXISTS company_similar_contacts_cache_company_name_key;
ALTER TABLE company_similar_contacts_cache ADD CONSTRAINT company_similar_contacts_cache_company_name_key UNIQUE(company_name);

-- company_context_cache
ALTER TABLE company_context_cache DROP CONSTRAINT IF EXISTS company_context_cache_pkey;
ALTER TABLE company_context_cache ADD PRIMARY KEY (company_name);

-- Redefine match_knowledge_chunks to remove p_user_id filter
DROP FUNCTION IF EXISTS match_knowledge_chunks(UUID, vector(768), INT);

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
    (1 - (kc.embedding <=> query_embedding))::FLOAT AS similarity
  FROM knowledge_chunks kc
  JOIN knowledge_documents kd
    ON kd.id = kc.document_id
  WHERE kc.embedding IS NOT NULL
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
$$;
