# Dashtock — YENI EC2'ye tam tasima (dashtock.com instance)
# Kullanim: powershell -File migrate-ec2.ps1
# Eski sunucudan .env kopyala: powershell -File migrate-ec2.ps1 -CopyEnvFromOld

param(
    [string]$Key = "C:\Users\emrul\Downloads\key.pem",
    [string]$NewServer = "ubuntu@13.60.207.1",
    [string]$OldServer = "ubuntu@13.60.214.195",  # onceki production
    [string]$Root = "D:\LysiaETIC",
    [switch]$CopyEnvFromOld,
    [switch]$SkipFrontend,
    [switch]$SkipBootstrap
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== Dashtock — Yeni EC2 tasima ===" -ForegroundColor Cyan
Write-Host "Yeni: $NewServer" -ForegroundColor Green
Write-Host ""

if (-not (Test-Path $Key)) {
    Write-Host "SSH key yok: $Key" -ForegroundColor Red
    exit 1
}

function Invoke-Ssh([string]$Target, [string]$Cmd) {
    ssh -i $Key -o ConnectTimeout=15 -o StrictHostKeyChecking=no $Target $Cmd
}

Write-Host "[1/6] Yeni sunucu SSH..." -ForegroundColor Yellow
try {
    Invoke-Ssh $NewServer "echo OK && hostname && curl -sS -m 2 http://169.254.169.254/latest/meta-data/instance-id 2>/dev/null || true"
} catch {
    Write-Host "Yeni sunucuya baglanilamadi." -ForegroundColor Red
    Write-Host "AWS: Security Group > Inbound SSH 22, HTTP 80, HTTPS 443"
    Write-Host "Instance durumu 2/2 checks passed olana kadar bekleyin."
    exit 1
}
Write-Host "[1/6] SSH OK" -ForegroundColor Green

if ($CopyEnvFromOld) {
    Write-Host "[2/6] Eski sunucudan .env..." -ForegroundColor Yellow
    try {
        scp -i $Key -o ConnectTimeout=12 "${OldServer}:~/LysiaETIC/backend/.env" "$env:TEMP\lysia-backend.env"
        ssh -i $Key $NewServer "mkdir -p ~/LysiaETIC/backend"
        scp -i $Key "$env:TEMP\lysia-backend.env" "${NewServer}:~/LysiaETIC/backend/.env"
        Remove-Item "$env:TEMP\lysia-backend.env" -Force -ErrorAction SilentlyContinue
        Write-Host "[2/6] .env kopyalandi" -ForegroundColor Green
    } catch {
        Write-Host "[2/6] Eski sunucu erisilemedi — .env'i elle yukleyin:" -ForegroundColor Yellow
        Write-Host "  scp -i key.pem backend\.env ${NewServer}:~/LysiaETIC/backend/.env"
    }
} else {
    Write-Host "[2/6] .env atlandi (sunucuda ~/LysiaETIC/backend/.env olmali)" -ForegroundColor Yellow
}

if (-not $SkipBootstrap) {
    Write-Host "[3/6] Sunucu kurulumu (nginx, node, pm2)..." -ForegroundColor Yellow
    & powershell -File (Join-Path $Root "setup-ec2.ps1") -Key $Key -Server $NewServer -Root $Root -RunBootstrap
    Write-Host "[3/6] Kurulum bitti" -ForegroundColor Green

    Write-Host "[4/6] Repo (git)..." -ForegroundColor Yellow
    Invoke-Ssh $NewServer @"
set -e
if [ ! -d ~/LysiaETIC/.git ]; then
  git clone https://github.com/LUNEX3D/LysiaETIC.git ~/LysiaETIC
fi
cd ~/LysiaETIC && git fetch --all && git reset --hard origin/main
if [ -f backend/.env ]; then
  cd backend && npm install --omit=dev
  pm2 describe backend >/dev/null 2>&1 && pm2 restart backend || pm2 start ecosystem.config.cjs
  pm2 save
else
  echo 'UYARI: backend/.env yok — scp ile yukleyin sonra: cd backend && pm2 start ecosystem.config.cjs'
fi
"@
    Write-Host "[4/6] Repo hazir" -ForegroundColor Green
} else {
    Write-Host "[3-4/6] Bootstrap atlandi" -ForegroundColor Yellow
}

if (-not $SkipFrontend) {
    Write-Host "[5/6] Frontend (Dashtock SPA)..." -ForegroundColor Yellow
    & powershell -File (Join-Path $Root "deploy-frontend.ps1") -Key $Key -Server $NewServer -Root $Root
    Write-Host "[5/6] Frontend yayinda" -ForegroundColor Green
} else {
    Write-Host "[5/6] Frontend atlandi" -ForegroundColor Yellow
}

Write-Host "[6/6] Saglik..." -ForegroundColor Yellow
Invoke-Ssh $NewServer @"
echo '--- pm2 ---'
pm2 list 2>/dev/null | head -8 || echo pm2 yok
echo '--- api ---'
curl -sS -m 4 http://127.0.0.1:5000/api/status 2>/dev/null | head -c 120 || echo api yok
echo ''
echo '--- www ---'
grep -oE 'Dashtock|PAZARYONET|id=\"root\"' /var/www/html/index.html 2>/dev/null | head -3 || echo index yok
"@

Write-Host ""
Write-Host "=== Sizin yapmaniz gerekenler ===" -ForegroundColor Cyan
Write-Host "1. DNS (Cloudflare/registrar): A kaydi dashtock.com -> 13.60.207.1"
Write-Host "2. SSL (yeni sunucuda SSH ile):"
Write-Host "   sudo certbot --nginx -d dashtock.com -d www.dashtock.com"
Write-Host "3. GitHub Actions secret: AWS_HOST = 13.60.207.1"
Write-Host "4. Eski instance'i durdurmadan once yeni siteyi test: http://13.60.207.1"
Write-Host ""
Write-Host "Test: https://dashtock.com (DNS guncellenince)" -ForegroundColor Green
Write-Host ""
