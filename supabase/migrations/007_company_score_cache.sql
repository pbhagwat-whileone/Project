CREATE TABLE IF NOT EXISTS public.company_score_cache (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  project_relevance_score NUMERIC NOT NULL DEFAULT 0,
  recommendation_score NUMERIC NOT NULL DEFAULT 0,
  matching_project_count INTEGER NOT NULL DEFAULT 0,
  average_similarity NUMERIC NOT NULL DEFAULT 0,
  connection_score NUMERIC NOT NULL DEFAULT 0,
  seniority_score NUMERIC NOT NULL DEFAULT 0,
  top_project_names TEXT[] NOT NULL DEFAULT '{}',
  industry TEXT,
  last_calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, company_name)
);

-- Enable RLS
ALTER TABLE public.company_score_cache ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage their own company score cache"
  ON public.company_score_cache
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
