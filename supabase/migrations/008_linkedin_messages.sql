-- LinkedIn Messages
CREATE TABLE IF NOT EXISTS linkedin_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL,
  from_profile_url TEXT,
  to_profile_url TEXT,
  date TIMESTAMPTZ,
  content TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Connection Relationship Metrics
CREATE TABLE IF NOT EXISTS connection_relationship_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_count INTEGER DEFAULT 0,
  conversation_count INTEGER DEFAULT 0,
  first_contact_date TIMESTAMPTZ,
  last_contact_date TIMESTAMPTZ,
  relationship_score INTEGER DEFAULT 0,
  conversation_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_linkedin_messages_user ON linkedin_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_messages_conversation ON linkedin_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_crm_user ON connection_relationship_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_connection ON connection_relationship_metrics(connection_id);

-- RLS
ALTER TABLE linkedin_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE connection_relationship_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY linkedin_messages_all
ON linkedin_messages
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY crm_all
ON connection_relationship_metrics
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
