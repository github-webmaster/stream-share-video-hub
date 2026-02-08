-- Migration: Add video expiration feature
-- Default: 60 days for all users, adjustable per-user

-- Add global video expiration setting to storage_config
ALTER TABLE public.storage_config 
ADD COLUMN IF NOT EXISTS video_expiration_days INTEGER DEFAULT 60;

-- Add expires_at to videos table
ALTER TABLE public.videos 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- Add user-specific expiration override to user_quotas
-- NULL = use global default
-- 0 = never expire
-- > 0 = specific days
ALTER TABLE public.user_quotas 
ADD COLUMN IF NOT EXISTS video_expiration_days INTEGER DEFAULT NULL;

-- Create index for efficient expired video queries
CREATE INDEX IF NOT EXISTS idx_videos_expires_at ON public.videos (expires_at) WHERE expires_at IS NOT NULL;

-- Function to cleanup expired videos and free storage
CREATE OR REPLACE FUNCTION public.cleanup_expired_videos()
RETURNS TABLE(deleted_count INTEGER, freed_bytes BIGINT) AS $$
DECLARE
  expired_video RECORD;
  total_deleted INTEGER := 0;
  total_freed BIGINT := 0;
BEGIN
  -- Find and mark expired videos for deletion
  FOR expired_video IN 
    SELECT v.id, v.user_id, v.size, v.storage_path
    FROM public.videos v
    WHERE v.expires_at IS NOT NULL 
      AND v.expires_at < now()
  LOOP
    -- Update user quota
    IF expired_video.size IS NOT NULL AND expired_video.size > 0 THEN
      UPDATE public.user_quotas 
      SET storage_used_bytes = GREATEST(0, storage_used_bytes - expired_video.size),
          updated_at = now()
      WHERE user_id = expired_video.user_id;
      total_freed := total_freed + expired_video.size;
    END IF;
    
    -- Delete the video record (files cleaned up by application)
    DELETE FROM public.videos WHERE id = expired_video.id;
    total_deleted := total_deleted + 1;
  END LOOP;
  
  deleted_count := total_deleted;
  freed_bytes := total_freed;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.cleanup_expired_videos IS 'Deletes expired videos and frees storage quota. Returns count and bytes freed.';

-- Update existing videos to have expiration based on current global setting
-- This sets expires_at for all existing videos based on their created_at + global default
DO $$
DECLARE
  global_expiry INTEGER;
BEGIN
  SELECT COALESCE(video_expiration_days, 60) INTO global_expiry FROM public.storage_config LIMIT 1;
  
  IF global_expiry > 0 THEN
    UPDATE public.videos 
    SET expires_at = created_at + (global_expiry || ' days')::INTERVAL
    WHERE expires_at IS NULL;
  END IF;
END $$;
