CREATE TABLE company_context_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT UNIQUE NOT NULL,
  summary TEXT,
  raw_context TEXT,
  generated_context JSONB,
  sources TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE company_context_cache ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read/write for now
CREATE POLICY "Allow all authenticated users to select company context cache" 
  ON company_context_cache FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Allow all authenticated users to insert company context cache" 
  ON company_context_cache FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

CREATE POLICY "Allow all authenticated users to update company context cache" 
  ON company_context_cache FOR UPDATE 
  TO authenticated 
  USING (true);

-- Index for fast lookup
CREATE INDEX company_context_cache_company_name_idx ON company_context_cache(company_name);
