# Deployment Guide for Stream Share Hub

## Quick Start - Fresh Local Deployment

### Using Main docker-compose.yml (Port 4000)
```bash
docker compose up -d --build
```
- Frontend: http://localhost:4000
- API: http://localhost:8081

### Creating Additional Instances

For testing or parallel deployments, use the template:

1. **Copy the template:**
   ```bash
   copy docker-compose-template.yml docker-compose-alt4.yml
   ```

2. **Replace placeholders** in the new file:
   | Placeholder | Example Value | Description |
   |-------------|---------------|-------------|
   | `{{INSTANCE}}` | `5` | Unique instance number (db5, api5, frontend5) |
   | `{{DB_PORT}}` | `5437` | PostgreSQL port (increment from 5432) |
   | `{{API_PORT}}` | `8085` | API server port (increment from 8081) |
   | `{{FE_PORT}}` | `4004` | Frontend port (increment from 4000) |

3. **Deploy:**
   ```bash
   docker compose -f docker-compose-alt4.yml up -d --build
   ```

**That's it!** No CORS configuration needed. Deploy 5 or 500 instances - they all work immediately.

## CRITICAL Configuration Rules

### 1. Database Credentials (DO NOT CHANGE)
The database is initialized with credentials from `docker/.env`:
```
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
```

**ALWAYS use this DATABASE_URL format:**
```yaml
DATABASE_URL: postgres://postgres:postgres@dbX:5432/streamshare
```

**NEVER use:**
```yaml
# WRONG - this user doesn't exist!
DATABASE_URL: postgresql://streamshare:CHANGE_ME...@db:5432/streamshare
```

### 2. CORS - Automatic (No Configuration Needed)

**For local development:** CORS is permissive by default - any frontend port can talk to any API.

The server defaults to allowing ALL origins when `CORS_ORIGIN` is not set:
```javascript
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";  // Defaults to allow all
```

**For production:** Set `CORS_ORIGIN` in your environment to restrict access:
```yaml
environment:
  CORS_ORIGIN: https://yourdomain.com
```

### 3. Database Health Check (REQUIRED)
Always wait for database before starting API:
```yaml
depends_on:
  dbX:
    condition: service_healthy
```

## Existing Deployments

| Compose File | Frontend | API | DB Port | Status |
|--------------|----------|-----|---------|--------|
| docker-compose.yml | 4000 | 8081 | 5433 | Main |
| docker-compose-alt.yml | 4001 | 8082 | 5434 | Test |
| docker-compose-alt2.yml | 4002 | 8083 | 5435 | Test |
| docker-compose-alt3.yml | 4003 | 8084 | 5436 | Test |

## First User = Admin

The **first user to sign up** on a fresh deployment automatically becomes an admin with:
- Access to `/admin` panel
- 10GB storage quota (vs 512MB for regular users)
- Unlimited video retention (vs 90 days for regular users)

## Troubleshooting

### "Failed to create user" / 500 Error
**Cause:** Wrong database credentials
**Fix:** Ensure `DATABASE_URL` uses `postgres:postgres@dbX:5432/streamshare`

### Check Logs
```bash
# API logs
docker compose -f docker-compose-altX.yml logs apiX --tail 50

# Database logs
docker compose -f docker-compose-altX.yml logs dbX --tail 50
```

### Verify Database Connection
```bash
docker exec stream-share-hub-v2-dbX-1 psql -U postgres -d streamshare -c "\dt"
```
