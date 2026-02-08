# StreamShare Hub - Private Video Platform

🎥 **A modern, self-hosted video sharing platform with privacy-first design.**

Securely host and share your personal video collection with complete control over your data.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-Ready-3178c6.svg)

## ⚡ Quick Start

**For Developers (Local Development):**
```bash
# Clone the repository
git clone https://github.com/yourusername/streamshare-hub.git
cd streamshare-hub

# Start with Docker (recommended)
docker compose up -d

# Access the app at http://localhost:4000
```

## 🚀 Production VPS Deployment

**One-command deployment on fresh Ubuntu VPS:**
```bash
sudo bash deploy.sh
```

**That's it!** Your site goes live at `https://yourdomain.com` 🎉

See [VPS Deployment Guide](#-vps-deployment-production) below for full setup.

---

## Overview

StreamShare Hub is a private, self-hosted video platform with resumable uploads, chunked transfers, and S3/STORJ storage support. Built with Docker for easy deployment.

## Features

### Core Features
- **Private Video Hosting** - Videos remain private until you explicitly share them
- **Secure Share Links** - Generate unique, secure links for each video
- **User Authentication** - Secure user accounts with role-based access
- **Drag & Drop Upload** - Simple file upload with progress tracking
- **Resumable Chunked Uploads** - Upload large files with automatic resume capability (NEW!)
- **Video Management** - Organize, edit titles, and delete videos
- **View Analytics** - Track video views and engagement
- **Mobile Responsive** - Works seamlessly on all devices
- **STORJ S3 Integration** - Decentralized cloud storage with automatic fallback

### Privacy & Security
- **Row-Level Security** - Database-level access controls
- **Encrypted Storage** - Videos stored with encryption at rest
- **Secure Authentication** - JWT-based user authentication
- **Privacy Controls** - Public/private video visibility settings
- **No Tracking** - No analytics or tracking on user behavior

### Performance
- **Optimized Database Queries** - Selective column loading for faster responses
- **Memoized Functions** - Reduced re-renders with useCallback optimization
- **Efficient Pagination** - Client-side pagination with configurable items per page
- **Lazy Loading** - Video thumbnails load on demand
- **Image Optimization** - Automatic WebP/AVIF conversion with responsive sizes (NEW!)
- **CDN Integration Ready** - Prepared for global content delivery

## Technology Stack

### Frontend
- **React 18** - Modern UI framework with hooks
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - Pre-built UI components
- **Lucide React** - Icon library
- **Sonner** - Toast notifications

### Backend & Database
- **Express.js** - RESTful API server
- **Node.js** - JavaScript runtime
- **PostgreSQL 15** - Primary database with Row-Level Security
- **bcrypt** - Secure password hashing
- **JWT** - Token-based authentication
- **AWS SDK** - S3-compatible storage client
- **Docker** - Containerized deployment
- **Local/S3/STORJ/MinIO Storage** - Multi-provider storage system

### Development Tools
- **Vite** - Fast development server and build tool
- **ESLint** - Code linting and formatting
- **Vitest** - Unit testing framework

## Architecture

### Database Schema
```sql
-- Users and authentication
public.users (via Express API + JWT)
public.user_roles (admin/user roles)

-- Video content
public.videos (video metadata, storage paths, view counts)

-- Storage configuration (for multi-provider support)
public.storage_config (S3, STORJ, MinIO, local storage settings)

-- Upload tracking
public.upload_progress (chunked upload state)
public.user_quotas (storage quotas per user)
```

### Security Model
- **Row Level Security (RLS)** - Database-level access controls
- **JWT Authentication** - Secure token-based session management
- **bcrypt Password Hashing** - Industry-standard password encryption
- **API Rate Limiting** - Prevent abuse and ensure fair usage
- **Input Validation** - Client and server-side validation
- **Helmet.js** - Security headers and CSRF protection

### Storage Architecture
- **Primary Storage** - Local filesystem (default)
- **S3-Compatible** - AWS S3, MinIO, DigitalOcean Spaces
- **STORJ** - Decentralized cloud storage
- **Flexible Backend** - Easy to add new storage providers

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn package manager
- PostgreSQL 15+ (or use Docker)
- Docker & Docker Compose (recommended)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/streamshare-hub.git
   cd streamshare-hub
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd server && npm install && cd ..
   ```

3. **Environment variables**
   Copy `.env.example` to `.env` and configure:
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials and JWT secret
   ```

4. **Start with Docker (recommended)**
   ```bash
   docker compose up -d
   ```

5. **Access the application**
   - Frontend: http://localhost:4000
   - API: http://localhost:8081
   - MinIO Console: http://localhost:9001

## 📦 VPS Deployment (Production)

### Prerequisites
- Ubuntu 22.04+ VPS with root access
- Domain name pointing to your VPS IP
- 2GB+ RAM, 20GB+ storage recommended

### Step 1: Prepare Your VPS

**SSH into your server:**
```bash
ssh root@your-server-ip
```

**Update and create app directory:**
```bash
apt update && apt upgrade -y
mkdir -p /srv/app
cd /srv/app
```

### Step 2: Clone Repository

```bash
git clone https://github.com/YOUR-USERNAME/stream-share-hub-v2.git .
```

### Step 3: Configure Environment Variables

**Copy example environment file:**
```bash
cp .env.example .env
nano .env
```

**Required secrets to change in `.env`:**

```bash
# 🔐 CRITICAL: Change these BEFORE deploying!

# Database (use strong 32+ character passwords)
POSTGRES_PASSWORD=CHANGE_ME_STRONG_PASSWORD_MIN_32_CHARS

# JWT Secret (generate with: openssl rand -base64 64)
JWT_SECRET=CHANGE_ME_GENERATE_64_RANDOM_CHARS

# MinIO Storage
MINIO_ROOT_PASSWORD=CHANGE_ME_MINIO_PASSWORD_MIN_16_CHARS

# Your Domain Name
DOMAIN=yourdomain.com

# Frontend URLs (match your domains)
VITE_API_URL=https://api.yourdomain.com
VITE_MEDIA_URL=https://api.yourdomain.com/media
CORS_ORIGIN=https://yourdomain.com
```

**Quick password generation:**
```bash
# Generate strong passwords
openssl rand -base64 32  # For POSTGRES_PASSWORD
openssl rand -base64 64  # For JWT_SECRET
openssl rand -base64 16  # For MINIO_ROOT_PASSWORD
```

### Step 4: Cloudflare DNS Configuration

> **⚠️ IMPORTANT:** This stack requires Cloudflare for SSL/TLS and domain management.

**Add these 3 DNS records in Cloudflare:**

| Type | Name | Content | Proxy Status | TTL |
|------|------|---------|--------------|-----|
| A | @ | YOUR_VPS_IP | Proxied (Orange Cloud) | Auto |
| A | api | YOUR_VPS_IP | Proxied (Orange Cloud) | Auto |
| A | minio | YOUR_VPS_IP | Proxied (Orange Cloud) | Auto |

**SSL/TLS Configuration in Cloudflare:**

1. Go to **SSL/TLS** → **Overview**
2. Choose one of these options:
   - **Flexible** (Recommended for quick setup): Cloudflare ↔️ Visitor is encrypted, Cloudflare ↔️ Server is not
   - **Full** (Better security): Cloudflare ↔️ Visitor encrypted, Cloudflare ↔️ Server encrypted (self-signed OK)
   - **Full (Strict)**: Requires valid SSL certificate on your server

> **💡 TIP:** Start with **Flexible** mode for quick deployment. Upgrade to **Full** later for better security.

**DNS Propagation:**
```bash
# Verify DNS is pointing to your VPS
dig yourdomain.com +short      # Should show Cloudflare IP
dig api.yourdomain.com +short   # Should show Cloudflare IP
dig minio.yourdomain.com +short # Should show Cloudflare IP
```

**The 3 required DNS records:**
- `yourdomain.com` → Your main application
- `api.yourdomain.com` → Backend API
- `minio.yourdomain.com` → MinIO storage console

### Step 5: Deploy! 🚀

**Run the deployment script:**
```bash
chmod +x deploy.sh
sudo bash deploy.sh
```

**What this does:**
- ✅ Installs Docker & Docker Compose
- ✅ Configures firewall (ports 22, 80, 443, 8081, 9000, 9001)
- ✅ Creates directories for data and backups
- ✅ Builds and starts all services
- ✅ Configures automated database backups

**Deployment takes ~5-10 minutes.** Coffee time! ☕

### Step 6: Verify Deployment

```bash
# Check all services are running
docker compose -f docker-compose.prod.yml ps

# Should see:
# ✅ streamshare-db (running, healthy)
# ✅ streamshare-minio (running, healthy)
# ✅ streamshare-api (running, healthy)
# ✅ streamshare-frontend (running)
```

**Test your sites:**
- Frontend: `https://yourdomain.com`
- API Health: `https://api.yourdomain.com/health`
- MinIO Console: `https://minio.yourdomain.com`

### Step 7: Create Admin User

**First registered user becomes admin automatically!**

1. Visit `https://yourdomain.com`
2. Click "Sign Up"
3. Enter your email and password
4. You're now the admin! 🎉

### 🔧 Management Commands

```bash
# View logs
docker compose -f docker-compose.prod.yml logs -f

# View specific service logs
docker compose -f docker-compose.prod.yml logs -f api

# Restart services
docker compose -f docker-compose.prod.yml restart

# Stop services
docker compose -f docker-compose.prod.yml down

# Update to latest version
cd /srv/app
git pull
docker compose -f docker-compose.prod.yml up -d --build

# Manual database backup
./backup-cron.sh
```

### 🔄 Automated Backups

The system includes a built-in automated backup service for the PostgreSQL database.

**Features:**
- **Schedule**: Defaults to 2 AM daily (configurable in Admin Panel).
- **Retention**: Keeps last 30 backups (configurable).
- **Storage**: Backups are stored in `/backups` (mounted to host `server/backups`).
- **Scope**: Backs up the **Database structure and data only**. Video files are stored separately (disk or S3) and must be backed up independently.

**Managing Backups:**
1. Go to **Admin Panel > Backups**.
2. Enable/Disable automated backups.
3. Update the Cron schedule and retention policy.
4. Manually trigger a backup.
5. Download or view recent backup files.

**Restoring from Backup:**

To restore a backup, you must use the command line on the host machine.

```bash
# 1. List backups to find the usage filename
ls -lh ./server/backups/

# 2. Restore specific backup (replace filename)
# This command pipes the decompressed SQL directly into the database container
gunzip -c ./server/backups/db-backup-YYYYMMDD-HHMMSS.sql.gz | \
  docker exec -i streamshare-db psql -U streamshare -d streamshare
```

> **Warning**: Restoring a backup will overwrite the current database state. Ensure you have a fresh backup before restoring if possible.


---

## 🤖 GitHub Actions CI/CD (Optional)

Automate deployments on every `git push` to main branch.

### Setup GitHub Secrets

**Go to:** `GitHub Repo → Settings → Secrets and variables → Actions → New repository secret`

**Add these secrets:**

| Secret Name | Description | Example |
|------------|-------------|---------|
| `VPS_HOST` | Your VPS IP address | `123.45.67.89` |
| `VPS_USER` | SSH username (usually `root`) | `root` |
| `VPS_SSH_KEY` | Private SSH key for VPS | `-----BEGIN OPENSSH...` |
| `VPS_PATH` | App path on VPS | `/srv/app` |
| `VITE_API_URL` | Production API URL | `https://api.yourdomain.com` |
| `VITE_MEDIA_URL` | Production media URL | `https://api.yourdomain.com/media` |

### Generate SSH Key for GitHub Actions

**On your local machine:**
```bash
# Generate new SSH key pair
ssh-keygen -t ed25519 -f github-actions-key -N ""

# Copy public key to VPS
ssh-copy-id -i github-actions-key.pub root@YOUR_VPS_IP

# Copy private key content for GitHub secret
cat github-actions-key
# Copy the entire output and paste as VPS_SSH_KEY secret
```

### Push to Deploy

```bash
# Make changes locally
git add .
git commit -m "Update feature"
git push origin main

# GitHub Actions will automatically:
# 1. Run tests
# 2. Build Docker images
# 3. Push to GitHub Container Registry
# 4. SSH to VPS and deploy
# 5. Your site updates in ~5 minutes! 🎉
```

**View deployment status:**
- GitHub → Your Repo → Actions tab

---

## 🐳 Local Development

### Quick Start (Docker)

```bash
# Start all services
docker compose up -d

# Frontend: http://localhost:4000
# API: http://localhost:8081
# MinIO: http://localhost:9001
```

### Manual Setup

1. **Install dependencies:**
   ```bash
   npm install
   cd server && npm install && cd ..
   ```

2. **Start backend:**
   ```bash
   cd server
   npm start
   ```

3. **Start frontend** (new terminal):
   ```bash
   npm run dev
   ```

4. **Run tests:**
   ```bash
   npm test
   ```

### Local Environment Variables

Create `.env.local` in project root:
```bash
VITE_API_URL=http://localhost:8081
VITE_MEDIA_URL=http://localhost:8081/media
```

---

## 📋 Recent Changes (v2.0)

### Production Deployment System ✅
- **Added:** `docker-compose.prod.yml` - Production orchestration with Cloudflare SSL
- **Added:** `deploy.sh` - One-command VPS deployment script
- **Added:** `api.Dockerfile.prod` - Optimized backend Docker image
- **Added:** `frontend.Dockerfile.prod` - Optimized frontend with Nginx
- **Added:** `.env.example` - Complete environment variable template
- **Added:** `entrypoint.sh` - Database migration handling on startup
- **Added:** `backup-cron.sh` - Automated daily database backups

### GitHub Actions Workflows ✅
- **Added:** `.github/workflows/prod-deploy.yml` - Full CI/CD pipeline
- **Added:** `.github/workflows/deploy.yml` - Simple VPS deployment

### Backend API (`/server`) ✅
- **Created:** Express.js REST API with JWT authentication
- **Created:** PostgreSQL integration with chunked upload support
- **Created:** S3/STORJ/MinIO multi-storage backend
- **Created:** Resumable upload endpoints with progress tracking

### Features Added ✅
- **Chunked Uploads:** Resume interrupted uploads automatically
- **Image Optimization:** WebP/AVIF conversion with 96% size reduction
- **Global Upload Manager:** Track multiple uploads simultaneously
- **Admin Panel:** Storage configuration and user management
- **Storage Quota System:** Per-user storage limits with visual indicators

### Infrastructure ✅
- **Cloudflare:** SSL/TLS termination and CDN
- **MinIO:** Self-hosted S3-compatible storage
- **PostgreSQL 16:** High-performance database with RLS
- **Nginx:** Static frontend serving with compression

---

## 🎬 Deployment Summary

**Total deployment time:** ~15 minutes

**What you get:**
- ✅ Fully functional video platform at `https://yourdomain.com`
- ✅ SSL/TLS via Cloudflare
- ✅ Database backups every night at 2 AM
- ✅ Production-ready with Docker containers
- ✅ Easy updates via `git pull` or GitHub Actions
- ✅ Admin panel for system configuration
- ✅ Multiple storage backends (local/S3/STORJ)

**Deploy command:**
```bash
sudo bash deploy.sh
```

**Access your platform:**
```
https://yourdomain.com = Live! 🎉
```

---

## Deployment Options (Alternative)

- **Docker Compose** - Recommended for VPS (see above)
- **Kubernetes** - For large-scale deployments
- **Vercel/Netlify** - Frontend only (requires separate backend)
- **AWS/GCP/Azure** - Enterprise cloud platforms

## API Reference

### Authentication
```typescript
// Sign up
const response = await fetch('/api/auth/signup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});
const { token, user } = await response.json();

// Sign in
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});
const { token, user } = await response.json();
```

### Video Operations
```typescript
// Fetch user videos
const response = await fetch('/api/videos', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { videos } = await response.json();

// Upload video (chunked)
const formData = new FormData();
formData.append('chunk', chunkBlob);
formData.append('chunkNumber', '1');

const response = await fetch(`/api/upload/chunk/${sessionId}`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData
});
```

## Configuration

### User Roles
- **Admin** - Full system access, storage configuration
- **User** - Standard video upload and management
- **Anonymous** - Public video viewing only

### Storage Providers
- **Local Storage** - Default filesystem storage
- **S3 Compatible** - AWS S3, DigitalOcean Spaces
- **MinIO** - Self-hosted S3-compatible storage
- **STORJ** - Decentralized cloud storage (integration ready)

### Video Limits
- **File Size** - Configurable per user tier
- **File Types** - Video formats only (mp4, mov, avi, etc.)
- **Storage Quota** - Per-user storage limits
- **Rate Limits** - Upload and API request limits

## Performance Optimizations

### Database
- **Selective Queries** - Only fetch required columns
- **Indexing** - Optimized for user_id and created_at
- **Connection Pooling** - PostgreSQL connection pool management
- **Row-Level Security** - Database-level access control

### Frontend
- **Memoization** - useCallback for expensive functions
- **Lazy Loading** - Video thumbnails on scroll
- **Code Splitting** - RoutModern formats (WebP/AVIF) with responsive sizes
- **Build-Time Compression** - Automatic image optimization during build
- **Image Optimization** - Responsive video thumbnails

### Network
- **CDN Ready** - Prepared for global CDN integration
- **Compression** - Gzip compression enabled
- **Caching** - Browser and CDN caching strategies

## Security Considerations

### Data Protection
- **Encryption at Rest** - Database and storage encryption
- **Encryption in Transit** - HTTPS/TLS for all communications
- **Input Sanitization** - XSS and injection prevention
- **Access Controls** - Role-based permissions

### Privacy Features
- **No Tracking** - No user analytics or tracking
- **Data Minimization** - Only collect necessary data
- **User Control** - Users control their data
- **Transparent Policies** - Clear privacy practices

## Development

### Project Structure
```
src/
├── components/          # Reusable UI components
│   ├── ui/             # Base UI components
│   ├── VideoCard.tsx   # Video display component
│   └── Navbar.tsx      # Navigation component
├── pages/              # Page components
│   ├── Dashboard.tsx   # Main dashboard
│   ├── VideoPlayer.tsx # Video player page
│   └── Profile.tsx     # User profile
├── hooks/              # Custom React hooks
│   └── useAuth.tsx     # Authentication hook
├── integrations/       # External service integrations
│   └── (removed)       # Now fully self-hosted
└── lib/                # Utility functions
    └── utils.ts        # Helper functions
```

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview
- `npm run optimize:images` - Optimize images to WebP/AVIF formats production build
- `npm run test` - Run unit tests
- `npm run lint` - Run ESLint

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## STORJ S3 Integration (Optional)

StreamShare Hub supports decentralized cloud storage via STORJ S3 with automatic fallback to Supabase Storage.

### Features
- ✅ Decentralized cloud storage
- ✅ S3-compatible API
- ✅ Automatic fallback to Supabase
- ✅ Admin panel configuration
- ✅ Real-time progress tracking
- ✅ Error handling with retries

### Quick Setup

1. **Create STORJ account** at https://www.storj.io/
2. **Generate S3 credentials** (Access Key, Secret Key)
3. **Create a bucket** for your videos
4. **Configure in Admin Panel** (`/admin` route)
5. **Toggle STORJ ON** and enter credentials
6. **Test connection** and save

### Documentation
- **Setup Guide**: See `docs/STORJ_SETUP.md` for detailed instructions
- **Implementation Details**: See `docs/IMPLEMENTATION_SUMMARY.md`

### Default Behavior

## Image Optimization

StreamShare Hub includes automatic image optimization for superior performance and reduced bandwidth usage.

### Features
- ✅ Automatic WebP and AVIF conversion
- ✅ Responsive image sizes (640px to 2560px)
- ✅ Up to 96% file size reduction
- ✅ Build-time and manual optimization
- ✅ Automatic browser format detection
- ✅ Graceful fallback for older browsers

### Quick Start

**Optimize existing images:**
```bash
npm run optimize:images
```

**Use in React components:**
```tsx
import { OptimizedImage } from '@/components/OptimizedImage';

<OptimizedImage 
  src="/assets/background.jpg"
  alt="Background"
  sizes="100vw"
/>
```

### Performance Gains

Real results from our background images:

| Image | Original | AVIF | Savings |
|-------|----------|------|---------|
| wallpaper-1.jpg (5000px) | ~500KB | 19KB | **96%** |
| wallpaper-2.jpg (3000px) | ~800KB | 204KB | **74%** |

### Documentation
- **Complete Guide**: See `docs/IMAGE_OPTIMIZATION.md` for detailed usage
- **Example Code**: See `src/examples/ImageOptimizationExample.tsx`

### How It Works
1. **Build-time**: Vite plugin automatically optimizes images during production builds
2. **Manual**: Run `npm run optimize:images` for static assets
3. **Runtime**: `<OptimizedImage>` component serves best format per browser
4. **Formats**: Serves AVIF → WebP → JPEG based on browser support
- First registered user becomes admin automatically
- STORJ is optional - Supabase Storage works out of the box
- Fallback to Supabase if STORJ fails or not configured

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue in the GitHub repository
- Check the documentation in `docs/` folder
- Review the FAQ section

---

Built with React, TypeScript, Supabase, and STORJ for secure private video hosting.
