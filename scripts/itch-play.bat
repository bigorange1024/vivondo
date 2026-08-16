@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo  Vivondo - local play from this folder
echo  =====================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is required for local play from a ZIP.
  echo Install: https://nodejs.org/
  echo.
  echo If you got this from itch.io web page, use "Run game" there instead
  echo — no download / Node needed.
  pause
  exit /b 1
)

echo Starting local server on http://127.0.0.1:4173/
echo Close this window to stop.
echo.

start "" "http://127.0.0.1:4173/"
call npx --yes serve -l 4173 .
pause
