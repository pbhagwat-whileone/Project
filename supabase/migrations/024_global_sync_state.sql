CREATE TABLE IF NOT EXISTS global_sync_state (
  id INT PRIMARY KEY DEFAULT 1,
  last_successful_sync TIMESTAMPTZ,
  sync_in_progress BOOLEAN DEFAULT false,
  sync_start_timestamp TIMESTAMPTZ,
  CHECK (id = 1)
);

INSERT INTO global_sync_state (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION acquire_sync_lock()
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  locked boolean;
BEGIN
  -- try to update if not in progress or if stuck for > 1 hour
  UPDATE global_sync_state 
  SET sync_in_progress = true, sync_start_timestamp = NOW()
  WHERE id = 1 AND (sync_in_progress = false OR sync_start_timestamp < NOW() - INTERVAL '1 hour')
  RETURNING true INTO locked;
  
  IF locked THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;
