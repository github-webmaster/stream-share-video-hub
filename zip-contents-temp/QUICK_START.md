# 🚀 Quick Start Guide - StreamShare Hub v2.0

## ✅ Status: READY FOR VPS DEPLOYMENT

---

## 📦 Step 1: Commit Changes to Git

```bash
# Add all files
git add .

# Commit with message
git commit -m "feat: production deployment system v2.0

- Docker Compose production setup with Cloudflare SSL
- Express API backend with chunked upload support
- One-command VPS deployment script (deploy.sh)
- GitHub Actions CI/CD workflows
- Automated database backups
- Complete deployment documentation
"

# Push to GitHub
git push origin main
```

---

## 🔐 Step 2: Configure GitHub Secrets

**Go to:** Your GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

### Required Secrets:

| Secret Name | Value |
|------------|-------|
| `VPS_HOST` | Your VPS IP (e.g., `123.45.67.89`) |
| `VPS_USER` | SSH username (usually `root`) |
| `VPS_SSH_KEY` | Your SSH private key (entire content) |
| `VPS_PATH` | `/srv/app` |
| `VITE_API_URL` | `https://api.yourdomain.com` |
| `VITE_MEDIA_URL` | `https://api.yourdomain.com/media` |

### Generate SSH Key:
```bash
# On your local machine
ssh-keygen -t ed25519 -f github-actions-key -N ""

# Add to VPS
ssh-copy-id -i github-actions-key.pub root@YOUR_VPS_IP

# Get private key (paste as VPS_SSH_KEY secret)
cat github-actions-key
```

---

## 🌐 Step 3: Cloudflare DNS Configuration

> **⚠️ IMPORTANT:** This stack requires Cloudflare for SSL/TLS termination.

**Add these 3 DNS records in Cloudflare:**

| Type | Name | Content | Proxy Status | TTL |
|------|------|---------|--------------|-----|
| A | @ | YOUR_VPS_IP | Proxied (Orange Cloud) | Auto |
| A | api | YOUR_VPS_IP | Proxied (Orange Cloud) | Auto |
| A | minio | YOUR_VPS_IP | Proxied (Orange Cloud) | Auto |

**SSL/TLS Configuration in Cloudflare:**

1. Go to **SSL/TLS** → **Overview**
2. Choose either:
   - **Flexible** (Quick setup): Cloudflare ↔️ Visitor encrypted
   - **Full** (Better security): Cloudflare ↔️ Server encrypted (self-signed OK)

> **💡 TIP:** Start with **Flexible** mode, upgrade to **Full** later.

**Verify DNS propagation:**
```bash
dig yourdomain.com +short      # Should show Cloudflare IP
dig api.yourdomain.com +short   # Should show Cloudflare IP
dig minio.yourdomain.com +short # Should show Cloudflare IP
```

**Remember:** You need all 3 DNS records for the app to work:
- `yourdomain.com` → Main application
- `api.yourdomain.com` → Backend API
- `minio.yourdomain.com` → Storage console

---

## 🖥️ Step 4: VPS Deployment (Manual)

### SSH into your VPS:
```bash
ssh root@YOUR_VPS_IP
```

### Clone & Deploy:
```bash
# Create app directory
mkdir -p /srv/app && cd /srv/app

# Clone repository
git clone https://github.com/YOUR-USERNAME/stream-share-hub-v2.git .

# Configure environment
cp .env.example .env
nano .env
# Update: POSTGRES_PASSWORD, JWT_SECRET, MINIO_ROOT_PASSWORD
# Update: DOMAIN (e.g., yourdomain.com)
# Save: Ctrl+O, Enter, Ctrl+X

# Generate secrets (helper)
openssl rand -base64 32  # POSTGRES_PASSWORD
openssl rand -base64 64  # JWT_SECRET
openssl rand -base64 16  # MINIO_ROOT_PASSWORD

# Deploy!
chmod +x deploy.sh
sudo bash deploy.sh
```

### Wait ~5-10 minutes, then visit:
- ✅ Frontend: `https://yourdomain.com`
- ✅ API: `https://api.yourdomain.com/health`
- ✅ MinIO: `https://minio.yourdomain.com`

---

## 🤖 Automated Deployment (GitHub Actions)

After configuring GitHub secrets, every push to `main` branch automatically:
1. Runs tests
2. Builds Docker images
3. Deploys to VPS
4. Takes ~5 minutes

**Just push:**
```bash
git push origin main
```

**View progress:** GitHub → Actions tab

---

## 🔧 Management Commands

### On VPS:

```bash
# View all service status
docker compose -f docker-compose.prod.yml ps

# View logs
docker compose -f docker-compose.prod.yml logs -f

# View specific service logs
docker compose -f docker-compose.prod.yml logs -f api

# Restart services
docker compose -f docker-compose.prod.yml restart

# Update to latest version
cd /srv/app
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build

# Stop everything
docker compose -f docker-compose.prod.yml down

# Manual backup
./backup-cron.sh

# Check disk space
df -h

# Clean up old Docker images
docker system prune -af
```

---

## 🆘 Troubleshooting

### SSL Certificates Not Working?
```bash
# Check Cloudflare SSL/TLS mode (use Flexible or Full)
# Verify Proxy (orange cloud) is enabled in Cloudflare DNS
# Check DNS propagation
dig yourdomain.com +short

# Verify all 3 subdomains resolve
dig api.yourdomain.com +short
dig minio.yourdomain.com +short
```

### Services Not Starting?
```bash
# Check what's running
docker compose -f docker-compose.prod.yml ps

# View all logs
docker compose -f docker-compose.prod.yml logs

# Check database health
docker exec streamshare-db pg_isready -U streamshare

# Verify .env file
cat .env | grep -v PASSWORD
```

### Can't Login / Create Admin?
```bash
# Check API logs
docker logs streamshare-api

# Check database connection
docker exec streamshare-api node -e "const { Pool } = require('pg'); const pool = new Pool({ connectionString: process.env.DATABASE_URL }); pool.query('SELECT NOW()', (err, res) => { console.log(err ? err.message : 'DB OK'); process.exit(); });"

# First user becomes admin automatically
# Just sign up at https://yourdomain.com
```

### Database Issues?
```bash
# Connect to database
docker exec -it streamshare-db psql -U streamshare -d streamshare

# Inside psql:
\dt                    # List tables
\d videos              # Describe videos table
SELECT COUNT(*) FROM videos;
\q                     # Quit
```

---

## 📊 Health Checks

### Quick Test:
```bash
# API health
curl https://api.yourdomain.com/health
# Expected: {"status":"ok"}

# Frontend
curl -I https://yourdomain.com
# Expected: HTTP/2 200

# Database
docker exec streamshare-db pg_isready -U streamshare
# Expected: accepting connections
```

---

## 🎯 Final Checklist

Before going live:

- [ ] Git changes committed and pushed
- [ ] GitHub secrets configured (if using Actions)
- [ ] Domain DNS records added (A records)
- [ ] DNS propagated (wait 5-10 min, verify with `dig`)
- [ ] VPS access confirmed (`ssh root@VPS_IP`)
- [ ] `.env` file configured on VPS with real secrets
- [ ] `deploy.sh` executed successfully
- [ ] All services showing "healthy" in `docker compose ps`
- [ ] Frontend loads at `https://yourdomain.com`
- [ ] API responds at `https://api.yourdomain.com/health`
- [ ] SSL certificates show green lock in browser
- [ ] Admin account created (first signup)
- [ ] Video upload test successful

---

## 🎉 Success!

Your StreamShare Hub is now live at:
```
https://yourdomain.com
```

**One-liner for future updates:**
```bash
ssh root@YOUR_VPS_IP "cd /srv/app && git pull && docker compose -f docker-compose.prod.yml up -d --build"
```

**Or just push to main if using GitHub Actions:**
```bash
git push origin main
```

---

## 📚 Documentation

- **Full README:** `README.md`
- **Deployment Details:** `DEPLOYMENT_SUMMARY.md`
- **Chunked Uploads:** `docs/CHUNKED_UPLOADS_GUIDE.md`
- **Image Optimization:** `docs/IMAGE_OPTIMIZATION.md`
- **STORJ Setup:** `docs/STORJ_SETUP.md`

---

**Version:** 2.0.0  
**Status:** ✅ Production Ready  
**Last Updated:** February 4, 2026
