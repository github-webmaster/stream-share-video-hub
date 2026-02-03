-- Create app role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table for role management
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
USING (public.is_admin(auth.uid()));

-- Create storage_config table for STORJ settings (admin only)
CREATE TABLE public.storage_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL DEFAULT 'supabase',
    storj_access_key TEXT,
    storj_secret_key TEXT,
    storj_endpoint TEXT DEFAULT 'https://gateway.storjshare.io',
    storj_bucket TEXT,
    max_file_size_mb INTEGER NOT NULL DEFAULT 500,
    allowed_types TEXT[] DEFAULT ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'],
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.storage_config ENABLE ROW LEVEL SECURITY;

-- Only admins can view/modify storage config
CREATE POLICY "Admins can manage storage config"
ON public.storage_config
FOR ALL
USING (public.is_admin(auth.uid()));

-- Create upload_progress table for tracking uploads
CREATE TABLE public.upload_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    filename TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    bytes_uploaded BIGINT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    storage_provider TEXT NOT NULL DEFAULT 'supabase',
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.upload_progress ENABLE ROW LEVEL SECURITY;

-- Users can view their own upload progress
CREATE POLICY "Users can view own upload progress"
ON public.upload_progress
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own upload progress
CREATE POLICY "Users can create upload progress"
ON public.upload_progress
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own upload progress
CREATE POLICY "Users can update own upload progress"
ON public.upload_progress
FOR UPDATE
USING (auth.uid() = user_id);

-- Create user_quotas table for storage limits
CREATE TABLE public.user_quotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    storage_used_bytes BIGINT NOT NULL DEFAULT 0,
    storage_limit_bytes BIGINT NOT NULL DEFAULT 5368709120, -- 5GB default
    upload_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_quotas ENABLE ROW LEVEL SECURITY;

-- Users can view their own quota
CREATE POLICY "Users can view own quota"
ON public.user_quotas
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all quotas
CREATE POLICY "Admins can view all quotas"
ON public.user_quotas
FOR SELECT
USING (public.is_admin(auth.uid()));

-- Admins can manage quotas
CREATE POLICY "Admins can manage quotas"
ON public.user_quotas
FOR ALL
USING (public.is_admin(auth.uid()));

-- Function to automatically assign admin to first user
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INTEGER;
BEGIN
  -- Count existing users
  SELECT COUNT(*) INTO user_count FROM auth.users;
  
  -- First user gets admin role, others get user role
  IF user_count <= 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;
  
  -- Create quota record for new user
  INSERT INTO public.user_quotas (user_id) VALUES (NEW.id);
  
  RETURN NEW;
END;
$$;

-- Trigger to run on new user signup
CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- Function to get storage config (for edge functions)
CREATE OR REPLACE FUNCTION public.get_storage_config()
RETURNS TABLE (
  provider TEXT,
  storj_access_key TEXT,
  storj_secret_key TEXT,
  storj_endpoint TEXT,
  storj_bucket TEXT,
  max_file_size_mb INTEGER,
  allowed_types TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sc.provider,
    sc.storj_access_key,
    sc.storj_secret_key,
    sc.storj_endpoint,
    sc.storj_bucket,
    sc.max_file_size_mb,
    sc.allowed_types
  FROM public.storage_config sc
  LIMIT 1;
END;
$$;

-- Function to update user quota after upload
CREATE OR REPLACE FUNCTION public.update_user_quota(
  _user_id UUID,
  _bytes_added BIGINT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_quotas
  SET 
    storage_used_bytes = storage_used_bytes + _bytes_added,
    upload_count = upload_count + 1,
    updated_at = now()
  WHERE user_id = _user_id;
  
  RETURN TRUE;
END;
$$;

-- Function to check if user has quota available
CREATE OR REPLACE FUNCTION public.check_user_quota(
  _user_id UUID,
  _file_size BIGINT
)
RETURNS TABLE (
  has_quota BOOLEAN,
  storage_used BIGINT,
  storage_limit BIGINT,
  remaining BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (uq.storage_used_bytes + _file_size) <= uq.storage_limit_bytes AS has_quota,
    uq.storage_used_bytes AS storage_used,
    uq.storage_limit_bytes AS storage_limit,
    uq.storage_limit_bytes - uq.storage_used_bytes AS remaining
  FROM public.user_quotas uq
  WHERE uq.user_id = _user_id;
END;
$$;

-- Insert default storage config (using Supabase as fallback)
INSERT INTO public.storage_config (provider) VALUES ('supabase');

-- Update trigger for storage_config
CREATE TRIGGER update_storage_config_updated_at
BEFORE UPDATE ON public.storage_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update trigger for upload_progress
CREATE TRIGGER update_upload_progress_updated_at
BEFORE UPDATE ON public.upload_progress
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update trigger for user_quotas
CREATE TRIGGER update_user_quotas_updated_at
BEFORE UPDATE ON public.user_quotas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();