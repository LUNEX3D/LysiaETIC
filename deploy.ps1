## ═══════════════════════════════════════════════════════════════
## Dashtock — AWS Deploy (ONCE FRONTEND — git pull build getirmez!)
## Kullanım: powershell -File deploy.ps1
## Sadece arayuz: powershell -File deploy-frontend.ps1
## ═══════════════════════════════════════════════════════════════

param(
    [switch]$SkipGit,
    [switch]$FrontendOnly
)

$KEY = "C:\Users\emrul\Downloads\key.pem"
$SERVER = "ubuntu@13.60.214.195"
$ROOT = "D:\LysiaETIC"
$FRONTEND = Join-Path $ROOT "frontend"

Write-Host ""
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  LysiaETIC AWS Deploy Başlatılıyor..." -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

## 1. Frontend Build
Write-Host "[1/6] Frontend build ediliyor..." -ForegroundColor Yellow
Set-Location $FRONTEND
$env:NODE_OPTIONS = "--openssl-legacy-provider"
$env:CI = "false"
$env:REACT_APP_API_URL = ""
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "BUILD HATASI! İşlem durduruluyor." -ForegroundColor Red
    exit 1
}
$builtIndex = Join-Path $FRONTEND "build\index.html"
if (-not (Test-Path $builtIndex)) {
    Write-Host "BUILD index.html bulunamadi!" -ForegroundColor Red
    exit 1
}
$idx = Get-Content $builtIndex -Raw
if ($idx -notmatch 'id="root"') {
    Write-Host "BUILD gecersiz — React root yok. deploy iptal." -ForegroundColor Red
    exit 1
}
if ($idx -match 'PAZARYONET AKTIF') {
    Write-Host "BUILD eski placeholder iceriyor — temiz build alin." -ForegroundColor Red
    exit 1
}
Write-Host "[1/6] Build tamamlandı (Dashtock SPA)!" -ForegroundColor Green

## 2. Build dosyalarini SCP (KRITIK — git pull build icermez!)
Write-Host "[2/6] Build dosyalari sunucuya yukleniyor..." -ForegroundColor Yellow
ssh -i $KEY -o StrictHostKeyChecking=no $SERVER "mkdir -p ~/build ~/LysiaETIC/frontend/build"
scp -r -i $KEY -o StrictHostKeyChecking=no "$FRONTEND\build\*" "${SERVER}:~/build/"
Write-Host "[2/6] Yuklendi!" -ForegroundColor Green

## 3. Nginx + /var/www/html + frontend/build (sunucuda)
Write-Host "[3/6] Nginx deploy ediliyor..." -ForegroundColor Yellow
scp -i $KEY "$ROOT\nginx-default.conf" "${SERVER}:~/nginx-default.conf"
scp -i $KEY "$FRONTEND\public\robots.txt" "${SERVER}:~/build/robots.txt"
scp -i $KEY "$FRONTEND\public\sitemap.xml" "${SERVER}:~/build/sitemap.xml"
ssh -i $KEY $SERVER @'
set -e
if [ ! -f ~/build/index.html ]; then echo 'HATA: ~/build/index.html yok'; exit 1; fi
if ! grep -q 'id="root"' ~/build/index.html; then echo 'HATA: React build degil'; exit 1; fi
sudo rm -rf /var/www/html/*
sudo cp -r ~/build/* /var/www/html/
mkdir -p ~/LysiaETIC/frontend/build
rm -rf ~/LysiaETIC/frontend/build/*
cp -r ~/build/* ~/LysiaETIC/frontend/build/
sudo cp ~/nginx-default.conf /etc/nginx/sites-available/default
sudo ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default
sudo nginx -t
sudo chmod -R 755 /var/www/html/
sudo chown -R www-data:www-data /var/www/html/
sudo systemctl enable nginx 2>/dev/null || true
sudo systemctl start nginx 2>/dev/null || true
sudo systemctl reload nginx
echo '--- index.html basi ---'
head -c 200 /var/www/html/index.html
'@
Write-Host "[3/6] Nginx deploy tamamlandi!" -ForegroundColor Green

if ($FrontendOnly) {
    Write-Host "FrontendOnly — backend atlandi." -ForegroundColor Yellow
} else {
    ## 4. Git Push (opsiyonel)
    if (-not $SkipGit) {
        Write-Host "[4/6] Git push yapiliyor..." -ForegroundColor Yellow
        Set-Location $ROOT
        git add -A
        git commit -m "deploy: $(Get-Date -Format 'yyyy-MM-dd HH:mm')" 2>$null
        git push Etic main --force
        Write-Host "[4/6] Git push tamamlandi!" -ForegroundColor Green
    } else {
        Write-Host "[4/6] Git atlandi (-SkipGit)" -ForegroundColor Yellow
    }

    ## 5. AWS Git Pull + Backend + .env (PayTR git'te yok!)
    Write-Host "[5/6] Backend guncelleniyor..." -ForegroundColor Yellow
    $localEnv = Join-Path $ROOT "backend\.env"
    if (Test-Path $localEnv) {
        Write-Host "      backend/.env sunucuya kopyalaniyor..." -ForegroundColor DarkGray
        scp -i $KEY -o StrictHostKeyChecking=no $localEnv "${SERVER}:~/LysiaETIC/backend/.env"
    } else {
        Write-Host "      UYARI: backend\.env yok — PayTR sunucuda calismaz!" -ForegroundColor Yellow
    }
    ssh -i $KEY -o StrictHostKeyChecking=no $SERVER "cd ~/LysiaETIC && git fetch --all && git reset --hard origin/main && cd backend && npm install --omit=dev && (pm2 describe backend >/dev/null 2>&1 && pm2 restart backend --update-env || pm2 describe dashtock-api >/dev/null 2>&1 && pm2 restart dashtock-api --update-env || pm2 start ecosystem.config.cjs) && pm2 save"
    Write-Host "[5/6] Backend guncellendi!" -ForegroundColor Green
}

Write-Host "[6/6] Saglik kontrolu..." -ForegroundColor Yellow
ssh -i $KEY $SERVER "curl -sS http://127.0.0.1:5000/api/status; echo ''; curl -sS http://127.0.0.1:5000/api/paytr/health; echo ''; curl -sS -o /dev/null -w 'nginx_home:%{http_code}\n' http://127.0.0.1/"
try {
    $remote = ssh -i $KEY $SERVER "grep -o 'Dashtock\|PAZARYONET' /var/www/html/index.html | head -1"
    if ($remote -match 'PAZARYONET') {
        Write-Host "UYARI: Sunucuda hala PAZARYONET metni var!" -ForegroundColor Red
    } elseif ($remote -match 'Dashtock') {
        Write-Host "[6/6] Frontend index OK (Dashtock)" -ForegroundColor Green
    }
} catch { Write-Host "[6/6] Uzak dogrulama atlandi" -ForegroundColor Yellow }
Write-Host "[6/6] Tamam!" -ForegroundColor Green

Write-Host ""
Write-Host "═══════════════════════════════════════════" -ForegroundColor Green
Write-Host "  DEPLOY TAMAMLANDI!" -ForegroundColor Green
Write-Host "  https://dashtock.com" -ForegroundColor Green
Write-Host "  https://dashtock.com/admin/login" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
