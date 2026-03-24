@echo off
echo Starting X-Senate...

REM Start backend
cd backend
start "X-Senate Backend" cmd /k "pip install -r requirements.txt && uvicorn main:app --reload --port 8000"

REM Start frontend
cd ..\frontend
start "X-Senate Frontend" cmd /k "npm install && npm run dev"

echo.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:3000
echo API Docs: http://localhost:8000/docs
