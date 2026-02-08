import cron from 'node-cron';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const BACKUP_DIR = '/backups';
const DEFAULT_SCHEDULE = '0 2 * * *'; // 2 AM daily
const MAX_BACKUPS = 30;

class BackupService {
    constructor(pool) {
        this.pool = pool;
        this.cronTask = null;
        this.isBackupRunning = false;
    }

    async init() {
        console.log('[Backup] Initializing backup service...');

        // Ensure backup directory exists
        if (!fs.existsSync(BACKUP_DIR)) {
            try {
                fs.mkdirSync(BACKUP_DIR, { recursive: true });
                console.log(`[Backup] Created backup directory: ${BACKUP_DIR}`);
            } catch (err) {
                console.error(`[Backup] Failed to create backup directory: ${err.message}`);
            }
        }

        await this.refreshSchedule();
    }

    async refreshSchedule() {
        try {
            // Get config from DB - handle case where columns don't exist
            let config = null;
            try {
                const result = await this.pool.query(
                    "SELECT backup_enabled, backup_schedule, backup_retention_days FROM public.storage_config LIMIT 1"
                );
                config = result.rows[0];
            } catch (queryErr) {
                console.warn('[Backup] Config columns may not exist yet:', queryErr.message);
                config = null;
            }

            // Stop existing task
            if (this.cronTask) {
                this.cronTask.stop();
                this.cronTask = null;
            }

            if (config?.backup_enabled) {
                const schedule = config.backup_schedule || DEFAULT_SCHEDULE;
                if (cron.validate(schedule)) {
                    console.log(`[Backup] Scheduling backups with schedule: ${schedule}`);
                    this.cronTask = cron.schedule(schedule, () => {
                        console.log('[Backup] Triggering automated backup...');
                        this.runBackup();
                    });
                } else {
                    console.warn(`[Backup] Invalid cron schedule: ${schedule}`);
                }
            } else {
                console.log('[Backup] Automated backups are disabled');
            }
        } catch (error) {
            console.error('[Backup] Failed to refresh schedule:', error);
        }
    }

    async runBackup() {
        if (this.isBackupRunning) {
            console.warn('[Backup] Backup already in progress, skipping...');
            return { success: false, message: 'Backup already in progress' };
        }

        this.isBackupRunning = true;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `db-backup-${timestamp}.sql.gz`;
        const filepath = path.join(BACKUP_DIR, filename);

        try {
            console.log(`[Backup] Starting backup to ${filepath}...`);

            // Construct pg_dump command
            // We rely on host 'streamshare-db' or 'db' and environment variables
            const dbHost = process.env.DB_HOST || 'db'; // 'db' is the service name in docker-compose
            const dbUser = process.env.POSTGRES_USER || 'postgres';

            // Use PGPASSWORD env approach for authentication if strict mode enabled,
            // but docker container usage usually trusts internal network or uses .pgpass.
            // Easiest within container: set PGPASSWORD env var for the command
            const env = { ...process.env, PGPASSWORD: process.env.POSTGRES_PASSWORD };

            // Command: pg_dump -h <host> -U <user> <dbname> | gzip > <file>
            // Note: We need to pipe to gzip.
            const command = `pg_dump -h ${dbHost} -U ${dbUser} ${process.env.POSTGRES_DB} | gzip > "${filepath}"`;

            await execAsync(command, { env });

            console.log('[Backup] Backup completed successfully');

            const stats = fs.statSync(filepath);
            const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

            await this.cleanupOldBackups();

            return {
                success: true,
                message: 'Backup successful',
                file: filename,
                size: `${sizeMB} MB`
            };

        } catch (error) {
            console.error('[Backup] Backup failed:', error);
            return { success: false, message: `Backup failed: ${error.message}` };
        } finally {
            this.isBackupRunning = false;
        }
    }

    async cleanupOldBackups() {
        try {
            const files = fs.readdirSync(BACKUP_DIR)
                .filter(f => f.startsWith('db-backup-') && f.endsWith('.sql.gz'))
                .map(f => ({
                    name: f,
                    path: path.join(BACKUP_DIR, f),
                    time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime()
                }))
                .sort((a, b) => b.time - a.time); // Newest first

            // Keep mostly based on config retention days, but for simplicity let's use MAX_BACKUPS as immediate safety
            if (files.length > MAX_BACKUPS) {
                const toDelete = files.slice(MAX_BACKUPS);
                for (const file of toDelete) {
                    fs.unlinkSync(file.path);
                    console.log(`[Backup] Pruned old backup: ${file.name}`);
                }
            }
        } catch (error) {
            console.error('[Backup] Cleanup failed:', error);
        }
    }

    async listBackups() {
        try {
            if (!fs.existsSync(BACKUP_DIR)) return [];

            const files = fs.readdirSync(BACKUP_DIR)
                .filter(f => f.startsWith('db-backup-') && f.endsWith('.sql.gz'))
                .map(f => {
                    const stats = fs.statSync(path.join(BACKUP_DIR, f));
                    return {
                        name: f,
                        size: stats.size,
                        date: stats.mtime.toISOString()
                    };
                })
                .sort((a, b) => new Date(b.date) - new Date(a.date));

            return files;
        } catch (error) {
            console.error('[Backup] Failed to list backups:', error);
            return [];
        }
    }
}

export default BackupService;
