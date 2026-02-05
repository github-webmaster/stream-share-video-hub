-- Add chunked upload support
-- This migration adds tables for tracking upload sessions and chunks

-- Upload sessions track the overall upload process
CREATE TABLE IF NOT EXISTS public.upload_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  filename TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mimetype TEXT NOT NULL,
  total_chunks INTEGER NOT NULL,
  chunks_uploaded INTEGER NOT NULL DEFAULT 0,
  storage_path TEXT, -- Final storage path after completion
  share_id TEXT UNIQUE, -- Generated on session start, used in final video
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'uploading', 'assembling', 'completed', 'failed', 'cancelled')),
  quota_reserved BOOLEAN NOT NULL DEFAULT false, -- Track if quota was reserved
  reserved_bytes BIGINT NOT NULL DEFAULT 0, -- Amount of quota reserved
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '24 hours'), -- Sessions expire after 24 hours
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT
);

-- Upload chunks track individual pieces
CREATE TABLE IF NOT EXISTS public.upload_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.upload_sessions(id) ON DELETE CASCADE NOT NULL,
  chunk_number INTEGER NOT NULL,
  chunk_size BIGINT NOT NULL,
  storage_path TEXT NOT NULL, -- Temporary storage location
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (session_id, chunk_number)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_upload_sessions_user_id ON public.upload_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_status ON public.upload_sessions (status);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_expires_at ON public.upload_sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_upload_chunks_session_id ON public.upload_chunks (session_id);

-- Trigger to update updated_at timestamp
DROP TRIGGER IF EXISTS update_upload_sessions_updated_at ON public.upload_sessions;
CREATE TRIGGER update_upload_sessions_updated_at
BEFORE UPDATE ON public.upload_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to cleanup expired upload sessions
CREATE OR REPLACE FUNCTION public.cleanup_expired_upload_sessions()
RETURNS void AS $$
DECLARE
  expired_session RECORD;
  freed_bytes BIGINT;
BEGIN
  freed_bytes := 0;
  
  -- Find and cleanup expired sessions
  FOR expired_session IN 
    SELECT id, user_id, reserved_bytes, quota_reserved, status
    FROM public.upload_sessions
    WHERE expires_at < now() 
      AND status NOT IN ('completed', 'cancelled')
  LOOP
    -- Free quota if it was reserved
    IF expired_session.quota_reserved AND expired_session.reserved_bytes > 0 THEN
      UPDATE public.user_quotas
      SET storage_used_bytes = GREATEST(0, storage_used_bytes - expired_session.reserved_bytes)
      WHERE user_id = expired_session.user_id;
      freed_bytes := freed_bytes + expired_session.reserved_bytes;
    END IF;
    
    -- Mark session as cancelled
    UPDATE public.upload_sessions
    SET status = 'cancelled',
        error_message = 'Session expired'
    WHERE id = expired_session.id;
  END LOOP;
  
  -- Delete chunks for cancelled/expired sessions older than 1 day
  DELETE FROM public.upload_chunks
  WHERE session_id IN (
    SELECT id FROM public.upload_sessions
    WHERE status IN ('cancelled', 'failed')
      AND updated_at < (now() - INTERVAL '1 day')
  );
  
  -- Delete old cancelled/failed sessions (older than 7 days)
  DELETE FROM public.upload_sessions
  WHERE status IN ('cancelled', 'failed')
    AND updated_at < (now() - INTERVAL '7 days');
    
  RAISE NOTICE 'Cleaned up expired sessions, freed % bytes', freed_bytes;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE public.upload_sessions IS 'Tracks chunked upload sessions for resumable uploads';
COMMENT ON TABLE public.upload_chunks IS 'Stores metadata for individual chunks of a chunked upload';
COMMENT ON COLUMN public.upload_sessions.quota_reserved IS 'Whether quota was reserved for this upload';
COMMENT ON COLUMN public.upload_sessions.reserved_bytes IS 'Amount of quota reserved (to be freed on failure/cancel)';
COMMENT ON FUNCTION public.cleanup_expired_upload_sessions IS 'Cleans up expired sessions and frees reserved quota';
