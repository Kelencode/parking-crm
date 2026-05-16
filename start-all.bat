@echo off
start "Backend" cmd /k "cd C:\Users\mrkir\Desktop\parking-crm\backend && uvicorn main:app --reload"
timeout /t 3
start "Frontend" cmd /k "cd C:\Users\mrkir\Desktop\parking-crm\frontend && npm run dev"
echo Открываю браузер...
timeout /t 5
start http://localhost:5173
