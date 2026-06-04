-- Migration to ensure profile_url uniqueness for each user
-- Note: It handles profile_url IS NULL gracefully by ignoring them

CREATE UNIQUE INDEX IF NOT EXISTS connections_user_id_profile_url_idx 
ON connections (user_id, profile_url) 
WHERE profile_url IS NOT NULL;
