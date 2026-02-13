-- ============================================================
-- Supabase Screenshot Deduplication Table
-- Tracks hash-to-path mappings for duplicate detection
-- ============================================================

-- Create screenshots table for deduplication
CREATE TABLE IF NOT EXISTS public.screenshot_hashes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  hash TEXT NOT NULL,
  path TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Composite unique constraint on workspace + hash
  CONSTRAINT unique_workspace_hash UNIQUE (workspace_id, hash)
);

-- Index for fast lookups by workspace + hash
CREATE INDEX IF NOT EXISTS idx_screenshot_hashes_workspace_hash
  ON public.screenshot_hashes (workspace_id, hash);

-- Index for cleanup by created_at
CREATE INDEX IF NOT EXISTS idx_screenshot_hashes_created_at
  ON public.screenshot_hashes (created_at);

-- Enable Row Level Security
ALTER TABLE public.screenshot_hashes ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do everything
CREATE POLICY "Service role has full access"
  ON public.screenshot_hashes
  FOR ALL
  TO service_role
  USING (true);

-- Policy: Authenticated users can only read their workspace
CREATE POLICY "Users can read own workspace"
  ON public.screenshot_hashes
  FOR SELECT
  TO authenticated
  USING (workspace_id = (current_setting('request.jwt.claims', true)::json->>'workspace_id')::uuid);

-- Function to clean up old screenshot records (matches lifecycle policy)
CREATE OR REPLACE FUNCTION public.cleanup_old_screenshot_hashes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.screenshot_hashes
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;

-- Add cleanup to the existing cron job (or create new one)
-- This runs with the storage cleanup job
SELECT cron.schedule(
  'cleanup-screenshot-hashes',
  '0 2 * * *',  -- Daily at 2 AM UTC
  $$SELECT public.cleanup_old_screenshot_hashes()$$
);

-- Grant necessary permissions
GRANT SELECT, INSERT, DELETE ON public.screenshot_hashes TO service_role;
GRANT USAGE ON SCHEMA public TO service_role;
