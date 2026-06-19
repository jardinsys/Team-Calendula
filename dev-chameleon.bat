@echo off
REM dev-chameleon.bat - Starts Redis + Chameleon API + Chameleon Bot
echo 🌸 Chameleon Dev Launcher
echo ═════════════════════════
echo.
echo Select what to start:
echo   1) API only      (port 3001, serves Activity at /discord_activity)
echo   2) Bot only      (connects to Discord)
echo   3) Both (API + Bot) in separate windows
echo   4) Both in this window (API background, Bot foreground)
echo.
set /p choice="Choice [1-4]: "

REM Ensure Redis is running
echo Checking Redis...
docker ps --filter "name=redis" --format "{{.Names}}" | findstr /r "redis" >nul
if errorlevel 1 (
    echo Starting Redis...
    docker run -d --name redis -p 6379:6379 redis:7-alpine
    timeout /t 2 >nul
) else (
    echo Redis already running
)

REM Build Activity if needed
if not exist "Chameleon\activity\dist\index.html" (
    echo Building Activity...
    cd Chameleon\activity
    npm run build
    cd ..\..
)

if "%choice%"=="1" (
    echo Starting Chameleon API on port 3001...
    cd Chameleon
    set REDIS_URL=redis://localhost:6379
    node webapp/server.js
) else if "%choice%"=="2" (
    echo Starting Chameleon Bot...
    cd Chameleon
    set REDIS_URL=redis://localhost:6379
    node bot.js
) else if "%choice%"=="3" (
    echo Starting API in new window...
    start "Chameleon-API" cmd /k "cd /d Chameleon && set REDIS_URL=redis://localhost:6379 && node webapp/server.js"
    timeout /t 2 >nul
    echo Starting Bot in new window...
    start "Chameleon-Bot" cmd /k "cd /d Chameleon && set REDIS_URL=redis://localhost:6379 && node bot.js"
    echo.
    echo ✅ Both started in separate windows!
    echo    API + Activity: http://localhost:3001/discord_activity?frame_id=test
    echo    API Health:     http://localhost:3001/api/health
) else if "%choice%"=="4" (
    echo Starting API in background...
    start /B "Chameleon-API" cmd /k "cd /d Chameleon && set REDIS_URL=redis://localhost:6379 && node webapp/server.js"
    timeout /t 2 >nul
    echo Starting Bot in foreground (Ctrl+C stops both)...
    cd Chameleon
    set REDIS_URL=redis://localhost:6379
    node bot.js
) else (
    echo Invalid choice
)