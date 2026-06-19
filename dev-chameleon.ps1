<# 
.SYNOPSIS
    Starts Chameleon stack: Redis + API (serves Activity) + Bot
.DESCRIPTION
    Emulates docker compose up redis chameleon-api chameleon-bot locally.
    Activity is served by API at /discord_activity (built dist/).
#>

Write-Host "🌸 Starting Chameleon dev stack..." -ForegroundColor Magenta

# Ensure Redis is running
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

# Start API server (serves Activity at /discord_activity)
Write-Host "Starting Chameleon API on port 3001..." -ForegroundColor Cyan
$apiJob = Start-Job -ScriptBlock {
    cd Chameleon
    $env:REDIS_URL = 'redis://localhost:6379'
    node webapp/server.js
} -Name "Chameleon-API"

# Start Chameleon Bot
Write-Host "Starting Chameleon Bot..." -ForegroundColor Cyan
$botJob = Start-Job -ScriptBlock {
    cd Chameleon
    $env:REDIS_URL = 'redis://localhost:6379'
    node bot.js
} -Name "Chameleon-Bot"

Write-Host ""
Write-Host "✅ Chameleon stack running!" -ForegroundColor Green
Write-Host "   API + Activity: http://localhost:3001/discord_activity?frame_id=test" -ForegroundColor Gray
Write-Host "   API Health:     http://localhost:3001/api/health" -ForegroundColor Gray
Write-Host ""
Write-Host "Press Ctrl+C to stop all..." -ForegroundColor Yellow

# Wait for Ctrl+C
try {
    while ($true) { Start-Sleep 1 }
} finally {
    Write-Host "`n🛑 Stopping..." -ForegroundColor Yellow
    Stop-Job -Name "Chameleon-API", "Chameleon-Bot" -ErrorAction SilentlyContinue
    Remove-Job -Name "Chameleon-API", "Chameleon-Bot" -ErrorAction SilentlyContinue
    Write-Host "Stopped." -ForegroundColor Green
}