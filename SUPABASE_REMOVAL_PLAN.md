# Supabase Removal & Full Self-Hosting Migration Plan

## 📊 Current Status Analysis

### ✅ Already Self-Hosted (No Changes Needed)
- **Backend API**: Fully independent Express.js server
- **Database**: PostgreSQL with direct connections (no Supabase)
- **Authentication**: JWT-based auth with bcrypt password hashing
- **Storage**: Local filesystem + S3/STORJ/MinIO support
- **Docker Setup**: Complete containerized infrastructure

### ⚠️ Requires Cleanup
- **Frontend Dependencies**: `@supabase/supabase-js` package (unused)
- **Integration Files**: `src/integrations/supabase/` folder (not imported)
- **Supabase Folder**: `supabase/` directory (migrations, functions, config)
- **Documentation**: References to Supabase in README, guides
- **Tests**: References to "supabase" as a storage provider name
- **Environment Variables**: VITE_SUPABASE_* variables (unused)

---

## 🎯 Migration Strategy

### Phase 1: Code Cleanup
Remove unused Supabase integration code and dependencies

### Phase 2: Migration Consolidation  
Move database migrations from `supabase/migrations/` to a standard location

### Phase 3: Documentation Update
Update all documentation to reflect fully self-hosted architecture

### Phase 4: Verification & Testing
Ensure all functionality works after removal

---

## 📋 Step-by-Step Removal Plan

### STEP 1: Remove Frontend Supabase Integration

#### 1.1 Remove Supabase NPM Package
```bash
npm uninstall @supabase/supabase-js
```

**Files affected:**
- `package.json` - removes dependency
- `package-lock.yaml` - updated automatically

#### 1.2 Delete Supabase Integration Folder
```bash
rm -rf src/integrations/supabase/
```

**Files removed:**
- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/types.ts`

**Impact:** ✅ SAFE - These files are not imported anywhere in the codebase

---

### STEP 2: Database Migrations Consolidation

#### 2.1 Create Standard Migrations Folder
```bash
mkdir -p migrations
```

#### 2.2 Move Existing Migrations
```bash
# Copy all migrations from supabase folder
cp -r supabase/migrations/* migrations/

# Rename for clarity (optional)
cd migrations/
```

**Migrations to move:**
- `20260130021600_ffd4fc16-ddec-470d-9d82-3bab6a2247b0.sql`
- `20260202214923_523551d4-c575-4fa5-ab1b-734f2b8e1133.sql`
- `20260202215019_b0eb7c72-6387-4646-a38d-fdcea11948c3.sql`
- `20260202231000_fix_security_enumeration.sql`
- `20260202232000_add_profiles_and_visibility.sql`
- `20260202235500_hardening_videos_rls.sql`
- `20260203000000_add_size_column.sql`
- `20260203060515_d3d85970-eead-4ec1-9e99-78ddd12e77d7.sql`
- `20260204090000_add_video_indexes.sql`
- `20260204120000_add_chunked_uploads.sql`

#### 2.3 Update Migration Runner

**Option A: Continue using current approach (migrations in docker/initdb/)**
```bash
# Copy consolidated schema to docker init
cat migrations/*.sql > docker/initdb/001_schema.sql
```

**Option B: Add migration tool (recommended for production)**

Install a migration tool like `node-pg-migrate`:
```bash
cd server
npm install node-pg-migrate
```

Create `server/migrations/` folder and move SQL files there.

Add migration script to `server/package.json`:
```json
{
  "scripts": {
    "migrate": "node-pg-migrate up",
    "migrate:down": "node-pg-migrate down",
    "migrate:create": "node-pg-migrate create"
  }
}
```

#### 2.4 Remove Supabase Folder
```bash
rm -rf supabase/
```

**Files removed:**
- `supabase/config.toml`
- `supabase/functions/upload-video/index.ts`
- `supabase/migrations/*.sql` (already copied)

**Impact on functionality:**
- ✅ Edge function not used (backend handles uploads)
- ✅ Migrations preserved in new location
- ✅ Config not needed

---

### STEP 3: Environment Variables Cleanup

#### 3.1 Remove from `.env.example`
Remove these lines:
```diff
- # Supabase Configuration (Legacy - Not Used)
- # VITE_SUPABASE_URL=https://your-project.supabase.co
- # VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

#### 3.2 Clean up any local `.env` files
If you have `.env.local`, `.env.development`, etc., remove Supabase variables.

---

### STEP 4: Update Test Files

#### 4.1 Update Storage Provider Tests

Replace "supabase" references with "local" or "s3" in tests:

**Files to update:**
- `src/test/storjIntegration.test.ts`
- `src/test/storjIntegration.complete.test.ts`

**Changes needed:**
```typescript
// Before
const providers = ["supabase", "storj"];
const defaultProvider = "supabase";

// After  
const providers = ["local", "s3", "storj"];
const defaultProvider = "local";
```

**Search and replace:**
- `"supabase"` → `"local"` (as default storage provider)
- `"Supabase"` → `"Local Storage"` (in test descriptions)

---

### STEP 5: Update Documentation

#### 5.1 README.md - Major Rewrite

**Remove sections:**
- "Supabase" from Technology Stack
- References to "Supabase Auth", "Supabase Storage"
- Installation step about Supabase account/project
- API examples using `supabase.auth` and `supabase.storage`

**Update sections:**
```markdown
### Backend & Database
- **Express.js** - RESTful API server
- **PostgreSQL** - Primary database with RLS policies
- **JWT Authentication** - Secure token-based auth
- **bcrypt** - Password hashing
- **Local/S3/STORJ Storage** - Multi-provider storage system
- **Docker** - Containerized deployment

### Getting Started

#### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 15+

#### Installation
1. Clone repository
2. Install dependencies: `npm install && cd server && npm install`
3. Configure environment: `cp .env.example .env`
4. Start with Docker: `docker compose up -d`
5. Access at: http://localhost:4000
```

#### 5.2 QUICK_START.md

**Update deployment sections:**
- Remove Supabase references
- Emphasize fully self-hosted architecture
- Update authentication flow (JWT-based)

#### 5.3 Other Documentation Files

**Update these files:**
- `DEPLOYMENT_SUMMARY.md` - Remove supabase references
- `CHANGES.md` - Update migration paths from `supabase/migrations/` to `migrations/`
- `docs/STORJ_SETUP.md` - Update fallback from "Supabase" to "Local Storage"
- `docs/IMPLEMENTATION_SUMMARY.md` - Remove Supabase integration details

---

### STEP 6: Update Database Schema References

#### 6.1 Check for Hardcoded "supabase" Provider Values

Search in migrations for:
```sql
provider TEXT NOT NULL DEFAULT 'supabase'
```

Replace with:
```sql
provider TEXT NOT NULL DEFAULT 'local'
```

**Files to check:**
- All migration files (now in `migrations/` or `docker/initdb/`)
- Look for INSERT statements with `VALUES ('supabase')`

#### 6.2 Update Default Storage Config

In your main schema file (consolidated migrations), change:
```sql
-- Before
INSERT INTO public.storage_config (provider) VALUES ('supabase');

-- After
INSERT INTO public.storage_config (provider) VALUES ('local');
```

---

### STEP 7: Code Verification

#### 7.1 Search for Remaining References
```bash
# Search entire codebase for "supabase" (case-insensitive)
grep -ri "supabase" --exclude-dir=node_modules --exclude-dir=.git .

# Should only find:
# - This migration guide
# - Git history
# - Maybe some comments (update those too)
```

#### 7.2 Check Import Statements
```bash
# Search for any Supabase imports
grep -r "from.*supabase" src/ server/
grep -r "import.*supabase" src/ server/

# Should return nothing
```

---

### STEP 8: Testing & Validation

#### 8.1 Clean Install Test
```bash
# Remove node_modules
rm -rf node_modules server/node_modules

# Fresh install
npm install
cd server && npm install && cd ..

# Verify no Supabase packages
npm list | grep supabase  # Should be empty
```

#### 8.2 Run Tests
```bash
npm test

# All tests should pass
# No Supabase-related errors
```

#### 8.3 Docker Build Test
```bash
# Stop current containers
docker compose down

# Rebuild from scratch
docker compose build --no-cache

# Start services
docker compose up -d

# Check all services healthy
docker compose ps

# Test functionality
curl http://localhost:8081/health
curl http://localhost:4000
```

#### 8.4 Full Feature Test
1. ✅ User Registration (`POST /api/auth/signup`)
2. ✅ User Login (`POST /api/auth/login`)
3. ✅ Video Upload (chunked upload with resume)
4. ✅ Video List (authenticated user videos)
5. ✅ Video Playback (public share links)
6. ✅ Storage Configuration (admin panel)
7. ✅ STORJ Integration (if configured)

---

## 🚨 Common Pitfalls & Warnings

### Pitfall 1: Database Migration State
**Problem:** Existing database might have "supabase" as storage provider
**Solution:**
```sql
-- Update existing records if needed
UPDATE storage_config SET provider = 'local' WHERE provider = 'supabase';
UPDATE upload_progress SET storage_provider = 'local' WHERE storage_provider = 'supabase';
```

### Pitfall 2: Cached Environment Variables
**Problem:** Frontend might cache old VITE_SUPABASE_* variables
**Solution:**
- Clear browser localStorage
- Delete `.env.local` completely
- Restart Vite dev server
```bash
rm .env.local
npm run dev
```

### Pitfall 3: TypeScript Types
**Problem:** Old imports might cause TypeScript errors
**Solution:**
- Delete `src/integrations/` folder completely
- Run `npx tsc --noEmit` to check for type errors
- Fix any lingering imports

### Pitfall 4: Production Deployment
**Problem:** Production env might still have Supabase vars set
**Solution:**
- Update `.env` on VPS/production server
- Remove: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
- Restart production containers
```bash
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --build
```

### Pitfall 5: Documentation Confusion
**Problem:** Users/contributors might see old Supabase docs
**Solution:**
- Update ALL markdown files
- Add "Fully Self-Hosted" badge to README
- Create MIGRATION.md changelog documenting the change

---

## ✅ Post-Migration Best Practices

### 1. **Unified Migration System**

Implement a proper migration tool:
```bash
cd server
npm install node-pg-migrate
```

**Benefits:**
- Version-controlled migrations
- Rollback capability
- Production-safe deployments
- No manual SQL execution

**Setup:**
```javascript
// server/migrations/index.js
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

export async function runMigrations(connectionString) {
  const pool = new Pool({ connectionString });
  const migrationsDir = path.join(__dirname, '../migrations');
  const files = fs.readdirSync(migrationsDir).sort();
  
  for (const file of files) {
    if (!file.endsWith('.sql')) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await pool.query(sql);
    console.log(`Applied migration: ${file}`);
  }
  
  await pool.end();
}
```

### 2. **Standardize Storage Provider Names**

Use consistent naming:
- `local` - Local filesystem storage
- `s3` - AWS S3 or compatible
- `storj` - STORJ decentralized storage
- `minio` - Self-hosted MinIO

Update:
```typescript
// types/storage.ts
export type StorageProvider = 'local' | 's3' | 'storj' | 'minio';

export const STORAGE_PROVIDERS = {
  LOCAL: 'local' as const,
  S3: 's3' as const,
  STORJ: 'storj' as const,
  MINIO: 'minio' as const,
};
```

### 3. **Environment Variable Organization**

Group related variables in `.env.example`:
```bash
# ==========================================
# DATABASE CONFIGURATION
# ==========================================
DATABASE_URL=postgresql://user:pass@host:5432/db
POSTGRES_USER=streamshare
POSTGRES_PASSWORD=changeme
POSTGRES_DB=streamshare

# ==========================================
# AUTHENTICATION
# ==========================================
JWT_SECRET=generate_with_openssl_rand_base64_64
JWT_EXPIRY=7d

# ==========================================
# STORAGE BACKEND
# ==========================================
STORAGE_PROVIDER=local  # Options: local, s3, storj, minio
STORAGE_PATH=/data/videos
MAX_FILE_SIZE_MB=500

# S3/STORJ Configuration (if using s3 or storj)
# S3_ACCESS_KEY=
# S3_SECRET_KEY=
# S3_ENDPOINT=
# S3_BUCKET=

# ==========================================
# API CONFIGURATION
# ==========================================
PORT=8081
NODE_ENV=production
CORS_ORIGIN=https://yourdomain.com
```

### 4. **Add Health Check for Storage**

Enhance health endpoint:
```javascript
// server/src/index.js
app.get("/health", async (req, res) => {
  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    services: {
      database: "unknown",
      storage: "unknown"
    }
  };

  // Check database
  try {
    await pool.query("SELECT 1");
    health.services.database = "healthy";
  } catch (err) {
    health.services.database = "unhealthy";
    health.status = "degraded";
  }

  // Check storage
  try {
    fs.accessSync(STORAGE_BASE, fs.constants.W_OK);
    health.services.storage = "healthy";
  } catch (err) {
    health.services.storage = "unhealthy";
    health.status = "degraded";
  }

  const statusCode = health.status === "ok" ? 200 : 503;
  res.status(statusCode).json(health);
});
```

### 5. **Documentation Structure**

Organize docs clearly:
```
docs/
├── ARCHITECTURE.md        # System architecture overview
├── API_REFERENCE.md       # API endpoints documentation
├── DEPLOYMENT.md          # Deployment guide (Docker, VPS, K8s)
├── STORAGE_PROVIDERS.md   # Storage backend configuration
├── DEVELOPMENT.md         # Local development setup
├── TESTING.md             # Testing guide
└── MIGRATION.md           # This file (migration from Supabase)
```

### 6. **Add Architecture Diagram**

Create `docs/ARCHITECTURE.md`:
```markdown
# StreamShare Hub - System Architecture

## Overview
Fully self-hosted video platform with no external dependencies.

## Components

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │ HTTPS
       ▼
┌─────────────────┐
│  Nginx/Traefik  │  ← Reverse Proxy + SSL
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌─────────┐
│ Static │ │ Express │  ← API Server
│ Files  │ │  API    │
└────────┘ └────┬────┘
               │
         ┌─────┴─────┐
         │           │
         ▼           ▼
    ┌──────────┐ ┌──────────┐
    │PostgreSQL│ │ Storage  │
    │    DB    │ │ (Local/  │
    │          │ │ S3/STORJ)│
    └──────────┘ └──────────┘
```

## Data Flow

### Authentication
1. User submits credentials → API
2. API validates with PostgreSQL
3. API generates JWT token
4. Client stores token in localStorage
5. Subsequent requests include JWT in Authorization header

### Video Upload
1. Client chunks large file
2. POST to `/api/upload/init` → returns upload ID
3. POST chunks to `/api/upload/chunk/:id`
4. Server streams to storage backend
5. POST to `/api/upload/complete/:id`
6. Server creates database record
7. Returns public share link

### Video Playback
1. Client requests `/api/videos/public/:shareId`
2. Server checks database for video metadata
3. Server streams from storage
4. Increment view count
5. Client receives video stream
```
```

### 7. **Setup CI/CD for Migration Safety**

Add migration check to CI:
```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Start PostgreSQL
        run: |
          docker compose up -d db
          sleep 5
      
      - name: Run Migrations
        run: |
          docker exec streamshare-db psql -U streamshare -d streamshare -f /docker-entrypoint-initdb.d/001_schema.sql
      
      - name: Run Tests
        run: npm test
      
      - name: Check for Supabase References
        run: |
          if grep -ri "supabase" src/ server/ --exclude-dir=node_modules; then
            echo "ERROR: Found Supabase references in code!"
            exit 1
          fi
```

---

## 📊 Migration Checklist

Use this checklist to track progress:

### Code Changes
- [ ] Remove `@supabase/supabase-js` from `package.json`
- [ ] Delete `src/integrations/supabase/` folder
- [ ] Move `supabase/migrations/` to `migrations/`
- [ ] Remove `supabase/` folder entirely
- [ ] Update tests - replace "supabase" provider with "local"
- [ ] Update database DEFAULT values from 'supabase' to 'local'
- [ ] Run `grep -ri "supabase"` and fix remaining references

### Environment & Config
- [ ] Remove Supabase vars from `.env.example`
- [ ] Remove Supabase vars from local `.env` files
- [ ] Update production `.env` on VPS/servers
- [ ] Verify `docker/.env` has no Supabase references

### Documentation
- [ ] Update README.md - remove all Supabase mentions
- [ ] Update QUICK_START.md
- [ ] Update DEPLOYMENT_SUMMARY.md
- [ ] Update docs/STORJ_SETUP.md (change fallback)
- [ ] Update docs/IMPLEMENTATION_SUMMARY.md
- [ ] Create docs/ARCHITECTURE.md (optional)
- [ ] Update CHANGES.md with migration note

### Database
- [ ] Consolidate migrations to single location
- [ ] Update storage_config default provider to 'local'
- [ ] Run migration on existing database (if needed):
      ```sql
      UPDATE storage_config SET provider = 'local' WHERE provider = 'supabase';
      ```

### Testing
- [ ] Fresh `npm install` (no Supabase packages)
- [ ] Run `npm test` (all pass)
- [ ] Docker build test (`docker compose build --no-cache`)
- [ ] Local dev test (`npm run dev`)
- [ ] Test user registration/login
- [ ] Test video upload
- [ ] Test video playback
- [ ] Test admin panel
- [ ] Production deployment test (if applicable)

### Verification
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] No console errors in browser
- [ ] No "supabase" in `grep -ri supabase src/ server/`
- [ ] Git commit with clear message
- [ ] Tag release as v3.0.0 (major version - breaking change)

---

## 🎉 Benefits After Migration

1. **Truly Self-Hosted**
   - No external service dependencies
   - Complete data ownership
   - No vendor lock-in

2. **Simplified Setup**
   - Fewer environment variables
   - Less configuration complexity
   - Clearer documentation

3. **Reduced Attack Surface**
   - Fewer network dependencies
   - No third-party API keys to leak
   - Simpler security audit

4. **Better Performance**
   - No external API calls
   - Lower latency
   - Full control over infrastructure

5. **Cost Savings**
   - No Supabase subscription needed
   - Pay only for your server
   - Predictable costs

6. **Easier Maintenance**
   - Standard PostgreSQL & Express
   - Well-documented technologies
   - Larger community support

---

## 🔗 Related Documentation

- Main README: `README.md`
- Deployment Guide: `QUICK_START.md`
- API Documentation: `server/src/index.js` (inline comments)
- Storage Setup: `docs/STORJ_SETUP.md`
- Docker Setup: `docker-compose.yml`, `docker-compose.prod.yml`

---

## 📞 Support

If you encounter issues during migration:

1. **Check logs:**
   ```bash
   docker compose logs -f
   ```

2. **Verify database:**
   ```bash
   docker exec -it streamshare-db psql -U streamshare -d streamshare
   ```

3. **Reset and retry:**
   ```bash
   docker compose down -v
   docker compose up -d --build
   ```

4. **Create GitHub issue** with:
   - Error message
   - Steps to reproduce
   - Environment details (OS, Docker version, etc.)

---

**Version:** 1.0  
**Date:** February 4, 2026  
**Status:** Ready for Implementation
