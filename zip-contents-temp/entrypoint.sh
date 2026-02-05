#!/bin/bash
set -e

echo "Waiting for PostgreSQL to be ready..."
wait-for-it db:5432 -t 60

echo "Running database migrations..."
# Check if migrations exist and run them
if [ -d "../docker/initdb" ]; then
  for file in ../docker/initdb/*.sql; do
    if [ -f "$file" ]; then
      echo "Applying migration: $file"
      PGPASSWORD="${POSTGRES_PASSWORD}" psql -h db -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -f "$file" 2>&1 | grep -v "already exists" || true
    fi
  done
fi

echo "Migrations complete. Starting application..."
exec "$@"
