#!/bin/bash
# Dashtock EC2 — ilk kurulum / onarim (Ubuntu 22.04+)
# Calistirma: bash ~/aws-setup-ec2.sh
# veya yerelden: scp scripts/aws-setup-ec2.sh ubuntu@IP:~/ && ssh ... bash ~/aws-setup-ec2.sh

set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/LUNEX3D/LysiaETIC.git}"
REPO_DIR="${REPO_DIR:-$HOME/LysiaETIC}"
DOMAIN="${DOMAIN:-dashtock.com}"
WWW="/var/www/html"

echo "=== Dashtock EC2 setup ==="
echo "Domain: $DOMAIN"
echo ""

# --- Paketler ---
echo "[1/7] Sistem paketleri..."
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
  nginx git curl ca-certificates ufw \
  build-essential

# Node 20 (NodeSource)
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -c2-3)" -lt 18 ]]; then
  echo "[2/7] Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y -qq nodejs
else
  echo "[2/7] Node zaten: $(node -v)"
fi

# PM2
if ! command -v pm2 >/dev/null 2>&1; then
  echo "[3/7] PM2..."
  sudo npm install -g pm2
else
  echo "[3/7] PM2 zaten kurulu"
fi

# UFW
echo "[4/7] Firewall (22, 80, 443)..."
sudo ufw --force reset >/dev/null 2>&1 || true
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo ufw status | head -10

# Nginx
echo "[5/7] Nginx..."
sudo systemctl enable nginx
sudo systemctl start nginx

# Repo (opsiyonel — zaten varsa atla)
if [[ ! -d "$REPO_DIR/.git" ]]; then
  echo "[6/7] Repo klonlaniyor: $REPO_DIR"
  mkdir -p "$(dirname "$REPO_DIR")"
  git clone "$REPO_URL" "$REPO_DIR" || echo "UYARI: git clone basarisiz — REPO_URL duzeltin veya manuel klonlayin"
else
  echo "[6/7] Repo mevcut: $REPO_DIR"
fi

if [[ -d "$REPO_DIR/backend" ]]; then
  echo "Backend npm install..."
  cd "$REPO_DIR/backend"
  npm install --omit=dev
  if [[ -f ecosystem.config.cjs ]]; then
    pm2 describe backend >/dev/null 2>&1 && pm2 restart backend || pm2 start ecosystem.config.cjs
    pm2 save
    sudo env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$USER" --hp "$HOME" | tail -1 | sudo bash || true
  fi
fi

# www klasoru
echo "[7/7] /var/www/html hazirlik..."
sudo mkdir -p "$WWW"
if [[ -f "$HOME/build/index.html" ]] && grep -q 'id="root"' "$HOME/build/index.html" 2>/dev/null; then
  sudo rm -rf "$WWW"/*
  sudo cp -r "$HOME/build"/* "$WWW"/
  echo "Frontend ~/build'den kopyalandi."
elif [[ -f "$REPO_DIR/frontend/build/index.html" ]] && grep -q 'id="root"' "$REPO_DIR/frontend/build/index.html" 2>/dev/null; then
  sudo rm -rf "$WWW"/*
  sudo cp -r "$REPO_DIR/frontend/build"/* "$WWW"/
  echo "Frontend repo build'den kopyalandi."
else
  echo "UYARI: React build yok — yerelde deploy-frontend.ps1 calistirin."
  if [[ -f "$WWW/index.html" ]] && grep -qi 'PAZARYONET' "$WWW/index.html" 2>/dev/null; then
    echo "UYARI: /var/www/html hala eski PAZARYONET placeholder!"
  fi
fi

if [[ -f "$HOME/nginx-default.conf" ]]; then
  sudo cp "$HOME/nginx-default.conf" /etc/nginx/sites-available/default
  sudo ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default
  sudo rm -f /etc/nginx/sites-enabled/default.bak 2>/dev/null || true
elif [[ -f "$REPO_DIR/nginx-default.conf" ]]; then
  sudo cp "$REPO_DIR/nginx-default.conf" /etc/nginx/sites-available/default
  sudo ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default
fi

if [[ -f /etc/nginx/sites-available/default ]]; then
  if sudo nginx -t 2>/dev/null; then
    sudo systemctl reload nginx
  else
    echo "UYARI: nginx -t basarisiz — SSL sertifikasi eksik olabilir."
    echo "  sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
  fi
fi

sudo chown -R www-data:www-data "$WWW" 2>/dev/null || true
sudo chmod -R 755 "$WWW"

echo ""
echo "=== Ozet ==="
echo "Node:  $(node -v 2>/dev/null || echo yok)"
echo "PM2:   $(pm2 -v 2>/dev/null || echo yok)"
echo "Nginx: $(nginx -v 2>&1 | head -1 || echo yok)"
pm2 list 2>/dev/null || true
echo ""
echo "API test:  curl -sS http://127.0.0.1:5000/api/status | head -c 200"
curl -sS http://127.0.0.1:5000/api/status 2>/dev/null | head -c 200 || echo "(backend yanit vermedi)"
echo ""
echo "Web test:  curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1/"
curl -sS -o /dev/null -w "nginx_home:%{http_code}\n" http://127.0.0.1/ 2>/dev/null || true
if [[ -f "$WWW/index.html" ]]; then
  echo "index: $(grep -oE 'Dashtock|PAZARYONET|id=\"root\"' "$WWW/index.html" | head -3 | tr '\n' ' ')"
fi
echo ""
echo "Sonraki adim (yerel PC): powershell -File deploy-frontend.ps1"
echo "SSL yoksa: sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
