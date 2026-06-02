-- Cache inferred company metadata from Gemini (avoids repeated API calls)
CREATE TABLE IF NOT EXISTS company_industry_cache (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  industry TEXT,
  country TEXT,
  company_size TEXT,
  revenue_band TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, company_name)
);

CREATE INDEX IF NOT EXISTS idx_company_industry_cache_user
  ON company_industry_cache(user_id);

ALTER TABLE company_industry_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY company_industry_cache_all ON company_industry_cache
  FOR ALL USING (auth.uid() = user_id);
