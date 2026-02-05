CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  default_visibility TEXT NOT NULL DEFAULT 'public' CHECK (default_visibility IN ('public', 'private')),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.storage_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'local',
  storj_access_key TEXT,
  storj_secret_key TEXT,
  storj_endpoint TEXT DEFAULT 'https://gateway.storjshare.io',
  storj_bucket TEXT,
  max_file_size_mb INTEGER NOT NULL DEFAULT 500,
  allowed_types TEXT[] NOT NULL DEFAULT ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  storage_used_bytes BIGINT NOT NULL DEFAULT 0,
  storage_limit_bytes BIGINT NOT NULL DEFAULT 536870912,
  upload_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT 'Untitled',
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  share_id TEXT NOT NULL UNIQUE,
  views INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  size BIGINT,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private'))
);

CREATE INDEX IF NOT EXISTS idx_videos_user_id ON public.videos (user_id);
CREATE INDEX IF NOT EXISTS idx_videos_share_id ON public.videos (share_id);

-- Composite index to support efficient listing and range queries for a user's videos
CREATE INDEX IF NOT EXISTS idx_videos_user_created_at_desc ON public.videos (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_user_created_at ON public.videos (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_videos_user_visibility ON public.videos (user_id, visibility);

-- ==================== CHUNKED UPLOAD TABLES ====================
-- Upload sessions track the overall upload process
CREATE TABLE IF NOT EXISTS public.upload_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  filename TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mimetype TEXT NOT NULL,
  total_chunks INTEGER NOT NULL,
  chunks_uploaded INTEGER NOT NULL DEFAULT 0,
  storage_path TEXT,
  share_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'uploading', 'assembling', 'completed', 'failed', 'cancelled')),
  quota_reserved BOOLEAN NOT NULL DEFAULT false,
  reserved_bytes BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT
);

-- Upload chunks track individual pieces
CREATE TABLE IF NOT EXISTS public.upload_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.upload_sessions(id) ON DELETE CASCADE NOT NULL,
  chunk_number INTEGER NOT NULL,
  chunk_size BIGINT NOT NULL,
  storage_path TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (session_id, chunk_number)
);

-- Indexes for chunked uploads
CREATE INDEX IF NOT EXISTS idx_upload_sessions_user_id ON public.upload_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_status ON public.upload_sessions (status);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_expires_at ON public.upload_sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_upload_chunks_session_id ON public.upload_chunks (session_id);

-- Function to cleanup expired upload sessions
CREATE OR REPLACE FUNCTION public.cleanup_expired_upload_sessions()
RETURNS void AS $$
DECLARE
  expired_session RECORD;
  freed_bytes BIGINT;
BEGIN
  freed_bytes := 0;
  
  FOR expired_session IN 
    SELECT id, user_id, reserved_bytes, quota_reserved, status
    FROM public.upload_sessions
    WHERE expires_at < now() 
      AND status NOT IN ('completed', 'cancelled')
  LOOP
    IF expired_session.quota_reserved AND expired_session.reserved_bytes > 0 THEN
      UPDATE public.user_quotas
      SET storage_used_bytes = GREATEST(0, storage_used_bytes - expired_session.reserved_bytes)
      WHERE user_id = expired_session.user_id;
      freed_bytes := freed_bytes + expired_session.reserved_bytes;
    END IF;
    
    UPDATE public.upload_sessions
    SET status = 'cancelled',
        error_message = 'Session expired'
    WHERE id = expired_session.id;
  END LOOP;
  
  DELETE FROM public.upload_chunks
  WHERE session_id IN (
    SELECT id FROM public.upload_sessions
    WHERE status IN ('cancelled', 'failed')
      AND updated_at < (now() - INTERVAL '1 day')
  );
  
  DELETE FROM public.upload_sessions
  WHERE status IN ('cancelled', 'failed')
    AND updated_at < (now() - INTERVAL '7 days');
END;
$$ LANGUAGE plpgsql;

-- Function to reconcile storage quotas based on actual videos
CREATE OR REPLACE FUNCTION public.reconcile_user_storage()
RETURNS void AS $$
BEGIN
  -- Update each user's storage_used_bytes to match actual video sizes
  UPDATE public.user_quotas uq
  SET storage_used_bytes = COALESCE(
    (SELECT COALESCE(SUM(size), 0) FROM public.videos WHERE user_id = uq.user_id),
    0
  )
  WHERE user_id IN (SELECT DISTINCT user_id FROM public.videos);
  
  -- Also update users with no videos
  UPDATE public.user_quotas
  SET storage_used_bytes = 0
  WHERE user_id NOT IN (SELECT DISTINCT user_id FROM public.videos) 
    AND storage_used_bytes != 0;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_videos_updated_at ON public.videos;
CREATE TRIGGER update_videos_updated_at
BEFORE UPDATE ON public.videos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_storage_config_updated_at ON public.storage_config;
CREATE TRIGGER update_storage_config_updated_at
BEFORE UPDATE ON public.storage_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_quotas_updated_at ON public.user_quotas;
CREATE TRIGGER update_user_quotas_updated_at
BEFORE UPDATE ON public.user_quotas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_upload_sessions_updated_at ON public.upload_sessions;
CREATE TRIGGER update_upload_sessions_updated_at
BEFORE UPDATE ON public.upload_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.storage_config (provider)
SELECT 'local'
WHERE NOT EXISTS (SELECT 1 FROM public.storage_config);
