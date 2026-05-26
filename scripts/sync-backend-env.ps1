# Sunucuya backend/.env kopyalar (PayTR dahil — git'e girmez)
# Kullanım: powershell -File scripts/sync-backend-env.ps1

$KEY = "C:\Users\emrul\Downloads\key.pem"
$SERVER = "ubuntu@13.51.158.124"
$ROOT = Split-Path $PSScriptRoot -Parent
$ENV_FILE = Join-Path $ROOT "backend\.env"

if (-not (Test-Path $ENV_FILE)) {
    Write-Host "HATA: $ENV_FILE bulunamadi." -ForegroundColor Red
    exit 1
}

$raw = Get-Content $ENV_FILE -Raw
$required = @("PAYTR_MERCHANT_ID", "PAYTR_MERCHANT_KEY", "PAYTR_MERCHANT_SALT")
$missing = @()
foreach ($k in $required) {
    if ($raw -notmatch "(?m)^\s*$k\s*=") { $missing += $k }
}
if ($missing.Count -gt 0) {
    Write-Host "UYARI: .env icinde eksik: $($missing -join ', ')" -ForegroundColor Yellow
}

Write-Host "backend/.env sunucuya yukleniyor..." -ForegroundColor Cyan
scp -i $KEY -o StrictHostKeyChecking=no $ENV_FILE "${SERVER}:~/LysiaETIC/backend/.env"

ssh -i $KEY -o StrictHostKeyChecking=no $SERVER @"
cd ~/LysiaETIC/backend
pm2 restart backend
sleep 2
curl -sS http://127.0.0.1:5000/api/paytr/health
echo ''
"@

Write-Host "Bitti. configured:true olmali." -ForegroundColor Green
