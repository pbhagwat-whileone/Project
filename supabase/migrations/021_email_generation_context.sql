ALTER TABLE public.generated_emails 
ADD COLUMN generation_context JSONB DEFAULT NULL;
