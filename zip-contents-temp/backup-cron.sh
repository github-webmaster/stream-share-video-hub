#!/bin/bash
set -e

# Configuration
BACKUP_DIR="$(dirname "$0")/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/db-backup-$DATE.sql.gz"
RETENTION_DAYS=30

# Create backup directory if not exists
mkdir -p "$BACKUP_DIR"

echo "Starting database backup: $BACKUP_FILE"

# Load environment variables
if [ -f "$(dirname "$0")/.env" ]; then
  export $(grep -v '^#' "$(dirname "$0")/.env" | xargs)
fi

# Perform backup
docker exec streamshare-db pg_dumpall -U "${POSTGRES_USER}" | gzip > "$BACKUP_FILE"

if [ -f "$BACKUP_FILE" ]; then
  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "Backup completed successfully: $BACKUP_FILE ($SIZE)"
else
  echo "ERROR: Backup failed!"
  exit 1
fi

# Delete old backups
echo "Cleaning up old backups (older than $RETENTION_DAYS days)..."
find "$BACKUP_DIR" -name "db-backup-*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete

echo "Backup process complete"
