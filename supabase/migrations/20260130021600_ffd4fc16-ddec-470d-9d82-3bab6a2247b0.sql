-- Create videos table for metadata
CREATE TABLE public.videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT 'Untitled',
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  share_id TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(6), 'hex'),
  views INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

-- Admin-only access (will require auth later)
-- For now, allow all authenticated users
CREATE POLICY "Authenticated users can view videos"
ON public.videos FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert videos"
ON public.videos FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update videos"
ON public.videos FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete videos"
ON public.videos FOR DELETE
TO authenticated
USING (true);

-- Public read for share links
CREATE POLICY "Anyone can view videos by share_id"
ON public.videos FOR SELECT
TO anon
USING (true);

-- Create storage bucket for videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', true);

-- Storage policies
CREATE POLICY "Authenticated users can upload videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'videos');

CREATE POLICY "Anyone can view videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'videos');

CREATE POLICY "Authenticated users can delete videos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'videos');

-- Updated at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_videos_updated_at
BEFORE UPDATE ON public.videos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();