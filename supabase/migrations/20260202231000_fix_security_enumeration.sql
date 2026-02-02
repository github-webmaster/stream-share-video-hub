-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can view videos by share_id" ON public.videos;

-- Create a secure function to fetch video metadata by share_id
-- This allows unauthenticated access to specific videos WITHOUT allowing enumeration of the whole table
CREATE OR REPLACE FUNCTION public.get_public_video_by_share_id(p_share_id text)
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
  SELECT v.id, v.title, v.storage_path, v.views
  FROM public.videos v
  WHERE v.share_id = p_share_id;
END;
$$;
