@echo off
if exist "%~dp0sih-2026\run_dev.bat" (
    call "%~dp0sih-2026\run_dev.bat"
) else (
    echo Could not locate sih-2026\run_dev.bat
    pause
)
