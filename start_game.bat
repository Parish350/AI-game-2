@echo off
echo ====================================================
echo   Launching SPEED RACER GP 3D...
echo ====================================================

:: Open directly in default web browser
start "" "%~dp0index.html"

echo Game launched in your default browser!
echo If you prefer a local server, run: npm start
timeout /t 3 >nul

