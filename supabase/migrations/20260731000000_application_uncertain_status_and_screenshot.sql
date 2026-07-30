-- Add columns to support the new "uncertain" application status and final screenshot capture
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS application_screenshot_url text,
ADD COLUMN IF NOT EXISTS application_final_url text,
ADD COLUMN IF NOT EXISTS application_final_title text;

-- Add a check constraint to ensure application_status values are valid.
-- Using a separate statement with NOT VALID to avoid locking existing rows.
ALTER TABLE jobs
DROP CONSTRAINT IF EXISTS jobs_application_status_check;

ALTER TABLE jobs
ADD CONSTRAINT jobs_application_status_check
CHECK (application_status IS NULL OR application_status IN (
  'idle',
  'detecting_fields',
  'missing_profile_info',
  'applying',
  'applied',
  'needs_human_verification',
  'unknown_form_fields',
  'failed',
  'uncertain'
));

-- Add a comment documenting the expected application_status values including the new "uncertain" state
COMMENT ON COLUMN jobs.application_status IS 'idle | detecting_fields | missing_profile_info | applying | applied | needs_human_verification | unknown_form_fields | failed | uncertain';
