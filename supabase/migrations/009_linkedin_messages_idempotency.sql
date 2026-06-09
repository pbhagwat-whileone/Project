-- Add message_hash column
ALTER TABLE linkedin_messages ADD COLUMN message_hash TEXT;

-- Generate hashes for existing rows
UPDATE linkedin_messages
SET message_hash = encode(digest(
  conversation_id || COALESCE(from_profile_url, '') || COALESCE(to_profile_url, '') || date::text || COALESCE(content, ''), 
  'sha256'
), 'hex')
WHERE message_hash IS NULL;

-- Remove duplicate copies, keeping the oldest row
DELETE FROM linkedin_messages a
USING linkedin_messages b
WHERE a.user_id = b.user_id
  AND a.message_hash = b.message_hash
  AND a.id > b.id;

-- Make message_hash NOT NULL and add unique constraint
ALTER TABLE linkedin_messages ALTER COLUMN message_hash SET NOT NULL;
ALTER TABLE linkedin_messages ADD CONSTRAINT unique_user_message_hash UNIQUE(user_id, message_hash);
