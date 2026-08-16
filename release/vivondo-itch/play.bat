@echo off
setlocal
cd /d "%~dp0"

echo.
echo  Vivondo - local play from this folder
echo  =====================================
echo.

set "NODE_EXE="
where node >nul 2>nul && set "NODE_EXE=node"
if not defined NODE_EXE if exist "%ProgramFiles%\nodejs\node.exe" (
  set "PATH=%ProgramFiles%\nodejs;%PATH%"
  set "NODE_EXE=node"
)
if not defined NODE_EXE if exist "%LocalAppData%\Programs\node\node.exe" (
  set "PATH=%LocalAppData%\Programs\node;%PATH%"
  set "NODE_EXE=node"
)
if not defined NODE_EXE (
  echo [ERROR] Node.js is required for local play from a ZIP.
  echo Install: https://nodejs.org/
  echo.
  echo If you opened this from an itch.io download: prefer the store page
  echo "Run game" button instead. No download or Node needed there.
  echo.
  pause
  exit /b 1
)

echo Starting local server on http://127.0.0.1:4173/
echo Close this window to stop the server.
echo.

start "" cmd /c "timeout /t 2 /nobreak >nul & start http://127.0.0.1:4173/"
call npx --yes serve -p 4173 .
echo.
pause
