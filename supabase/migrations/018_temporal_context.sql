-- Add persistent_context and time_bound_context to connection_relationship_metrics
ALTER TABLE connection_relationship_metrics
ADD COLUMN persistent_context TEXT,
ADD COLUMN time_bound_context TEXT;
