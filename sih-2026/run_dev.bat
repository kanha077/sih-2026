@echo off
title DepthWizard Development Launcher
echo ==================================================================
echo   DepthWizard - Photo to 3D Elevation & GeoTIFF App
echo ==================================================================

echo [1/2] Starting FastAPI Backend on http://127.0.0.1:8000...
start "DepthWizard Backend" cmd /k "cd /d %~dp0backend && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

timeout /t 2 /nobreak >nul

echo [2/2] Starting Vite Frontend on http://localhost:3000...
start "DepthWizard Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo DepthWizard servers have launched in separate consoles.
echo - Frontend: http://localhost:3000
echo - Backend API: http://127.0.0.1:8000/docs
echo ==================================================================
pause
