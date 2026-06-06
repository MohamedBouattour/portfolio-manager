#!/bin/bash
set -e

echo -e "\e[36m=== 1. Building all packages & services ===\e[0m"
npm run build

echo -e "\e[36m=== 2. Packaging workspace (excluding node_modules & git metadata) ===\e[0m"
rm -f deploy.tar.gz
tar -czf deploy.tar.gz --exclude=node_modules --exclude=.git --exclude=.angular --exclude=.gemini --exclude=deploy.tar.gz --exclude=pgdata .

# Determine SSH key path dynamically
SSH_KEY=""
if [ -f "/Users/wecraft/.ssh/id_ed25519" ]; then
    SSH_KEY="-i /Users/wecraft/.ssh/id_ed25519"
elif [ -f "C:/Users/mafam/.ssh/vps_key" ]; then
    SSH_KEY="-i C:/Users/mafam/.ssh/vps_key"
fi

echo -e "\e[36m=== 3. Uploading archive to VM via SCP ===\e[0m"
scp -o StrictHostKeyChecking=no $SSH_KEY deploy.tar.gz root@79.137.14.75:/mnt/main/portfolio/

echo -e "\e[36m=== 4. Extracting archive, starting DB, and reloading PM2 on VM ===\e[0m"
ssh -o StrictHostKeyChecking=no $SSH_KEY root@79.137.14.75 "\
  cd /mnt/main/portfolio && \
  tar -xzf deploy.tar.gz && \
  echo '  → Starting PostgreSQL via Docker Compose...' && \
  docker compose up -d --wait && \
  echo '  → Installing dependencies...' && \
  npm install --omit=dev && \
  echo '  → Restarting PM2 services...' && \
  pm2 restart ecosystem.config.cjs && \
  rm -f deploy.tar.gz && \
  echo '  → Done!'"

echo -e "\e[36m=== 5. Cleaning up local archive ===\e[0m"
rm -f deploy.tar.gz

echo -e "\e[32m=== Deployment Completed Successfully! ===\e[0m"
