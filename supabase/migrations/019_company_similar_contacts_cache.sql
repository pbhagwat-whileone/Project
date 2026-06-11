-- Create company similar contacts cache table
CREATE TABLE company_similar_contacts_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    results JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, company_name)
);

-- RLS policies
ALTER TABLE company_similar_contacts_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own similar contacts cache"
    ON company_similar_contacts_cache
    FOR ALL
    USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_company_similar_contacts_cache_lookup 
ON company_similar_contacts_cache(user_id, company_name, created_at);
