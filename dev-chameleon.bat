@echo off
REM dev-chameleon.bat - Starts Redis + Chameleon API + Chameleon Bot
echo 🌸 Starting Chameleon dev stack...

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

echo Starting Chameleon API on port 3001...
start "Chameleon-API" cmd /k "cd /d Chameleon && set REDIS_URL=redis://localhost:6379 && node webapp/server.js"

echo Starting Chameleon Bot...
start "Chameleon-Bot" cmd /k "cd /d Chameleon && set REDIS_URL=redis://localhost:6379 && node bot.js"

echo.
echo ✅ Chameleon stack running!
echo    API + Activity: http://localhost:3001/discord_activity?frame_id=test
echo    API Health:     http://localhost:3001/api/health
echo.
echo Close these windows to stop services.
pause