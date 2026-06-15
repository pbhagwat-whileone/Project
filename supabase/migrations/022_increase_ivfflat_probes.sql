-- The dataset is small enough that an ivfflat index is unnecessary and actively harms recall
-- by partitioning the data into too many lists. 
-- Furthermore, Supabase restricts setting ivfflat.probes on some roles.
-- Dropping the index forces an exact KNN search which is 100% accurate and blazing fast for < 100k rows.

DROP INDEX IF EXISTS idx_knowledge_chunks_embedding;
