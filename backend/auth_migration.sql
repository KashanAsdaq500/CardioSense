-- ====================================================================
-- CardioSense Clerk Authentication Compatibility Migration
-- ====================================================================
-- Description:
-- Adds the `user_id` column and index to `public.ecg_analyses` to support
-- Clerk user identification.
--
-- Architecture Note:
-- Authentication is handled by Clerk (not Supabase Auth).
-- Client requests pass verified Clerk session JWTs to the FastAPI backend,
-- which cryptographically validates the token, extracts the Clerk user ID,
-- and strictly filters database operations using `.eq("user_id", authenticated_clerk_user_id)`.
--
-- Safety & Preservation:
-- 1. Does NOT drop or recreate the `ecg_analyses` table.
-- 2. Preserves all existing historical records where `user_id` is NULL.
-- 3. Idempotent: Uses `IF NOT EXISTS` and safe policy cleanup.
-- ====================================================================

-- 1. Add user_id column safely without modifying or deleting existing records
ALTER TABLE public.ecg_analyses
ADD COLUMN IF NOT EXISTS user_id text;

-- 2. Create index on (user_id, created_at DESC) for fast filtered history queries
CREATE INDEX IF NOT EXISTS idx_ecg_analyses_user_id_created_at
ON public.ecg_analyses (user_id, created_at DESC);

-- 3. Enable Row Level Security (RLS) on public.ecg_analyses
ALTER TABLE public.ecg_analyses ENABLE ROW LEVEL SECURITY;

-- 4. Clean up any existing incompatible or legacy policies
DROP POLICY IF EXISTS "Users can read own analyses" ON public.ecg_analyses;
DROP POLICY IF EXISTS "Users can insert own analyses" ON public.ecg_analyses;
DROP POLICY IF EXISTS "Enable read access for ecg_analyses" ON public.ecg_analyses;
DROP POLICY IF EXISTS "Enable insert access for ecg_analyses" ON public.ecg_analyses;
DROP POLICY IF EXISTS "Enable select for CardioSense backend" ON public.ecg_analyses;
DROP POLICY IF EXISTS "Enable insert for CardioSense backend" ON public.ecg_analyses;

-- 5. Policies compatible with Clerk-authenticated backend operations
-- Allows the backend API (using anon/authenticated role) to insert analyses with Clerk user_id
CREATE POLICY "Enable insert for CardioSense backend"
ON public.ecg_analyses
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Allows the backend API to select analyses
-- The FastAPI backend strictly enforces user isolation via: .eq("user_id", authenticated_clerk_user_id)
-- Also preserves read access to legacy pre-auth records where user_id IS NULL
CREATE POLICY "Enable select for CardioSense backend"
ON public.ecg_analyses
FOR SELECT
TO anon, authenticated
USING (true);
