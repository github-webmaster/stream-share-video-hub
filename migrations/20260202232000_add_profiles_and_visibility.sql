-- Add visibility column to videos table
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private'));

-- Create profiles table for user settings
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  default_visibility TEXT NOT NULL DEFAULT 'public' CHECK (default_visibility IN ('public', 'private')),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, default_visibility)
  VALUES (new.id, 'public');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for profile creation
CREATE OR REPLACE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- Populate profiles for existing users
INSERT INTO public.profiles (id, default_visibility)
SELECT id, 'public' FROM auth.users
ON CONFLICT (id) DO NOTHING;


-- Update the secure function to respect visibility
-- A video is visible if:
-- 1. Its visibility is 'public'
-- 2. OR its visibility is 'default' AND the owner's default visibility is 'public'
-- For now, let's keep it simple: if individual visibility is public, or if not set, check owner setting.
-- Since we added 'public' as default to videos.visibility, we check that first.
CREATE OR REPLACE FUNCTION public.get_public_video_by_share_id(share_id_param text)
RETURNS TABLE (
  id uuid,
  title text,
  storage_path text,
  views integer
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v.id, 
    v.title, 
    v.storage_path, 
    v.views
  FROM public.videos v
  JOIN public.profiles p ON v.user_id = p.id
  WHERE v.share_id = share_id_param
    AND (
      -- Is public individually
      v.visibility = 'public'
      OR 
      -- OR is 'default' and user has public global setting
      (v.visibility = 'default' AND p.default_visibility = 'public')
    );
END;
$$;

-- Grant execute again just in case
GRANT EXECUTE ON FUNCTION public.get_public_video_by_share_id(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_video_by_share_id(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_video_by_share_id(text) TO service_role;
