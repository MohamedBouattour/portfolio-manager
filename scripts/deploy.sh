#!/bin/bash
set -e

echo -e "\e[36m=== 1. Building all packages & services ===\e[0m"
npm run build

echo -e "\e[36m=== 2. Packaging workspace (excluding node_modules & git metadata) ===\e[0m"
rm -f deploy.tar.gz
tar -czf deploy.tar.gz --exclude=node_modules --exclude=.git --exclude=.angular --exclude=.gemini --exclude=deploy.tar.gz .

echo -e "\e[36m=== 3. Uploading archive to VM via SCP ===\e[0m"
scp -o StrictHostKeyChecking=no -i C:/Users/mafam/.ssh/vps_key deploy.tar.gz root@79.137.14.75:/mnt/main/portfolio/

echo -e "\e[36m=== 4. Extracting archive and reloading PM2 on VM ===\e[0m"
ssh -o StrictHostKeyChecking=no -i C:/Users/mafam/.ssh/vps_key root@79.137.14.75 "cd /mnt/main/portfolio && tar -xzf deploy.tar.gz && npm install --omit=dev && pm2 restart ecosystem.config.cjs && rm -f deploy.tar.gz"

echo -e "\e[36m=== 5. Cleaning up local archive ===\e[0m"
rm -f deploy.tar.gz

echo -e "\e[32m=== Deployment Completed Successfully! ===\e[0m"
