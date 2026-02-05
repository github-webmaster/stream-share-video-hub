# StreamShare Hub - VPS Deployment Package Creator
# Creates a production-ready ZIP package for one-click VPS deployment

Write-Host "Creating StreamShare Hub VPS Deployment Package..." -ForegroundColor Green

# Package info
$packageName = "streamshare-hub-deploy-v1.0.0"
$packagePath = ".\$packageName.zip"
$tempDir = ".\deploy-temp"

# Clean up previous artifacts
If (Test-Path $packagePath) { Remove-Item $packagePath }
If (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }
New-Item -ItemType Directory -Path $tempDir | Out-Null

# Build frontend
Write-Host "Building frontend..." -ForegroundColor Cyan
npm run build
If (!(Test-Path "dist")) { Write-Host "Frontend build failed." -ForegroundColor Red; exit 1 }
Copy-Item "dist" -Destination "$tempDir\dist" -Recurse

# Copy backend
If (Test-Path "server") { Copy-Item "server" -Destination "$tempDir\server" -Recurse }

# Copy Dockerfiles and configs
$dockerFiles = @("api.Dockerfile.prod", "frontend.Dockerfile.prod", "docker-compose.prod.yml", "docker-compose.yml")
Foreach ($file in $dockerFiles) { If (Test-Path $file) { Copy-Item $file -Destination $tempDir } }

# Copy docs
$docs = @("README.md", "DEPLOYMENT_SUMMARY.md", "QUICK_START.md")
Foreach ($file in $docs) { If (Test-Path $file) { Copy-Item $file -Destination $tempDir } }

# Copy scripts
$scripts = @("entrypoint.sh", "deploy.sh", "backup-cron.sh")
Foreach ($file in $scripts) { If (Test-Path $file) { Copy-Item $file -Destination $tempDir } }

# Add migrations
If (Test-Path "migrations") { Copy-Item "migrations" -Destination $tempDir -Recurse }

# Add any other needed folders/files (customize as needed)
# If (Test-Path "docker") { Copy-Item "docker" -Destination $tempDir -Recurse }

# Create ZIP
Write-Host "Creating ZIP package..." -ForegroundColor Cyan
Compress-Archive -Path "$tempDir/*" -DestinationPath $packagePath

# Clean up temp folder
Remove-Item -Recurse -Force $tempDir

Write-Host "Done! Created $packageName.zip" -ForegroundColor Green
Write-Host "Ready for VPS deployment!"