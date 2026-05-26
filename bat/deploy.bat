@echo off
set ROOT=%~dp0..
if "%ROOT:~-1%"=="\" set ROOT=%ROOT:~0,-1%
for /f "usebackq delims=" %%S in (`powershell -NoProfile -Command ". '%ROOT%\scripts\deploy-config.ps1'; Write-Output $DashtockAwsServer"`) do set SERVER=%%S

echo =========================
echo FRONTEND BUILD
echo =========================

cd /d %ROOT%\frontend

call npm run build

echo =========================
echo FRONTEND UPLOAD
echo =========================

scp -i "C:\Users\emrul\Downloads\lysiaetic-key.pem" -r build %SERVER%:/home/ubuntu/LysiaETIC/frontend/

echo =========================
echo BACKEND UPDATE
echo =========================

ssh -i "C:\Users\emrul\Downloads\lysiaetic-key.pem" %SERVER% "cd /home/ubuntu/LysiaETIC && git pull && cd backend && npm install --legacy-peer-deps && pm2 restart dashtock-api && sudo systemctl restart nginx"

echo =========================
echo DEPLOY TAMAMLANDI
echo =========================

pause