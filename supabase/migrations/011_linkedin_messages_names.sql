-- Add sender and recipient names to linkedin_messages
ALTER TABLE linkedin_messages
ADD COLUMN from_name TEXT,
ADD COLUMN to_name TEXT;
