-- Create function to increment video views (bypasses RLS)
CREATE OR REPLACE FUNCTION public.increment_video_views(video_share_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.videos
  SET views = views + 1
  WHERE share_id = video_share_id;
END;
$$;