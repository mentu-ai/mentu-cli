-- ============================================================
-- Supabase Storage Lifecycle Policy
-- Automatically delete bug screenshots older than 30 days
-- ============================================================

-- Enable RLS (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create function to delete old screenshots
CREATE OR REPLACE FUNCTION storage.delete_old_screenshots()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM storage.objects
  WHERE bucket_id = 'bug-attachments'
  AND created_at < NOW() - INTERVAL '30 days';
END;
$$;

-- Create scheduled job (runs daily at 2 AM UTC)
-- Note: Requires pg_cron extension
SELECT cron.schedule(
  'delete-old-screenshots',     -- Job name
  '0 2 * * *',                  -- Cron schedule (daily at 2 AM)
  $$SELECT storage.delete_old_screenshots()$$
);

-- Manual execution (for testing)
-- SELECT storage.delete_old_screenshots();

-- Check scheduled jobs
-- SELECT * FROM cron.job WHERE jobname = 'delete-old-screenshots';

-- Unschedule (if needed)
-- SELECT cron.unschedule('delete-old-screenshots');
