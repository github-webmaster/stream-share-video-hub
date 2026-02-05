# Cloudflare Deployment Guide - VPS with Flexible SSL

## Overview
This guide deploys Stream Share Hub to a VPS with Cloudflare providing SSL termination (Flexible SSL mode).

**Architecture:**
```
User (HTTPS) → Cloudflare (HTTPS) → VPS (HTTP:80) → Nginx → Containers
```

---

## Prerequisites

### VPS Requirements
- Ubuntu 20.04+ or Debian 11+
- 2GB+ RAM
- 2+ CPU cores
- 20GB+ disk space
- Public IP address

### Domain Setup
1. Domain pointed to Cloudflare nameservers
2. DNS A record: `@` → `YOUR_VPS_IP` (Proxied ☁️)

---

## Step 1: Prepare VPS

### SSH into your VPS
```bash
ssh root@YOUR_VPS_IP
```

### Clone repository
```bash
cd /srv
git clone https://github.com/yourusername/stream-share-hub-v2.git app
cd app
```

---

## Step 2: Configure Environment

### Copy production environment
```bash
cp .env.prod .env
```

### Edit `.env` file
```bash
nano .env
```

**CRITICAL - Update these values:**
```bash
# Replace 'yourdomain.com' with your actual domain
DOMAIN=yourdomain.com

# Generate secure passwords (minimum 32 characters)
POSTGRES_PASSWORD=YOUR_SECURE_DB_PASSWORD_HERE
JWT_SECRET=YOUR_SECURE_JWT_SECRET_64_CHARS_HERE
MINIO_ROOT_PASSWORD=YOUR_SECURE_MINIO_PASSWORD_HERE

# URLs MUST use HTTPS (Cloudflare handles SSL)
CORS_ORIGIN=https://yourdomain.com
VITE_API_URL=https://yourdomain.com/api
VITE_MEDIA_URL=https://yourdomain.com/media
```

**Save:** `Ctrl+X`, `Y`, `Enter`

---

## Step 3: Cloudflare Configuration

### SSL/TLS Settings
1. Go to Cloudflare Dashboard → SSL/TLS
2. Set mode to **Flexible** or **Full**
   - **Flexible**: Cloudflare ↔ VPS is HTTP (recommended for quick setup)
   - **Full**: Requires self-signed cert on VPS (more secure)

### DNS Settings
| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | @ | YOUR_VPS_IP | ☁️ Proxied |

**Important:** Orange cloud must be ON (proxied)

### Page Rules (Optional but Recommended)
1. Add rule: `yourdomain.com/api/*`
   - Browser Cache TTL: **Respect Existing Headers**
   - Cache Level: **Bypass**

---

## Step 4: Deploy Application

### Run deployment script
```bash
sudo bash deploy.sh
```

This script will:
- Install Docker & Docker Compose
- Configure UFW firewall
- Create required directories
- Build and start all containers
- Set up automated backups

### Manual deployment (alternative)
```bash
# Pull images
docker compose -f docker-compose.prod.yml pull

# Build containers
docker compose -f docker-compose.prod.yml build --no-cache

# Start services
docker compose -f docker-compose.prod.yml up -d

# Wait for services to initialize
sleep 30

# Check status
docker compose -f docker-compose.prod.yml ps
```

---

## Step 5: Verify Deployment

### Check service health
```bash
# Test backend health
curl http://localhost/health

# Should return: {"status":"ok","database":"connected"}
```

### Check containers
```bash
docker compose -f docker-compose.prod.yml ps
```

All services should show `Up (healthy)` status.

### View logs
```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f frontend
docker compose -f docker-compose.prod.yml logs -f api
```

---

## Step 6: Create First Admin User

1. Visit `https://yourdomain.com`
2. Click **Sign Up**
3. Register first account

**The first user automatically becomes admin with:**
- 10GB storage quota
- Access to `/admin` panel
- Unlimited video retention

---

## Troubleshooting

### Issue: "Mixed Content" errors in browser
**Cause:** Frontend trying to access HTTP resources from HTTPS page

**Fix:** Verify `.env` has HTTPS URLs:
```bash
VITE_API_URL=https://yourdomain.com/api
VITE_MEDIA_URL=https://yourdomain.com/media
```

Then rebuild frontend:
```bash
docker compose -f docker-compose.prod.yml up -d --build frontend
```

### Issue: CORS errors
**Cause:** Incorrect CORS_ORIGIN setting

**Fix:** Update `.env`:
```bash
CORS_ORIGIN=https://yourdomain.com
```

Restart API:
```bash
docker compose -f docker-compose.prod.yml restart api
```

### Issue: 502 Bad Gateway
**Cause:** Backend container not ready or crashed

**Check logs:**
```bash
docker compose -f docker-compose.prod.yml logs api --tail 100
```

**Common fixes:**
```bash
# Restart API
docker compose -f docker-compose.prod.yml restart api

# Full rebuild
docker compose -f docker-compose.prod.yml up -d --build api
```

### Issue: Cannot upload videos
**Cause:** File size limit or permissions

**Fix permissions:**
```bash
chmod -R 755 /srv/app/data/videos
```

**Increase nginx upload limit** (already set to 500MB in config):
Check `client_max_body_size 500M;` in [docker/nginx/frontend.conf](docker/nginx/frontend.conf#L49)

---

## Updating Deployment

### Pull latest code and redeploy
```bash
cd /srv/app
git pull origin main
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
```

### Quick restart (no rebuild)
```bash
cd /srv/app
docker compose -f docker-compose.prod.yml restart
```

---

## Backup & Restore

### Manual backup
```bash
# Backup database
docker exec streamshare-db pg_dump -U streamshare streamshare > backup-$(date +%Y%m%d).sql

# Backup volumes
docker run --rm -v streamshare-hub-v2_db_data:/data -v $(pwd)/backups:/backup alpine tar czf /backup/db_data-$(date +%Y%m%d).tar.gz /data
```

### Automated backups
Configured in `backup-cron.sh` to run daily at 2 AM

---

## Maintenance Commands

```bash
# View all containers
docker compose -f docker-compose.prod.yml ps

# Stop all services
docker compose -f docker-compose.prod.yml down

# Stop services and remove volumes (DESTRUCTIVE)
docker compose -f docker-compose.prod.yml down -v

# View resource usage
docker stats

# Clean up unused images/containers
docker system prune -a
```

---

## Security Recommendations

1. **Change default passwords** in `.env`
2. **Enable Cloudflare firewall rules**
3. **Set up Cloudflare rate limiting** for `/api/auth/*`
4. **Disable port 8081 in firewall** (API should only be accessible via nginx)
   ```bash
   sudo ufw delete allow 8081
   sudo ufw reload
   ```
5. **Enable Cloudflare bot protection**
6. **Set up monitoring** (Uptime Robot, etc.)

---

## Support

- Check logs: `docker compose -f docker-compose.prod.yml logs -f`
- Health check: `curl http://localhost/health`
- Database check: `docker exec streamshare-db psql -U streamshare -d streamshare -c "\dt"`
