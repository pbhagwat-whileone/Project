-- Migrate user_settings from single folder to multiple folders

-- Step 1: Add the new column
ALTER TABLE user_settings
ADD COLUMN google_drive_folder_ids TEXT[];

-- Step 2: Migrate existing data (wrap the single string in an array)
UPDATE user_settings
SET google_drive_folder_ids = ARRAY[google_drive_folder_id]
WHERE google_drive_folder_id IS NOT NULL AND google_drive_folder_id != '';

-- Step 3: Set default empty array for nulls if desired, but we can just leave it as null
-- Step 4: Drop the old column
ALTER TABLE user_settings
DROP COLUMN google_drive_folder_id;
