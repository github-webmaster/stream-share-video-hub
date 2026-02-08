ALTER TABLE public.storage_config ADD COLUMN IF NOT EXISTS default_storage_limit_mb INTEGER DEFAULT 512;
