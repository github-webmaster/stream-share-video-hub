ALTER TABLE public.storage_config 
ADD COLUMN IF NOT EXISTS backup_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS backup_schedule TEXT DEFAULT '0 2 * * *',
ADD COLUMN IF NOT EXISTS backup_retention_days INTEGER DEFAULT 30;
