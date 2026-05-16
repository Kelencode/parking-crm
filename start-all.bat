@echo off
start "Backend" cmd /k "cd C:\Users\mrkir\Desktop\parking-crm\backend && uvicorn main:app --reload"
timeout /t 3
start "Frontend" cmd /k "cd C:\Users\mrkir\Desktop\parking-crm\frontend && npm run dev"
timeout /t 5
start http://localhost:5173
echo.
echo Для доступа извне запусти start-ngrok.bat
echo Затем укажи ngrok URL бэкенда в frontend\.env.local
