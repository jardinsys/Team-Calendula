<# 
.SYNOPSIS
    Starts Chameleon stack: Redis + API (serves Activity) + Bot
.DESCRIPTION
    Emulates docker compose up redis chameleon-api chameleon-bot locally.
    Activity is served by API at /discord_activity (built dist/).
#>

Write-Host "🌸 Chameleon Dev Launcher" -ForegroundColor Magenta
Write-Host "═════════════════════════" -ForegroundColor Magenta
Write-Host ""
Write-Host "Select what to start:" -ForegroundColor Cyan
Write-Host "  1) API only      (port 3001, serves Activity at /discord_activity)" -ForegroundColor Gray
Write-Host "  2) Bot only      (connects to Discord)" -ForegroundColor Gray
Write-Host "  3) Both (API + Bot) in separate terminals" -ForegroundColor Gray
Write-Host "  4) Both in this terminal (API background, Bot foreground)" -ForegroundColor Gray
Write-Host ""
$choice = Read-Host "Choice [1-4]"

# Ensure Redis is running
Write-Host "Checking Redis..." -ForegroundColor Cyan
$redis = docker ps --filter "name=redis" --format "{{.Names}}" 2>$null
if (-not $redis) {
    Write-Host "Starting Redis..." -ForegroundColor Cyan
    docker run -d --name redis -p 6379:6379 redis:7-alpine
    Start-Sleep 2
} else {
    Write-Host "Redis already running" -ForegroundColor Green
}

# Build activity if dist doesn't exist
if (-not (Test-Path "Chameleon/activity/dist/index.html")) {
    Write-Host "Building Activity..." -ForegroundColor Cyan
    cd Chameleon/activity
    npm run build
    cd ../..
}

switch ($choice) {
    '1' {
        Write-Host "Starting Chameleon API on port 3001..." -ForegroundColor Cyan
        cd Chameleon
        $env:REDIS_URL = 'redis://localhost:6379'
        node webapp/server.js
    }
    '2' {
        Write-Host "Starting Chameleon Bot..." -ForegroundColor Cyan
        cd Chameleon
        $env:REDIS_URL = 'redis://localhost:6379'
        node bot.js
    }
    '3' {
        Write-Host "Starting API in new window..." -ForegroundColor Cyan
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd Chameleon; `$env:REDIS_URL='redis://localhost:6379'; node webapp/server.js" -WindowStyle Normal
        Start-Sleep 2
        Write-Host "Starting Bot in new window..." -ForegroundColor Cyan
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd Chameleon; `$env:REDIS_URL='redis://localhost:6379'; node bot.js" -WindowStyle Normal
        Write-Host ""
        Write-Host "✅ Both started in separate windows!" -ForegroundColor Green
        Write-Host "   API + Activity: http://localhost:3001/discord_activity?frame_id=test" -ForegroundColor Gray
        Write-Host "   API Health:     http://localhost:3001/api/health" -ForegroundColor Gray
    }
    '4' {
        Write-Host "Starting API in background..." -ForegroundColor Cyan
        $apiJob = Start-Job -ScriptBlock {
            cd Chameleon
            $env:REDIS_URL = 'redis://localhost:6379'
            node webapp/server.js
        } -Name "Chameleon-API"
        Start-Sleep 2
        Write-Host "Starting Bot in foreground (Ctrl+C stops both)..." -ForegroundColor Cyan
        cd Chameleon
        $env:REDIS_URL = 'redis://localhost:6379'
        try {
            node bot.js
        } finally {
            Stop-Job -Name "Chameleon-API" -ErrorAction SilentlyContinue
            Remove-Job -Name "Chameleon-API" -ErrorAction SilentlyContinue
        }
    }
    default {
        Write-Host "Invalid choice" -ForegroundColor Red
    }
}