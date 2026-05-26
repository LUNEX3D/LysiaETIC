#!/bin/bash
# EC2 Instance Connect / SSH — SADECE sunucu tarafi (PowerShell DEGIL)
# Frontend icin yerelde once: powershell -File deploy-frontend.ps1
# Bu script: repo + backend + varsa ~/build -> /var/www/html

set -euo pipefail

REPO="$HOME/LysiaETIC"
BUILD="$HOME/build"
WWW="/var/www/html"

echo "=== Dashtock — sunucu deploy ==="

if [[ ! -d "$REPO/.git" ]]; then
  echo "Repo yok. Klonlaniyor..."
  git clone https://github.com/LUNEX3D/LysiaETIC.git "$REPO"
fi

cd "$REPO"
git fetch --all
git reset --hard origin/main

if [[ ! -f backend/.env ]]; then
  echo "HATA: $REPO/backend/.env yok."
  echo "Yerel PC'den: scp -i key.pem backend/.env ubuntu@SUNUCU_IP:~/LysiaETIC/backend/.env"
  exit 1
fi

echo "Backend npm + pm2..."
cd "$REPO/backend"
npm install --omit=dev
pm2 describe backend >/dev/null 2>&1 && pm2 restart backend || pm2 start ecosystem.config.cjs
pm2 save

if [[ -f "$BUILD/index.html" ]] && grep -q 'id="root"' "$BUILD/index.html"; then
  echo "Frontend ~/build -> $WWW"
  sudo rm -rf "$WWW"/*
  sudo cp -r "$BUILD"/* "$WWW"/
  mkdir -p "$REPO/frontend/build"
  cp -r "$BUILD"/* "$REPO/frontend/build/"
elif [[ -f "$REPO/frontend/build/index.html" ]]; then
  echo "Frontend repo build -> $WWW"
  sudo rm -rf "$WWW"/*
  sudo cp -r "$REPO/frontend/build"/* "$WWW"/
else
  echo "UYARI: React build yok. Yerel Windows'ta calistirin:"
  echo "  cd D:\\LysiaETIC"
  echo "  powershell -File deploy-frontend.ps1 -Server ubuntu@$(curl -sS http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo SUNUCU_IP)"
fi

if [[ -f "$REPO/nginx-default.conf" ]]; then
  sudo cp "$REPO/nginx-default.conf" /etc/nginx/sites-available/default
  sudo ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default
  sudo nginx -t && sudo systemctl reload nginx
fi

sudo chown -R www-data:www-data "$WWW" 2>/dev/null || true
echo "Bitti."
pm2 list | head -6
grep -oE 'Dashtock|PAZARYONET|id=\"root\"' "$WWW/index.html" 2>/dev/null | head -3 || true
