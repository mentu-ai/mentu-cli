-- ============================================================
-- Supabase Storage Bucket Configuration
-- Configure bug-attachments bucket with proper cache headers
-- ============================================================

-- Update bucket to be public with cache control
UPDATE storage.buckets
SET public = true,
    file_size_limit = 10485760,  -- 10MB max
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
WHERE id = 'bug-attachments';

-- Note: Cache-Control headers for Supabase Storage are set via bucket configuration
-- This must be done in the Supabase Dashboard under Storage > bug-attachments > Settings
--
-- Recommended settings:
--   Cache Control: public, max-age=3600, immutable
--   Max File Size: 10MB
--   Allowed MIME types: image/png, image/jpeg, image/webp, image/gif
--   Public: Yes

-- Storage policies (if not already created)
-- Allow public read access to all files
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
CREATE POLICY "Public read access"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'bug-attachments');

-- Allow service role to insert/update/delete
DROP POLICY IF EXISTS "Service role has full access" ON storage.objects;
CREATE POLICY "Service role has full access"
  ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'bug-attachments');

-- Alternative: Set cache headers via Edge Function (if bucket config not available)
-- This would require creating an Edge Function to proxy image requests
-- and set custom headers, but adds latency and complexity.
