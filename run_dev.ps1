# DepthWizard 1-Click Windows Development Startup Script
$Host.UI.RawUI.WindowTitle = "DepthWizard Development Console"

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "  DepthWizard - Photo to 3D Elevation & GeoTIFF App" -ForegroundColor Yellow
Write-Host "==================================================================" -ForegroundColor Cyan

$backendDir = Join-Path $PSScriptRoot "backend"
$frontendDir = Join-Path $PSScriptRoot "frontend"

Write-Host "`n[1/2] Starting FastAPI Backend on http://127.0.0.1:8000..." -ForegroundColor Green
$backendProcess = Start-Process python -ArgumentList "-m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload" -WorkingDirectory $backendDir -PassThru

Start-Sleep -Seconds 2

Write-Host "[2/2] Starting Vite Frontend on http://localhost:3000..." -ForegroundColor Green
$frontendProcess = Start-Process npm -ArgumentList "run dev" -WorkingDirectory $frontendDir -PassThru

Write-Host "`n==================================================================" -ForegroundColor Cyan
Write-Host "  DepthWizard is running live!" -ForegroundColor Green
Write-Host "  - Frontend: http://localhost:3000" -ForegroundColor White
Write-Host "  - Backend API: http://127.0.0.1:8000/docs" -ForegroundColor White
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "Press Ctrl+C or close this console to terminate processes." -ForegroundColor Gray

try {
    while ($true) {
        Start-Sleep -Seconds 1
    }
} finally {
    Write-Host "`nStopping DepthWizard servers..." -ForegroundColor Yellow
    if ($backendProcess -and !$backendProcess.HasExited) { Stop-Process -Id $backendProcess.Id -Force }
    if ($frontendProcess -and !$frontendProcess.HasExited) { Stop-Process -Id $frontendProcess.Id -Force }
}
