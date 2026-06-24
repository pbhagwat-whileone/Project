-- Add case_studies_sheet_url to user_settings
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS case_studies_sheet_url TEXT;

-- Create case_studies_sheet_cache table
CREATE TABLE IF NOT EXISTS case_studies_sheet_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sheet_url TEXT NOT NULL,
  parsed_content JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_synced TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_modified TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, sheet_url)
);

-- Enable RLS
ALTER TABLE case_studies_sheet_cache ENABLE ROW LEVEL SECURITY;

-- Add RLS policy
CREATE POLICY case_studies_sheet_cache_all
ON case_studies_sheet_cache
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add index
CREATE INDEX IF NOT EXISTS idx_case_studies_sheet_cache_user
  ON case_studies_sheet_cache(user_id);
