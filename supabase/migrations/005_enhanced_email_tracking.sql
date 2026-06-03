ALTER TABLE generated_emails
ADD COLUMN provider_used text DEFAULT 'gemini',
ADD COLUMN relationship_type text DEFAULT 'Unknown Relationship',
ADD COLUMN edited_content text,
ADD COLUMN refinement_history jsonb DEFAULT '[]'::jsonb;
