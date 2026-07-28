-- Add parsed resume data and onboarding flag to the profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS parsed_data jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS onboarded boolean DEFAULT false;

-- Create an index for querying the parsed_data JSONB field by user id is already the PK.
CREATE INDEX IF NOT EXISTS idx_profiles_onboarded
ON public.profiles (onboarded);

-- Resumes table: metadata for files uploaded to Supabase Storage
CREATE TABLE IF NOT EXISTS public.resumes (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  file_size bigint NOT NULL,
  mime_type text NOT NULL,
  extracted_data jsonb DEFAULT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on the resumes table
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;

-- Users can view their own resumes
DROP POLICY IF EXISTS "Users can view own resumes" ON public.resumes;
CREATE POLICY "Users can view own resumes"
ON public.resumes FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own resumes
DROP POLICY IF EXISTS "Users can insert own resumes" ON public.resumes;
CREATE POLICY "Users can insert own resumes"
ON public.resumes FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own resumes
DROP POLICY IF EXISTS "Users can update own resumes" ON public.resumes;
CREATE POLICY "Users can update own resumes"
ON public.resumes FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own resumes
DROP POLICY IF EXISTS "Users can delete own resumes" ON public.resumes;
CREATE POLICY "Users can delete own resumes"
ON public.resumes FOR DELETE
USING (auth.uid() = user_id);

-- Create the storage bucket for resumes (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', false)
ON CONFLICT (id) DO NOTHING;

-- Users can only upload files into their own folder: {user_id}/{filename}
DROP POLICY IF EXISTS "Users can upload their own resume files" ON storage.objects;
CREATE POLICY "Users can upload their own resume files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'resumes'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can only read their own resume files
DROP POLICY IF EXISTS "Users can read their own resume files" ON storage.objects;
CREATE POLICY "Users can read their own resume files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'resumes'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can only delete their own resume files
DROP POLICY IF EXISTS "Users can delete their own resume files" ON storage.objects;
CREATE POLICY "Users can delete their own resume files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'resumes'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
