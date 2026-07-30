-- Add automation and AI agent tracking fields to jobs table
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS application_status text DEFAULT 'idle',
ADD COLUMN IF NOT EXISTS missing_fields jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS detected_fields jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS browserbase_session_id text,
ADD COLUMN IF NOT EXISTS browserbase_debug_url text,
ADD COLUMN IF NOT EXISTS application_error text;
