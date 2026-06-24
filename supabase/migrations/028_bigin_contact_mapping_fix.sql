-- Drop the existing unique constraint on connection_id
ALTER TABLE bigin_contact_mapping DROP CONSTRAINT IF EXISTS bigin_contact_mapping_connection_id_key;

-- Add the new unique constraint allowing multiple contacts per connection but preventing exact duplicates
ALTER TABLE bigin_contact_mapping ADD CONSTRAINT bigin_contact_mapping_connection_contact_key UNIQUE (connection_id, bigin_contact_id);
