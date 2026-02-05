-- Drop overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can delete videos" ON public.videos;
DROP POLICY IF EXISTS "Authenticated users can insert videos" ON public.videos;
DROP POLICY IF EXISTS "Authenticated users can update videos" ON public.videos;
DROP POLICY IF EXISTS "Authenticated users can view videos" ON public.videos;

-- Add user_id column to track ownership
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create proper RLS policies that restrict to video owner
CREATE POLICY "Users can view their own videos"
ON public.videos
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own videos"
ON public.videos
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own videos"
ON public.videos
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own videos"
ON public.videos
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);