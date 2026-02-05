-- 1. CLEANUP: Remove any existing variants to avoid signature conflicts
DROP FUNCTION IF EXISTS public.get_public_video_by_share_id(text);

-- 2. CREATE: Use a unique parameter name that won't conflict with column names
-- PostgREST (Supabase) sometimes fails to map parameters if they look like columns
-- We'll name it 'share_id_param' for clarity.
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
  WHERE v.share_id = share_id_param;
END;
$$;

-- 3. PERMISSIONS: Ensure the public can actually call it
GRANT EXECUTE ON FUNCTION public.get_public_video_by_share_id(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_video_by_share_id(text) TO authenticated;

-- 4. CACHE RELOAD: Sometimes Supabase needs a nudge to see new functions
-- Running a trivial NOTIFY can sometimes help trigger a schema refresh
NOTIFY pgrst, 'reload schema';
