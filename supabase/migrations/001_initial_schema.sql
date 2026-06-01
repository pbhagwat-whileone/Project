-- Extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User settings (Drive folder override)
CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  google_drive_folder_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Google OAuth tokens for Drive API
CREATE TABLE IF NOT EXISTS google_tokens (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expiry TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_file_id TEXT NOT NULL,
  document_name TEXT NOT NULL,
  last_modified TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'synced', 'error')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, google_file_id)
);

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  project_name TEXT,
  industry TEXT,
  embedding vector(768),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  company TEXT,
  position TEXT,
  email TEXT,
  profile_url TEXT,
  connected_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  website TEXT,
  country TEXT,
  industry TEXT,
  revenue_range TEXT,
  employee_count TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'Researching'
    CHECK (
      status IN (
        'Researching',
        'Qualified',
        'Outreach Planned',
        'Contacted',
        'Won',
        'Lost'
      )
    ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prospect_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  analysis TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS generated_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  documents_processed INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL
    CHECK (status IN ('success', 'error', 'partial')),
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_user
  ON knowledge_documents(user_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_status
  ON knowledge_documents(status);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_document
  ON knowledge_chunks(document_id);

CREATE INDEX IF NOT EXISTS idx_connections_user
  ON connections(user_id);

CREATE INDEX IF NOT EXISTS idx_connections_company
  ON connections(user_id, company);

CREATE INDEX IF NOT EXISTS idx_prospects_user
  ON prospects(user_id);

CREATE INDEX IF NOT EXISTS idx_prospects_status
  ON prospects(user_id, status);

CREATE INDEX IF NOT EXISTS idx_prospect_analysis_prospect
  ON prospect_analysis(prospect_id);

CREATE INDEX IF NOT EXISTS idx_generated_emails_user
  ON generated_emails(user_id);

CREATE INDEX IF NOT EXISTS idx_sync_logs_user
  ON sync_logs(user_id, created_at DESC);

-- Vector similarity index
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding
ON knowledge_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Vector search function
CREATE OR REPLACE FUNCTION match_knowledge_chunks(
  p_user_id UUID,
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
  WHERE kd.user_id = p_user_id
    AND kc.embedding IS NOT NULL
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    full_name
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      ''
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION handle_new_user();

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY profiles_select
ON profiles
FOR SELECT
USING (auth.uid() = id);

CREATE POLICY profiles_update
ON profiles
FOR UPDATE
USING (auth.uid() = id);

-- User Settings
CREATE POLICY user_settings_all
ON user_settings
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Google Tokens
CREATE POLICY google_tokens_all
ON google_tokens
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Knowledge Documents
CREATE POLICY knowledge_documents_all
ON knowledge_documents
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Knowledge Chunks
CREATE POLICY knowledge_chunks_select
ON knowledge_chunks
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM knowledge_documents kd
    WHERE kd.id = knowledge_chunks.document_id
      AND kd.user_id = auth.uid()
  )
);

CREATE POLICY knowledge_chunks_insert
ON knowledge_chunks
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM knowledge_documents kd
    WHERE kd.id = knowledge_chunks.document_id
      AND kd.user_id = auth.uid()
  )
);

CREATE POLICY knowledge_chunks_delete
ON knowledge_chunks
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM knowledge_documents kd
    WHERE kd.id = knowledge_chunks.document_id
      AND kd.user_id = auth.uid()
  )
);

-- Connections
CREATE POLICY connections_all
ON connections
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Prospects
CREATE POLICY prospects_all
ON prospects
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Prospect Analysis
CREATE POLICY prospect_analysis_all
ON prospect_analysis
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM prospects p
    WHERE p.id = prospect_analysis.prospect_id
      AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM prospects p
    WHERE p.id = prospect_analysis.prospect_id
      AND p.user_id = auth.uid()
  )
);

-- Generated Emails
CREATE POLICY generated_emails_all
ON generated_emails
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Sync Logs
CREATE POLICY sync_logs_all
ON sync_logs
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);