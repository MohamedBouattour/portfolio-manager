$ErrorActionPreference = "Stop"

Write-Host "=== 1. Building all packages & services ===" -ForegroundColor Cyan
npm run build

Write-Host "=== 2. Packaging workspace (excluding node_modules & git metadata) ===" -ForegroundColor Cyan
if (Test-Path deploy.tar.gz) {
    Remove-Item deploy.tar.gz -Force
}
# Pack workspace
tar -czf deploy.tar.gz --exclude=node_modules --exclude=.git --exclude=.angular --exclude=.gemini --exclude=deploy.tar.gz .

Write-Host "=== 3. Uploading archive to VM via SCP ===" -ForegroundColor Cyan
scp -o StrictHostKeyChecking=no -i C:\Users\mafam\.ssh\vps_key deploy.tar.gz root@79.137.14.75:/mnt/main/portfolio/

Write-Host "=== 4. Extracting archive and reloading PM2 on VM ===" -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i C:\Users\mafam\.ssh\vps_key root@79.137.14.75 "cd /mnt/main/portfolio && tar -xzf deploy.tar.gz && npm install --omit=dev && pm2 restart ecosystem.config.cjs && rm -f deploy.tar.gz"

Write-Host "=== 5. Cleaning up local archive ===" -ForegroundColor Cyan
if (Test-Path deploy.tar.gz) {
    Remove-Item deploy.tar.gz -Force
}

Write-Host "=== Deployment Completed Successfully! ===" -ForegroundColor Green
