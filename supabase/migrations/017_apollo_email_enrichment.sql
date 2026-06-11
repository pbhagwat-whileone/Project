-- Add email tracking metadata columns to connections table
ALTER TABLE public.connections
ADD COLUMN IF NOT EXISTS email_source text,
ADD COLUMN IF NOT EXISTS email_status text,
ADD COLUMN IF NOT EXISTS email_confidence numeric,
ADD COLUMN IF NOT EXISTS email_last_enriched_at timestamp with time zone;
