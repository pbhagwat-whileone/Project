-- Drop the old unique index that prevents multiple owners from importing the same connection
DROP INDEX IF EXISTS connections_user_id_profile_url_idx;

-- Create a new unique index that includes connection_owner_name
-- This allows the same profile_url to exist multiple times as long as it belongs to different owners
CREATE UNIQUE INDEX IF NOT EXISTS connections_user_id_profile_url_owner_idx 
ON connections (user_id, profile_url, connection_owner_name) 
WHERE profile_url IS NOT NULL;
