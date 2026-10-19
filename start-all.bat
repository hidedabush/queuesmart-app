@echo off
REM Starts the QueueSmart backend (port 4000) and the Expo dev server,
REM each in its own window. Close those windows to stop them.

set ROOT=%~dp0

if not exist "%ROOT%server\node_modules" (
  echo Installing backend packages first...
  pushd "%ROOT%server"
  call npm ci
  popd
)

echo Starting backend on http://localhost:4000 ...
start "QueueSmart API" cmd /k "cd /d "%ROOT%server" && npm run dev"

echo Starting Expo ...
start "QueueSmart Expo" cmd /k "cd /d "%ROOT%" && npx expo start"

echo.
echo Both windows are open. Scan the Expo QR code with Expo Go, or press w for web.
