## AWS Deploy Script
param([switch]$SkipGit, [switch]$FrontendOnly)

$KEY = "C:\Users\emrul\Downloads\key.pem"
$SERVER = "ubuntu@13.51.158.124"
$ROOT = "D:\LysiaETIC"
$FRONTEND = Join-Path $ROOT "frontend"

Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  AWS Deploy Başlatılıyor..." -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan

## 1. Frontend Build
Write-Host "[1/6] Frontend build..." -ForegroundColor Yellow
Set-Location $FRONTEND
$env:NODE_OPTIONS = "--openssl-legacy-provider"
$env:CI = "false"
$env:REACT_APP_API_URL = ""
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "BUILD HATASI!" -ForegroundColor Red; exit 1 }
Write-Host "[1/6] Build OK!" -ForegroundColor Green

## 2. Upload Build
Write-Host "[2/6] Build yukleniyor..." -ForegroundColor Yellow
ssh -i $KEY -o StrictHostKeyChecking=no $SERVER "mkdir -p ~/build ~/LysiaETIC/frontend/build"
scp -r -i $KEY -o StrictHostKeyChecking=no "$FRONTEND\build\*" "${SERVER}:~/build/"
Write-Host "[2/6] Yuklendi!" -ForegroundColor Green

## 3. Nginx Deploy
Write-Host "[3/6] Nginx deploy..." -ForegroundColor Yellow
scp -i $KEY "$ROOT\nginx-default.conf" "${SERVER}:~/nginx-default.conf"
scp -i $KEY "$FRONTEND\public\robots.txt" "${SERVER}:~/build/robots.txt"
scp -i $KEY "$FRONTEND\public\sitemap.xml" "${SERVER}:~/build/sitemap.xml"

$nginxScript = @'
set -e
if [ ! -f ~/build/index.html ]; then echo 'HATA: index.html yok'; exit 1; fi
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
sudo systemctl reload nginx
'@

ssh -i $KEY $SERVER $nginxScript
Write-Host "[3/6] Nginx OK!" -ForegroundColor Green

if ($FrontendOnly) {
    Write-Host "FrontendOnly — backend atlandi." -ForegroundColor Yellow
}
else {
    ## 4. Git Push
    if (-not $SkipGit) {
        Write-Host "[4/6] Git push..." -ForegroundColor Yellow
        Set-Location $ROOT
        git add -A
        $commitMsg = "deploy: $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
        git commit -m $commitMsg 2>$null
        git push Etic main --force
        Write-Host "[4/6] Git OK!" -ForegroundColor Green
    }
    else {
        Write-Host "[4/6] Git atlandi" -ForegroundColor Yellow
    }

    ## 5. Backend
    Write-Host "[5/6] Backend..." -ForegroundColor Yellow
    $localEnv = Join-Path $ROOT "backend\.env"
    if (Test-Path $localEnv) {
        scp -i $KEY -o StrictHostKeyChecking=no $localEnv "${SERVER}:~/LysiaETIC/backend/.env"
    }

    ssh -i $KEY -o StrictHostKeyChecking=no $SERVER 'cd ~/LysiaETIC && git fetch --all && git reset --hard origin/main && cd backend && npm install --omit=dev && (pm2 describe backend >/dev/null 2>&1 && pm2 restart backend || pm2 start ecosystem.config.cjs) && pm2 save'
    Write-Host "[5/6] Backend OK!" -ForegroundColor Green
}

## 6. Health Check
Write-Host "[6/6] Health check..." -ForegroundColor Yellow
ssh -i $KEY $SERVER "curl -sS http://127.0.0.1:5000/api/status"
Write-Host "[6/6] OK!" -ForegroundColor Green

Write-Host ""
Write-Host "═══════════════════════════════════════════" -ForegroundColor Green
Write-Host "  DEPLOY TAMAMLANDI!" -ForegroundColor Green
Write-Host "  https://dashtock.com" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════" -ForegroundColor Green
