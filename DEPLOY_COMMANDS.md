# Quick Deployment Commands

## Standard Deployment Script

```bash
cd /srv/app
sudo bash deploy.sh
```

This script handles everything automatically (Docker installation, firewall, deployment).

---

## Manual Deployment (Alternative)

If you prefer manual control or the deploy.sh script fails:

### 1. Pull Latest Code
```bash
cd /srv/app
git pull origin main
```

### 2. Stop Running Containers
```bash
docker compose -f docker-compose.prod.yml down -v
```

**Flags:**
- `-v` removes volumes (fresh database) - **CAUTION: destroys data**
- Omit `-v` to keep database data

### 3. Build Fresh Images
```bash
docker compose -f docker-compose.prod.yml build --no-cache
```

**Flags:**
- `--no-cache` forces complete rebuild (slower but ensures latest code)

### 4. Start Services
```bash
docker compose -f docker-compose.prod.yml up -d
```

**Flags:**
- `-d` runs in background (detached mode)

### 5. Wait for Initialization
```bash
sleep 30
```

Gives time for:
- Database to initialize
- Migrations to run
- Health checks to pass

### 6. Verify Services
```bash
docker compose -f docker-compose.prod.yml ps
```

All services should show `Up (healthy)` status.

### 7. Test Health Endpoint
```bash
curl http://localhost/health
```

Expected response:
```json
{"status":"ok","database":"connected"}
```

---

## Quick Reference Commands

### View Logs
```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service (last 50 lines)
docker compose -f docker-compose.prod.yml logs api --tail 50
docker compose -f docker-compose.prod.yml logs frontend --tail 50
docker compose -f docker-compose.prod.yml logs db --tail 50
```

### Restart Services
```bash
# Restart all
docker compose -f docker-compose.prod.yml restart

# Restart specific service
docker compose -f docker-compose.prod.yml restart api
docker compose -f docker-compose.prod.yml restart frontend
```

### Rebuild Single Service
```bash
# Rebuild only API
docker compose -f docker-compose.prod.yml up -d --build api

# Rebuild only frontend
docker compose -f docker-compose.prod.yml up -d --build frontend
```

### Stop Services
```bash
# Stop all (keeps data)
docker compose -f docker-compose.prod.yml down

# Stop all and remove volumes (DESTROYS DATA)
docker compose -f docker-compose.prod.yml down -v
```

### Check Status
```bash
# Container status
docker compose -f docker-compose.prod.yml ps

# Resource usage
docker stats

# Health checks
curl http://localhost/health
curl http://localhost/api/health
```

---

## Common Deployment Scenarios

### Scenario 1: Update code only (no config changes)
```bash
cd /srv/app
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
```

### Scenario 2: Fresh deployment (keep database)
```bash
cd /srv/app
git pull origin main
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
```

### Scenario 3: Complete reset (destroys all data)
```bash
cd /srv/app
git pull origin main
docker compose -f docker-compose.prod.yml down -v
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
```

### Scenario 4: Update environment variables
```bash
cd /srv/app
nano .env   # Make changes
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
```

**Note:** No rebuild needed for `.env` changes, just restart.

---

## Troubleshooting Commands

### Container won't start
```bash
# Check logs
docker compose -f docker-compose.prod.yml logs api --tail 100

# Check if port is in use
sudo netstat -tulpn | grep :80
sudo netstat -tulpn | grep :8081

# Force remove container
docker rm -f streamshare-api
docker compose -f docker-compose.prod.yml up -d
```

### Database connection issues
```bash
# Check database logs
docker compose -f docker-compose.prod.yml logs db --tail 50

# Test database connection
docker exec streamshare-db psql -U streamshare -d streamshare -c "SELECT 1;"

# View database tables
docker exec streamshare-db psql -U streamshare -d streamshare -c "\dt"
```

### Out of disk space
```bash
# Check disk usage
df -h

# Clean Docker resources
docker system prune -a -f

# Remove old images
docker image prune -a -f
```

### Frontend not accessible
```bash
# Check nginx logs
docker compose -f docker-compose.prod.yml logs frontend --tail 50

# Rebuild frontend
docker compose -f docker-compose.prod.yml up -d --build frontend

# Test locally
curl http://localhost/
```

---

## Production Checklist

Before deploying, verify:

- [ ] `.env` file configured with production values
- [ ] `CORS_ORIGIN` set to `https://yourdomain.com`
- [ ] `VITE_API_URL` set to `https://yourdomain.com/api`
- [ ] Strong passwords for `POSTGRES_PASSWORD`, `JWT_SECRET`, `MINIO_ROOT_PASSWORD`
- [ ] Cloudflare DNS pointing to VPS IP (proxied)
- [ ] Cloudflare SSL/TLS mode set to Flexible or Full
- [ ] Firewall allows ports 80, 443, 22

---

## The "Old Chatbot" Commands Explained

The commands you shared are the manual deployment workflow:

```bash
cd /srv/app                                          # Go to app directory
git pull origin main                                  # Get latest code
docker compose -f docker-compose.prod.yml down -v    # Stop & remove volumes
docker compose -f docker-compose.prod.yml build --no-cache  # Fresh build
docker compose -f docker-compose.prod.yml up -d      # Start in background
sleep 30                                             # Wait for startup
docker compose -f docker-compose.prod.yml ps         # Check status
curl http://localhost/health                         # Test health endpoint
```

**⚠️ WARNING:** The `-v` flag **destroys all data** (database, uploads, etc.). Only use for complete resets!

For normal updates, **omit `-v`**:
```bash
docker compose -f docker-compose.prod.yml down
```
