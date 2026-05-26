# Dashtock — SADECE frontend (React) AWS'e yukler. Git/push YOK.
# Kullanim: powershell -File deploy-frontend.ps1
# Opsiyonel: powershell -File deploy-frontend.ps1 -Server ubuntu@IP -Key C:\path\key.pem

param(
    [string]$Key = "C:\Users\emrul\Downloads\key.pem",
    [string]$Server = "",
    [string]$Root = "D:\LysiaETIC"
)

$ErrorActionPreference = "Stop"
. (Join-Path $Root "scripts\deploy-config.ps1")
if (-not $Server) { $Server = $DashtockAwsServer }
$Frontend = Join-Path $Root "frontend"

Write-Host ""
Write-Host "=== Dashtock FRONTEND Deploy ===" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $Key)) {
    Write-Host "SSH key bulunamadi: $Key" -ForegroundColor Red
    Write-Host "Ornek: powershell -File deploy-frontend.ps1 -Key C:\Users\you\key.pem -Server ubuntu@EC2_IP"
    exit 1
}

Write-Host "[1/3] npm run build..." -ForegroundColor Yellow
Set-Location $Frontend
$env:NODE_OPTIONS = "--openssl-legacy-provider"
$env:CI = "false"
$env:REACT_APP_API_URL = ""
npm run build
$idxPath = Join-Path $Frontend "build\index.html"
if (-not (Test-Path $idxPath)) { throw "build/index.html yok" }
$idx = Get-Content $idxPath -Raw
if ($idx -notmatch 'id="root"') { throw "Gecersiz build (React root yok)" }
Write-Host "[1/3] Build OK" -ForegroundColor Green

Write-Host "[2/3] Dosyalar sunucuya..." -ForegroundColor Yellow
ssh -i $Key -o ConnectTimeout=20 -o StrictHostKeyChecking=no $Server "mkdir -p ~/build ~/LysiaETIC/frontend/build"
if ($LASTEXITCODE -ne 0) { throw "SSH baglantisi basarisiz ($Server port 22)" }
scp -r -i $Key -o ConnectTimeout=20 -o StrictHostKeyChecking=no "$Frontend\build\*" "${Server}:~/build/"
if ($LASTEXITCODE -ne 0) { throw "SCP build yukleme basarisiz" }
scp -i $Key -o ConnectTimeout=20 -o StrictHostKeyChecking=no (Join-Path $Root "nginx-default.conf") "${Server}:~/nginx-default.conf"
if ($LASTEXITCODE -ne 0) { throw "SCP nginx config basarisiz" }
Write-Host "[2/3] Yuklendi" -ForegroundColor Green

Write-Host "[3/3] Nginx + www + backend build yolu..." -ForegroundColor Yellow
$nginxDeploy = "set -e; if ! grep -q id=root ~/build/index.html; then echo 'HATA: React build degil'; exit 1; fi; sudo mkdir -p /var/www/html; sudo rm -rf /var/www/html/*; sudo cp -r ~/build/* /var/www/html/; mkdir -p ~/LysiaETIC/frontend/build; rm -rf ~/LysiaETIC/frontend/build/*; cp -r ~/build/* ~/LysiaETIC/frontend/build/; sudo cp ~/nginx-default.conf /etc/nginx/sites-available/default; sudo ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default; sudo nginx -t; sudo systemctl reload nginx; sudo chown -R www-data:www-data /var/www/html; sudo chmod -R 755 /var/www/html; grep -o Dashtock /var/www/html/index.html | head -1 || true"
ssh -i $Key -o StrictHostKeyChecking=no $Server $nginxDeploy
if ($LASTEXITCODE -ne 0) { throw "Nginx deploy basarisiz" }
Write-Host "[3/3] Nginx tamam" -ForegroundColor Green

Write-Host ""
Write-Host "Bitti: https://dashtock.com (Ctrl+F5)" -ForegroundColor Green
Write-Host "Not: frontend/build gitte YOK - her yayinda bu script veya deploy.ps1 calistirin." -ForegroundColor Yellow
Write-Host ""
