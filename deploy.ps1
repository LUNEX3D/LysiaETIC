## ═══════════════════════════════════════════════════════════════
## LysiaETIC — Tek Komutla AWS Deploy Script
## Kullanım: powershell -File deploy.ps1
## ═══════════════════════════════════════════════════════════════

$KEY = "C:\Users\emrul\Downloads\key.pem"
$SERVER = "ubuntu@13.51.158.124"
$FRONTEND = "D:\LysiaETIC\frontend"

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
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "BUILD HATASI! İşlem durduruluyor." -ForegroundColor Red
    exit 1
}
Write-Host "[1/6] Build tamamlandı!" -ForegroundColor Green

## 2. Git Push
Write-Host "[2/6] Git push yapılıyor..." -ForegroundColor Yellow
Set-Location "D:\LysiaETIC"
git add -A
git commit -m "deploy: $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
git push Etic main --force
Write-Host "[2/6] Git push tamamlandı!" -ForegroundColor Green

## 3. AWS Git Pull + npm install + Backend Restart
Write-Host "[3/6] AWS sunucusu güncelleniyor..." -ForegroundColor Yellow
ssh -i $KEY -o StrictHostKeyChecking=no $SERVER "cd ~/LysiaETIC && git fetch --all && git reset --hard origin/main && cd backend && npm install --omit=dev && (pm2 describe backend >/dev/null 2>&1 && pm2 restart backend || pm2 start ecosystem.config.cjs) && pm2 save"
Write-Host "[3/6] Backend güncellendi!" -ForegroundColor Green

## 4. Build dosyalarını SCP ile yükle
Write-Host "[4/6] Build dosyaları yükleniyor..." -ForegroundColor Yellow
scp -r -i $KEY "$FRONTEND\build\*" "${SERVER}:~/build/"
Write-Host "[4/6] Dosyalar yüklendi!" -ForegroundColor Green

## 5. Nginx + SEO dosyaları
Write-Host "[5/6] Nginx deploy ediliyor..." -ForegroundColor Yellow
scp -i $KEY "D:\LysiaETIC\nginx-default.conf" "${SERVER}:~/nginx-default.conf"
scp -i $KEY "$FRONTEND\public\robots.txt" "${SERVER}:~/build/robots.txt"
scp -i $KEY "$FRONTEND\public\sitemap.xml" "${SERVER}:~/build/sitemap.xml"
ssh -i $KEY $SERVER @"
sudo rm -rf /var/www/html/* && sudo cp -r ~/build/* /var/www/html/ &&
sudo cp ~/nginx-default.conf /etc/nginx/sites-available/default &&
sudo ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default &&
sudo nginx -t && sudo chmod -R 755 /var/www/html/ &&
sudo chown -R www-data:www-data /var/www/html/ &&
sudo systemctl reload nginx
"@
Write-Host "[5/6] Nginx deploy tamamlandı!" -ForegroundColor Green

Write-Host "[6/6] SEO endpoint testi..." -ForegroundColor Yellow
ssh -i $KEY $SERVER "curl -sS http://127.0.0.1:5000/robots.txt | head -3"
Write-Host "[6/6] Tamam!" -ForegroundColor Green

Write-Host ""
Write-Host "═══════════════════════════════════════════" -ForegroundColor Green
Write-Host "  DEPLOY TAMAMLANDI!" -ForegroundColor Green
Write-Host "  https://pazaryonet.com" -ForegroundColor Green
Write-Host "  https://pazaryonet.com/admin/login" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
