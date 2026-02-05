-- Add size column to videos table
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS size BIGINT;

-- Add visibility column if it doesn't exist (should have been added by previous migration)
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private'));

-- Add user_id column if it doesn't exist (should have been added by previous migration)
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
