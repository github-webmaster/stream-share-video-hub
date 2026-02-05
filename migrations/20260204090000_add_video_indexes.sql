-- Add composite indexes to speed up common video queries
-- 1) Listing videos for a user ordered by created_at DESC
-- 2) Cleanup / range queries filtering by user_id and created_at

CREATE INDEX IF NOT EXISTS idx_videos_user_created_at_desc
  ON public.videos (user_id, created_at DESC);

-- Optional additional index for range scans (in case planner prefers non-DESC order)
CREATE INDEX IF NOT EXISTS idx_videos_user_created_at
  ON public.videos (user_id, created_at);

-- Add index to speed up lookups of profile-related joins when searching by user_id (if not implicitly present)
CREATE INDEX IF NOT EXISTS idx_videos_user_visibility
  ON public.videos (user_id, visibility);

-- Notes:
-- - The composite index (user_id, created_at DESC) supports "WHERE user_id = $1 ORDER BY created_at DESC" without an extra sort
-- - The (user_id, created_at) index can help range queries like "created_at < $2"
-- - The (user_id, visibility) index can help queries that filter by visibility for a given user (future-proofing)
