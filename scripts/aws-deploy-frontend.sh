#!/bin/bash
# EC2 uzerinde veya SSH ile: frontend build'i /var/www/html'e kopyalar
set -euo pipefail

BUILD_SRC="${1:-$HOME/build}"
WWW="/var/www/html"

if [ ! -f "$BUILD_SRC/index.html" ]; then
  echo "HATA: $BUILD_SRC/index.html yok. Once yerelde: cd frontend && npm run build"
  echo "Sonra: scp -r frontend/build/* user@sunucu:~/build/"
  exit 1
fi

if ! grep -q 'id="root"' "$BUILD_SRC/index.html" 2>/dev/null; then
  echo "HATA: Bu gercek React build degil (id=root yok)."
  exit 1
fi

sudo rm -rf "$WWW"/*
sudo cp -r "$BUILD_SRC"/* "$WWW"/
sudo chown -R www-data:www-data "$WWW"
sudo chmod -R 755 "$WWW"

if [ -f "$HOME/nginx-default.conf" ]; then
  sudo cp "$HOME/nginx-default.conf" /etc/nginx/sites-available/default
  sudo ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default
  sudo nginx -t
  sudo systemctl reload nginx
fi

echo "OK: Frontend yayinda."
head -c 120 "$WWW/index.html" | tr '\n' ' '
echo ""
