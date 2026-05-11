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
Write-Host "[1/5] Frontend build ediliyor..." -ForegroundColor Yellow
Set-Location $FRONTEND
$env:NODE_OPTIONS = "--openssl-legacy-provider"
$env:CI = "false"
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "BUILD HATASI! İşlem durduruluyor." -ForegroundColor Red
    exit 1
}
Write-Host "[1/5] Build tamamlandı!" -ForegroundColor Green

## 2. Git Push
Write-Host "[2/5] Git push yapılıyor..." -ForegroundColor Yellow
Set-Location "D:\LysiaETIC"
git add -A
git commit -m "deploy: $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
git push Etic main --force
Write-Host "[2/5] Git push tamamlandı!" -ForegroundColor Green

## 3. AWS Git Pull + npm install + Backend Restart
Write-Host "[3/5] AWS sunucusu gÃ¼ncelleniyor..." -ForegroundColor Yellow
ssh -i $KEY -o StrictHostKeyChecking=no $SERVER "cd ~/LysiaETIC && git fetch --all && git reset --hard origin/main && cd backend && npm install --omit=dev && pm2 restart backend"
Write-Host "[3/5] Backend gÃ¼ncellendi!" -ForegroundColor Green

## 4. Build dosyalarını SCP ile yükle
Write-Host "[4/5] Build dosyaları yükleniyor..." -ForegroundColor Yellow
scp -r -i $KEY "$FRONTEND\build\*" "${SERVER}:~/build/"
Write-Host "[4/5] Dosyalar yüklendi!" -ForegroundColor Green

## 5. Nginx'e deploy et
Write-Host "[5/5] Nginx deploy ediliyor..." -ForegroundColor Yellow
ssh -i $KEY $SERVER "sudo rm -rf /var/www/html/* && sudo cp -r ~/build/* /var/www/html/ && sudo chmod -R 755 /var/www/html/ && sudo chown -R www-data:www-data /var/www/html/ && sudo systemctl restart nginx"
Write-Host "[5/5] Nginx deploy tamamlandı!" -ForegroundColor Green

Write-Host ""
Write-Host "═══════════════════════════════════════════" -ForegroundColor Green
Write-Host "  DEPLOY TAMAMLANDI!" -ForegroundColor Green
Write-Host "  http://13.51.158.124" -ForegroundColor Green
Write-Host "  http://13.51.158.124/admin/login" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
