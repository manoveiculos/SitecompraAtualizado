#!/usr/bin/env bash
# One-command deploy for the VPS (run from the project folder): bash deploy.sh
set -euo pipefail
cd "$(dirname "$0")"

echo "==> 1/4 Pulling latest code"
git pull --ff-only

echo "==> 2/4 Installing dependencies"
npm ci

echo "==> 3/4 Building (generates dist/ AND server.js)"
npm run build

echo "==> 4/4 (Re)starting with PM2"
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save

echo ""
echo "✅ Deploy concluído. App em produção na porta 3000 (proxy do nginx)."
echo "   Valide: /estoque  /sobre  /sitemap.xml  /llms.txt  /radar-manos"
