@echo off
echo ============================================
echo   Dashtock AWS Deploy
echo ============================================
echo.

set KEY=C:\Users\emrul\Downloads\key.pem
set SERVER=ubuntu@13.60.207.1
set ROOT=D:\LysiaETIC

echo [1/6] Building frontend...
cd %ROOT%\frontend
set NODE_OPTIONS=--openssl-legacy-provider
set CI=false
set REACT_APP_API_URL=
call npm run build
if errorlevel 1 (
    echo BUILD FAILED!
    pause
    exit /b 1
)
echo [1/6] Build OK!

echo.
echo [2/6] Uploading build files...
ssh -i %KEY% -o StrictHostKeyChecking=no %SERVER% "mkdir -p ~/build ~/LysiaETIC/frontend/build"
scp -r -i %KEY% -o StrictHostKeyChecking=no "%ROOT%\frontend\build\*" "%SERVER%:~/build/"
echo [2/6] Upload OK!

echo.
echo [3/6] Deploying Nginx...
scp -i %KEY% "%ROOT%\nginx-default.conf" "%SERVER%:~/nginx-default.conf"
scp -i %KEY% "%ROOT%\frontend\public\robots.txt" "%SERVER%:~/build/robots.txt"
scp -i %KEY% "%ROOT%\frontend\public\sitemap.xml" "%SERVER%:~/build/sitemap.xml"
ssh -i %KEY% %SERVER% "sudo rm -rf /var/www/html/* && sudo cp -r ~/build/* /var/www/html/ && sudo cp ~/nginx-default.conf /etc/nginx/sites-available/default && sudo nginx -t && sudo systemctl reload nginx"
echo [3/6] Nginx OK!

echo.
echo [4/6] Git push...
cd %ROOT%
git add -A
git commit -m "deploy: %date% %time%"
git push Etic main --force
echo [4/6] Git OK!

echo.
echo [5/6] Updating backend...
scp -i %KEY% -o StrictHostKeyChecking=no "%ROOT%\backend\.env" "%SERVER%:~/LysiaETIC/backend/.env"
ssh -i %KEY% -o StrictHostKeyChecking=no %SERVER% "cd ~/LysiaETIC && git fetch --all && git reset --hard origin/main && cd backend && npm install --omit=dev && pm2 restart backend"
echo [5/6] Backend OK!

echo.
echo [6/6] Health check...
ssh -i %KEY% %SERVER% "curl -sS http://127.0.0.1:5000/api/status"
echo.
echo [6/6] OK!

echo.
echo ============================================
echo   DEPLOY COMPLETE!
echo   https://dashtock.com
echo ============================================
echo.
pause
