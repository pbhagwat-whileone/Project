-- Create connection_profiles table for Tavily enrichment
CREATE TABLE public.connection_profiles (
    connection_id uuid PRIMARY KEY REFERENCES public.connections(id) ON DELETE CASCADE,
    location text,
    company text,
    position text,
    headline text,
    current_role_start_date text,
    certifications jsonb DEFAULT '[]'::jsonb,
    expertise_tags jsonb DEFAULT '[]'::jsonb,
    technology_tags jsonb DEFAULT '[]'::jsonb,
    activity_signals jsonb DEFAULT '[]'::jsonb,
    education jsonb DEFAULT '[]'::jsonb,
    raw_tavily_response jsonb,
    enriched_at timestamp with time zone DEFAULT now()
);

-- Add indexes
CREATE INDEX idx_connection_profiles_location ON public.connection_profiles(location);
CREATE INDEX idx_connection_profiles_company ON public.connection_profiles(company);
CREATE INDEX idx_connection_profiles_position ON public.connection_profiles(position);

-- Enable RLS
ALTER TABLE public.connection_profiles ENABLE ROW LEVEL SECURITY;

-- Policies for connection_profiles
CREATE POLICY "Users can view their own connection profiles"
    ON public.connection_profiles
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.connections
            WHERE connections.id = connection_profiles.connection_id
            AND connections.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own connection profiles"
    ON public.connection_profiles
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.connections
            WHERE connections.id = connection_profiles.connection_id
            AND connections.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own connection profiles"
    ON public.connection_profiles
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.connections
            WHERE connections.id = connection_profiles.connection_id
            AND connections.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.connections
            WHERE connections.id = connection_profiles.connection_id
            AND connections.user_id = auth.uid()
        )
    );
