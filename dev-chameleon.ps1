<# 
.SYNOPSIS
    Chameleon Dev Launcher - Interactive menu to start API, Bot, or both
.DESCRIPTION
    Run components in separate visible terminals (like docker compose).
#>

Write-Host "🌸 Chameleon Dev Launcher" -ForegroundColor Magenta
Write-Host "════════════════════════" -ForegroundColor Magenta
Write-Host ""

# Ensure Redis
$redis = docker ps --filter "name=redis" --format "{{.Names}}" 2>$null
if (-not $redis) {
    Write-Host "Starting Redis..." -ForegroundColor Cyan
    docker run -d --name redis -p 6379:6379 redis:7-alpine
    Start-Sleep 2
}

# Build Activity if needed
if (-not (Test-Path "Chameleon/activity/dist/index.html")) {
    Write-Host "Building Activity..." -ForegroundColor Cyan
    cd Chameleon/activity
    npm run build
    cd ../..
}

Write-Host ""
Write-Host "Select what to start:" -ForegroundColor Cyan
Write-Host "  1) API only      (port 3001, serves Activity at /discord_activity)"
Write-Host "  2) Bot only      (connects to Discord)"
Write-Host "  3) Both (API + Bot) in separate terminals"
Write-Host "  4) Both in this terminal (API background, Bot foreground)"
Write-Host ""
$choice = Read-Host "Choice [1-4]"

switch ($choice) {
    1 { Start-Api }
    2 { Start-Bot }
    3 { Start-Both-Separate }
    4 { Start-Both-Same }
    default { Write-Host "Invalid choice" -ForegroundColor Red; exit 1 }
}

function Start-Api {
    Write-Host "`n🌐 Starting Chameleon API..." -ForegroundColor Green
    cd Chameleon
    $env:REDIS_URL = 'redis://localhost:6379'
    Write-Host "Expected output:" -ForegroundColor Gray
    Write-Host "  📦 Webapp API connected to MongoDB" -ForegroundColor Gray
    Write-Host "  🌐 Webapp API running on port 3001" -ForegroundColor Gray
    Write-Host "  [WebSocket] Server attached" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
    node webapp/server.js
}

function Start-Bot {
    Write-Host "`n🤖 Starting Chameleon Bot..." -ForegroundColor Green
    cd Chameleon
    $env:REDIS_URL = 'redis://localhost:6379'
    Write-Host "Expected output:" -ForegroundColor Gray
    Write-Host "  💙---LOADING COMMANDS---💙" -ForegroundColor Gray
    Write-Host "  Loaded Slash/Prefix/Hybrid commands..." -ForegroundColor Gray
    Write-Host "  💙---LOGGING IN---💙" -ForegroundColor Gray
    Write-Host "  Let our wheels spin... Logged in as <bot-tag>" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
    node bot.js
}

function Start-Both-Separate {
    Write-Host "`nStarting API in new window..." -ForegroundColor Cyan
    start "Chameleon-API" powershell -NoExit -Command "
        cd Chameleon
        `$env:REDIS_URL = 'redis://localhost:6379'
        Write-Host '🌐 Starting Chameleon API...' -ForegroundColor Green
        node webapp/server.js
    "

    Write-Host "Starting Bot in new window..." -ForegroundColor Cyan
    start "Chameleon-Bot" powershell -NoExit -Command "
        cd Chameleon
        `$env:REDIS_URL = 'redis://localhost:6379'
        Write-Host '🤖 Starting Chameleon Bot...' -ForegroundColor Green
        node bot.js
    "

    Write-Host "`n✅ Both started in separate terminals!" -ForegroundColor Green
    Write-Host "   API:  http://localhost:3001/discord_activity?frame_id=test" -ForegroundColor Gray
    Write-Host "   Health: http://localhost:3001/api/health" -ForegroundColor Gray
}

function Start-Both-Same {
    Write-Host "`nStarting API in background..." -ForegroundColor Cyan
    $apiJob = Start-Job -ScriptBlock {
        cd Chameleon
        $env:REDIS_URL = 'redis://localhost:6379'
        node webapp/server.js
    } -Name "Chameleon-API"
    
    Start-Sleep 3
    Write-Host "API should be ready. Starting Bot in foreground..." -ForegroundColor Cyan
    Start-Bot
    
    # Cleanup on exit
    Stop-Job -Name "Chameleon-API" -ErrorAction SilentlyContinue
    Remove-Job -Name "Chameleon-API" -ErrorAction SilentlyContinue
}