@echo off
echo Запускаем ngrok для бэкенда и фронтенда...
start "ngrok-backend" cmd /k "ngrok http 8000"
timeout /t 3
start "ngrok-frontend" cmd /k "ngrok http 5173"
echo.
echo Откройте оба окна ngrok и скопируйте HTTPS адреса.
echo Затем вставьте URL бэкенда в frontend\.env.local:
echo   VITE_API_URL=https://xxxx.ngrok-free.app
echo.
echo После изменения .env.local перезапустите фронтенд (Ctrl+C, npm run dev).
pause
