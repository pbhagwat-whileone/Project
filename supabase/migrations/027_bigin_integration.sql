-- Create Bigin tables

CREATE TABLE IF NOT EXISTS bigin_contact_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
    bigin_contact_id VARCHAR(255) NOT NULL UNIQUE,
    user_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(connection_id)
);

CREATE TABLE IF NOT EXISTS bigin_raw_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    module_name VARCHAR(100) NOT NULL, -- Contacts, Deals, Notes, Activities
    bigin_record_id VARCHAR(255) NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(module_name, bigin_record_id)
);

CREATE TABLE IF NOT EXISTS bigin_sync_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    module_name VARCHAR(100) NOT NULL UNIQUE,
    last_sync_time TIMESTAMPTZ,
    next_page_token VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Extend connection_relationship_metrics
ALTER TABLE connection_relationship_metrics
ADD COLUMN IF NOT EXISTS crm_context JSONB,
ADD COLUMN IF NOT EXISTS crm_summary TEXT,
ADD COLUMN IF NOT EXISTS last_crm_sync TIMESTAMPTZ;
