ALTER TABLE connection_relationship_metrics
ADD COLUMN IF NOT EXISTS key_interests JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS business_context TEXT,
ADD COLUMN IF NOT EXISTS action_items JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS engagement_quality TEXT,
ADD COLUMN IF NOT EXISTS recommended_outreach_angle TEXT,
ADD COLUMN IF NOT EXISTS personalization_points JSONB DEFAULT '[]'::jsonb;
