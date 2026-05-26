# Tam canli deploy: yerel frontend build + backend dosyalari (git push zorunlu degil)
# Kullanim: powershell -File scripts/deploy-live.ps1

param(
    [string]$Key = "C:\Users\emrul\Downloads\key.pem",
    [string]$Server = "ubuntu@13.60.207.1",
    [string]$Root = "D:\LysiaETIC"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $Key)) {
    Write-Host "SSH key bulunamadi: $Key" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== Dashtock CANLI DEPLOY ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/4] Frontend..." -ForegroundColor Yellow
& (Join-Path $Root "deploy-frontend.ps1") -Key $Key -Server $Server -Root $Root
if ($LASTEXITCODE -ne 0) { throw "Frontend deploy basarisiz" }

Write-Host "[2/4] Backend arsivi olusturuluyor..." -ForegroundColor Yellow
$tarPath = Join-Path $env:TEMP "dashtock-backend-$(Get-Date -Format 'yyyyMMddHHmmss').tar"
Push-Location $Root
tar -cf $tarPath --exclude=node_modules --exclude=.env --exclude=logs backend
Pop-Location
if (-not (Test-Path $tarPath)) { throw "backend tar olusturulamadi" }
Write-Host "      $tarPath" -ForegroundColor DarkGray

Write-Host "[3/4] Backend + .env sunucuya..." -ForegroundColor Yellow
scp -i $Key -o StrictHostKeyChecking=no $tarPath "${Server}:~/dashtock-backend-live.tar"
$envFile = Join-Path $Root "backend\.env"
if (Test-Path $envFile) {
    ssh -i $Key -o StrictHostKeyChecking=no $Server "mkdir -p ~/LysiaETIC/backend"
    scp -i $Key -o StrictHostKeyChecking=no $envFile "${Server}:~/LysiaETIC/backend/.env"
} else {
    Write-Host "      UYARI: backend\.env yok" -ForegroundColor Yellow
}

$remoteScript = @'
set -e
mkdir -p ~/LysiaETIC
cd ~/LysiaETIC
if [ -d .git ]; then
  git fetch --all 2>/dev/null || true
  git reset --hard origin/main 2>/dev/null || true
fi
tar xf ~/dashtock-backend-live.tar -C ~/LysiaETIC
cd ~/LysiaETIC/backend
npm install --omit=dev
if pm2 describe backend >/dev/null 2>&1; then
  pm2 restart backend
elif pm2 describe dashtock-api >/dev/null 2>&1; then
  pm2 restart dashtock-api
else
  pm2 start ecosystem.config.cjs
fi
pm2 save
echo "--- API ---"
curl -sS http://127.0.0.1:5000/api/status || true
echo ""
curl -sS http://127.0.0.1:5000/api/paytr/health || true
echo ""
'@

Write-Host "[4/4] Sunucuda backend kurulum..." -ForegroundColor Yellow
$remoteScript | ssh -i $Key -o StrictHostKeyChecking=no $Server "bash -s"

Remove-Item -Force $tarPath -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "CANLI DEPLOY TAMAM" -ForegroundColor Green
Write-Host "  https://dashtock.com" -ForegroundColor Green
Write-Host "  Tarayicida Ctrl+F5 ile yenileyin" -ForegroundColor Yellow
Write-Host ""
