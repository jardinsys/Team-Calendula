@echo off
REM dev-chameleon.bat - Interactive launcher for Chameleon API and/or Bot
echo 🌸 Chameleon Dev Launcher
echo ════════════════════════

REM Check/Start Redis
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

echo.
echo Select what to start:
echo   1) API only      (port 3001, serves Activity at /discord_activity)
echo   2) Bot only      (connects to Discord)
echo   3) Both in separate windows (recommended)
echo.
set /p choice="Choice [1-3]: "

if "%choice%"=="1" goto api
if "%choice%"=="2" goto bot
if "%choice%"=="3" goto both
echo Invalid choice
pause
exit /b

:api
echo.
echo 🌐 Starting Chameleon API...
echo Expected output:
echo   ^> 📦 Webapp API connected to MongoDB
echo   ^> 🌐 Webapp API running on port 3001
echo   ^> [WebSocket] Server attached
echo.
echo Press Ctrl+C to stop
cd Chameleon
set REDIS_URL=redis://localhost:6379
node webapp/server.js
goto end

:bot
echo.
echo 🤖 Starting Chameleon Bot...
echo Expected output:
echo   ^> 💙---LOADING COMMANDS---💙
echo   ^> Loaded Slash/Prefix/Hybrid commands...
echo   ^> 💙---LOGGING IN---💙
echo   ^> Let our wheels spin... Logged in as ^<bot-tag^>
echo.
echo Press Ctrl+C to stop
cd Chameleon
set REDIS_URL=redis://localhost:6379
node bot.js
goto end

:both
echo.
echo Starting API in new window...
start "Chameleon-API" cmd /k "cd /d Chameleon && set REDIS_URL=redis://localhost:6379 && echo 🌐 Starting Chameleon API... && node webapp/server.js"

echo Starting Bot in new window...
start "Chameleon-Bot" cmd /k "cd /d Chameleon && set REDIS_URL=redis://localhost:6379 && echo 🤖 Starting Chameleon Bot... && node bot.js"

echo.
echo ✅ Both started in separate terminals!
echo    API:  http://localhost:3001/discord_activity?frame_id=test
echo    Health: http://localhost:3001/api/health
echo.
pause

:end