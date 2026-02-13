-- ============================================================
-- Supabase Visual Evidence Bucket Configuration
-- For storing visual test screenshots with deduplication
-- ============================================================

-- Create visual-evidence bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('visual-evidence', 'visual-evidence', true)
ON CONFLICT (id) DO NOTHING;

-- Update bucket configuration
UPDATE storage.buckets
SET public = true,
    file_size_limit = 10485760,  -- 10MB max
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp']
WHERE id = 'visual-evidence';

-- Note: screenshot_hashes table already exists from bug-attachments setup
-- and supports multiple buckets through bucket-specific paths
-- No schema changes needed - reuse existing table

-- Storage policies: Public read access
DROP POLICY IF EXISTS "Public read access for visual evidence" ON storage.objects;
CREATE POLICY "Public read access for visual evidence"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'visual-evidence');

-- Storage policies: Service role full access
DROP POLICY IF EXISTS "Service role has full access to visual evidence" ON storage.objects;
CREATE POLICY "Service role has full access to visual evidence"
  ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'visual-evidence');

-- Lifecycle policy: 30-day retention
-- Delete visual evidence screenshots older than 30 days
-- NOTE: This function requires storage schema access - run via Supabase Dashboard SQL Editor
--       or with service_role permissions
CREATE OR REPLACE FUNCTION storage.delete_old_visual_evidence()
RETURNS void AS $$
BEGIN
  DELETE FROM storage.objects
  WHERE bucket_id = 'visual-evidence'
  AND created_at < NOW() - INTERVAL '30 days';

  -- Also clean up corresponding screenshot_hashes records
  DELETE FROM public.screenshot_hashes
  WHERE path LIKE '%/visual/%'
  AND created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup (daily at 3 AM UTC, offset from bug-attachments cleanup at 2 AM)
-- NOTE: Run this after creating the function above
SELECT cron.schedule('delete-old-visual-evidence', '0 3 * * *',
  $$SELECT storage.delete_old_visual_evidence()$$);

-- Verification queries:
-- SELECT * FROM storage.buckets WHERE id = 'visual-evidence';
-- SELECT COUNT(*) FROM screenshot_hashes WHERE path LIKE '%/visual/%';
