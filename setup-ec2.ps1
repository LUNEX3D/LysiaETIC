# Dashtock — EC2 ilk kurulum / kontrol (beraber kullanim)
# Kullanim: powershell -File setup-ec2.ps1
# Sadece kontrol: powershell -File setup-ec2.ps1 -CheckOnly
# Kurulum scripti yukle: powershell -File setup-ec2.ps1 -RunBootstrap

param(
    [string]$Key = "C:\Users\emrul\Downloads\key.pem",
    [string]$Server = "ubuntu@13.51.158.124",
    [string]$Root = "D:\LysiaETIC",
    [switch]$CheckOnly,
    [switch]$RunBootstrap,
    [switch]$DeployFrontend
)

$ErrorActionPreference = "Stop"

function Test-Ssh {
    param([string]$Cmd)
    ssh -i $Key -o ConnectTimeout=12 -o StrictHostKeyChecking=no $Server $Cmd
}

Write-Host ""
Write-Host "=== Dashtock EC2 Setup ===" -ForegroundColor Cyan
Write-Host "Sunucu: $Server" -ForegroundColor Gray
Write-Host ""

if (-not (Test-Path $Key)) {
    Write-Host "SSH key yok: $Key" -ForegroundColor Red
    Write-Host "AWS Console > EC2 > Key Pairs — .pem indirin, yolu -Key ile verin."
    exit 1
}

Write-Host "[0] SSH baglantisi..." -ForegroundColor Yellow
try {
    $ping = Test-Ssh "echo SSH_OK && hostname && uptime -p"
    Write-Host $ping -ForegroundColor Green
} catch {
    Write-Host "SSH basarisiz (timeout / Security Group / IP degisti)." -ForegroundColor Red
    Write-Host ""
    Write-Host "AWS kontrol listesi:" -ForegroundColor Yellow
    Write-Host "  1. EC2 > Security Group > Inbound: SSH 22, HTTP 80, HTTPS 443 (0.0.0.0/0 veya IP'niz)"
    Write-Host "  2. Instance > Public IPv4 = deploy scriptindeki IP ile ayni mi?"
    Write-Host "  3. Instance Running mi?"
    Write-Host "  4. Yerel: ssh -i `"$Key`" $Server"
    exit 1
}

if ($CheckOnly) {
    Write-Host ""
    Write-Host "[Kontrol] Sunucu durumu..." -ForegroundColor Yellow
    Test-Ssh @"
echo '--- nginx ---'
nginx -v 2>&1 || echo nginx yok
sudo systemctl is-active nginx 2>/dev/null || true
echo '--- node/pm2 ---'
node -v 2>/dev/null || echo node yok
pm2 list 2>/dev/null | head -15 || echo pm2 yok
echo '--- www ---'
ls -la /var/www/html/index.html 2>/dev/null || echo index yok
grep -oE 'Dashtock|PAZARYONET|id=\"root\"' /var/www/html/index.html 2>/dev/null | head -5 || true
echo '--- api ---'
curl -sS -m 3 http://127.0.0.1:5000/api/status 2>/dev/null | head -c 150 || echo api yanit yok
echo ''
curl -sS -o /dev/null -w 'nginx:%{http_code}' http://127.0.0.1/ 2>/dev/null; echo ''
"@
    Write-Host ""
    Write-Host "Kontrol bitti." -ForegroundColor Green
    exit 0
}

if ($RunBootstrap) {
    Write-Host "[1] Kurulum scripti yukleniyor..." -ForegroundColor Yellow
    $setupSh = Join-Path $Root "scripts\aws-setup-ec2.sh"
    $nginxConf = Join-Path $Root "nginx-default.conf"
    scp -i $Key -o StrictHostKeyChecking=no $setupSh "${Server}:~/aws-setup-ec2.sh"
    scp -i $Key -o StrictHostKeyChecking=no $nginxConf "${Server}:~/nginx-default.conf"
    Write-Host "[2] Kurulum calisiyor (birkaç dakika)..." -ForegroundColor Yellow
    Test-Ssh "chmod +x ~/aws-setup-ec2.sh && bash ~/aws-setup-ec2.sh"
    Write-Host "[2] Kurulum scripti bitti." -ForegroundColor Green
}

if ($DeployFrontend) {
    Write-Host "[3] Frontend deploy..." -ForegroundColor Yellow
    & powershell -File (Join-Path $Root "deploy-frontend.ps1") -Key $Key -Server $Server -Root $Root
}

if (-not $RunBootstrap -and -not $DeployFrontend) {
    Write-Host ""
    Write-Host "Ne yapmak istiyorsunuz?" -ForegroundColor Cyan
    Write-Host "  Kontrol:     powershell -File setup-ec2.ps1 -CheckOnly"
    Write-Host "  Ilk kurulum: powershell -File setup-ec2.ps1 -RunBootstrap"
    Write-Host "  Site yayini: powershell -File setup-ec2.ps1 -DeployFrontend"
    Write-Host "  Hepsi:       powershell -File setup-ec2.ps1 -RunBootstrap -DeployFrontend"
    Write-Host ""
}

Write-Host "Bitti." -ForegroundColor Green
Write-Host ""
