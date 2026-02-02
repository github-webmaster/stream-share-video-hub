-- Drop existing function to ensure we have a fresh state
DROP FUNCTION IF EXISTS public.get_public_video_by_share_id(text);

-- Re-create the secure function with refined logic
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
  SELECT 
    v.id, 
    v.title, 
    v.storage_path, 
    v.views
  FROM public.videos v
  WHERE v.share_id = p_share_id;
END;
$$;

-- CRITICAL: Explicitly grant execute permission to anon and authenticated roles
-- This is often the missing piece that causes "Video not found" (function access denied)
GRANT EXECUTE ON FUNCTION public.get_public_video_by_share_id(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_video_by_share_id(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_video_by_share_id(text) TO service_role;

-- Log that the migration was applied successfully
COMMENT ON FUNCTION public.get_public_video_by_share_id(text) IS 'Securely fetches video metadata by share_id, preventing table enumeration.';
