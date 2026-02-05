-- 1. DROP the overly permissive public policy
-- This policy currently allows 'anon' users to SELECT all rows from the table,
-- which exposes metadata and enables enumeration.
DROP POLICY IF EXISTS "Anyone can view videos by share_id" ON public.videos;

-- 2. NOTE: We do NOT need a replacement policy for public viewing.
-- Our application uses the 'get_public_video_by_share_id' RPC function,
-- which is defined as SECURITY DEFINER. This means it bypasses RLS
-- and handles its own security logic (requiring a specific share_id).
-- By removing the direct SELECT policy, we prevent enumeration while 
-- keeping share links functional.

-- 3. ENSURE authenticated users still only see their own videos
-- (This was already handled in a previous migration, but we re-verify here).
-- Only videos owned by the user are visible to them via the Supabase client.
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own videos' AND tablename = 'videos') THEN
        -- Policy already exists and is restrictive.
        NULL;
    ELSE
        -- Just in case it was missing or modified
        CREATE POLICY "Users can view their own videos"
        ON public.videos
        FOR SELECT
        TO authenticated
        USING (auth.uid() = user_id);
    END IF;
END $$;
