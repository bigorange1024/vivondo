@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo  ========================================
echo   Vivondo / HuaHua World - Start
echo  ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found. Install from https://nodejs.org/
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo [INFO] First run: npm install ...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed
    pause
    exit /b 1
  )
  echo.
)

echo Browser will open with your LAN IP (not localhost).
echo Same Wi-Fi phones/PCs can use that address too.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\print-lan-urls.ps1" -Port 5173
echo.
echo Close this window to stop the server.
echo If phone cannot connect, allow Node.js in Windows Firewall.
echo  ----------------------------------------
echo.

call npm start
pause
