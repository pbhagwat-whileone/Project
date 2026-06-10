-- Add connection_owner_name column with default
ALTER TABLE connections ADD COLUMN IF NOT EXISTS connection_owner_name TEXT NOT NULL DEFAULT 'Unknown';

-- Add index on user_id and connection_owner_name
CREATE INDEX IF NOT EXISTS idx_connections_owner ON connections(user_id, connection_owner_name);
