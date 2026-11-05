@echo off
REM Starts the QueueSmart database, the backend (port 4000) and the Expo dev
REM server. The backend and Expo each get their own window; close those
REM windows to stop them. The database keeps running in Docker until you run
REM "npm run db:down" in server\.

set ROOT=%~dp0

if not exist "%ROOT%server\node_modules" (
  echo Installing backend packages first...
  pushd "%ROOT%server"
  call npm ci
  popd
)

echo Starting the database ...
pushd "%ROOT%server"
call npm run db:start
if errorlevel 1 (
  popd
  echo.
  echo The database did not start. Fix the problem above, then run this again.
  pause
  exit /b 1
)
popd

echo Starting backend on http://localhost:4000 ...
start "QueueSmart API" cmd /k "cd /d "%ROOT%server" && npm run dev"

echo Starting Expo ...
start "QueueSmart Expo" cmd /k "cd /d "%ROOT%" && npx expo start"

echo.
echo Both windows are open. Scan the Expo QR code with Expo Go, or press w for web.
