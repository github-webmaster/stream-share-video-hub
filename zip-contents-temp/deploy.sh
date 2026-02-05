#!/bin/bash
set -e

echo "=== Stream Share Hub Production Deployment ==="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  echo "Please run as root (sudo ./deploy.sh)"
  exit 1
fi

# Update system
echo "Updating system packages..."
apt update -y
apt upgrade -y

# Install Docker
if ! command -v docker &> /dev/null; then
  echo "Installing Docker..."
  apt install -y apt-transport-https ca-certificates curl software-properties-common
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
  apt update -y
  apt install -y docker-ce docker-ce-cli containerd.io
else
  echo "Docker already installed"
fi

# Install Docker Compose
if ! command -v docker compose &> /dev/null; then
  echo "Installing Docker Compose..."
  apt install -y docker-compose-plugin
else
  echo "Docker Compose already installed"
fi

# Configure UFW firewall
echo "Configuring firewall..."
apt install -y ufw
ufw --force enable
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 8081/tcp
ufw allow 9000/tcp
ufw allow 9001/tcp
ufw --force reload

# Check .env file exists
if [ ! -f .env ]; then
  echo "ERROR: .env file not found!"
  echo "Please copy .env.example to .env and configure it:"
  echo "  cp .env.example .env"
  echo "  nano .env"
  exit 1
fi

# Create required directories
echo "Creating directories..."
mkdir -p ./backups
mkdir -p ./data/videos/chunks
chmod 755 ./backups
chmod 755 ./data/videos

# Pull latest images
echo "Pulling Docker images..."
docker compose -f docker-compose.prod.yml pull

# Build and start services
echo "Building and starting services..."
docker compose -f docker-compose.prod.yml up -d --build

# Wait for services to be healthy
echo "Waiting for services to start..."
sleep 10

# Check service status
echo ""
echo "=== Service Status ==="
docker compose -f docker-compose.prod.yml ps

# Setup backup cron job
echo "Setting up automated backups..."
if [ -f backup-cron.sh ]; then
  chmod +x backup-cron.sh
  # Add cron job if not exists
  (crontab -l 2>/dev/null | grep -v backup-cron.sh; echo "0 2 * * * $(pwd)/backup-cron.sh") | crontab -
  echo "Backup cron job installed (runs daily at 2 AM)"
fi

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "Services:"
echo "  Frontend: https://${DOMAIN:-yourdomain.com}"
echo "  API: https://api.${DOMAIN:-yourdomain.com}"
echo "  MinIO Console: https://minio.${DOMAIN:-yourdomain.com}"
echo ""
echo "IMPORTANT: Configure Cloudflare DNS:"
echo "  1. Add A record @ -> YOUR_SERVER_IP (Proxied)"
echo "  2. Add A record api -> YOUR_SERVER_IP (Proxied)"
echo "  3. Add A record minio -> YOUR_SERVER_IP (Proxied)"
echo "  4. Set SSL/TLS mode to Flexible or Full in Cloudflare"
echo ""
echo "View logs:"
echo "  docker compose -f docker-compose.prod.yml logs -f"
echo ""
echo "Restart services:"
echo "  docker compose -f docker-compose.prod.yml restart"
echo ""
echo "Stop services:"
echo "  docker compose -f docker-compose.prod.yml down"
echo ""
