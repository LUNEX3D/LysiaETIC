#!/bin/bash
# Sunucuda çalıştırın: bash apply-seo-server.sh
# robots.txt / sitemap.xml — backend + nginx

set -e
cd ~/LysiaETIC || exit 1
git pull origin main
cd backend && npm install --omit=dev
pm2 restart backend

if [ -f ~/nginx-default.conf ]; then
  sudo cp ~/nginx-default.conf /etc/nginx/sites-available/default
  sudo ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default
fi

if [ -d ~/build ]; then
  sudo cp -f ~/LysiaETIC/frontend/public/robots.txt /var/www/html/robots.txt 2>/dev/null || true
  sudo cp -f ~/LysiaETIC/frontend/public/sitemap.xml /var/www/html/sitemap.xml 2>/dev/null || true
  sudo cp -f ~/LysiaETIC/backend/seo/robots.txt /var/www/html/robots.txt 2>/dev/null || true
  sudo cp -f ~/LysiaETIC/backend/seo/sitemap.xml /var/www/html/sitemap.xml 2>/dev/null || true
fi

sudo nginx -t && sudo systemctl reload nginx

echo "--- robots.txt (backend) ---"
curl -sS http://127.0.0.1:5000/robots.txt | head -5
echo "--- sitemap.xml (backend) ---"
curl -sS http://127.0.0.1:5000/sitemap.xml | head -5
