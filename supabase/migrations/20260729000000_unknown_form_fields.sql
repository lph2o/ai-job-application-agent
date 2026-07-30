-- Add unknown form fields tracking columns for bot-failed submissions
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS unknown_form_fields jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS unknown_field_answers jsonb DEFAULT '{}'::jsonb;
