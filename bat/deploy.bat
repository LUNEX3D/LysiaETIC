@echo off

echo =========================
echo FRONTEND BUILD
echo =========================

cd /d D:\LysiaETIC\frontend

call npm run build

echo =========================
echo FRONTEND UPLOAD
echo =========================

scp -i "C:\Users\emrul\Downloads\lysiaetic-key.pem" -r build ubuntu@13.60.207.1:/home/ubuntu/LysiaETIC/frontend/

echo =========================
echo BACKEND UPDATE
echo =========================

ssh -i "C:\Users\emrul\Downloads\lysiaetic-key.pem" ubuntu@13.60.207.1 "cd /home/ubuntu/LysiaETIC && git pull && cd backend && npm install --legacy-peer-deps && pm2 restart dashtock-api && sudo systemctl restart nginx"

echo =========================
echo DEPLOY TAMAMLANDI
echo =========================

pause