# Tam canli deploy: yerel frontend build + backend dosyalari (git push zorunlu degil)
# Kullanim: powershell -File scripts/deploy-live.ps1

param(
    [string]$Key = "C:\Users\emrul\Downloads\key.pem",
    [string]$Server = "",
    [string]$Root = "D:\LysiaETIC"
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "deploy-config.ps1")
if (-not $Server) { $Server = $DashtockAwsServer }

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

$remoteScript = "cd ~/LysiaETIC && tar xf ~/dashtock-backend-live.tar -C ~/LysiaETIC && cd backend && npm install --omit=dev && (pm2 restart backend || pm2 restart dashtock-api || pm2 start ecosystem.config.cjs) && pm2 save"

Write-Host "[4/4] Sunucuda backend kurulum..." -ForegroundColor Yellow
$remoteScript | ssh -i $Key -o StrictHostKeyChecking=no $Server "bash -s"

Remove-Item -Force $tarPath -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "CANLI DEPLOY TAMAM" -ForegroundColor Green
Write-Host "  https://dashtock.com" -ForegroundColor Green
Write-Host "  Tarayicida Ctrl+F5 ile yenileyin" -ForegroundColor Yellow
Write-Host ""
