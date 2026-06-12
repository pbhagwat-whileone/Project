ALTER TABLE knowledge_documents
ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'document';
