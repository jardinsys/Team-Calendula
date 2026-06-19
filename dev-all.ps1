<#
.SYNOPSIS
    Starts ALL bots + Chameleon stack (Redis, API, Chameleon Bot, Plum, Sugar, TigerLily/Trigin)
.DESCRIPTION
    Like docker compose up but running locally. Each component runs in a separate window.
#>

Write-Host "🌸 Starting ALL Team-Calendula services..." -ForegroundColor Magenta

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

Write-Host "Starting services in separate windows..." -ForegroundColor Cyan

# Chameleon API
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd Chameleon; `$env:REDIS_URL='redis://localhost:6379'; node webapp/server.js" -WindowStyle Normal

# Chameleon Bot
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd Chameleon; `$env:REDIS_URL='redis://localhost:6379'; node bot.js" -WindowStyle Normal

# Plum Bot
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd Plum; node bot.js" -WindowStyle Normal

# Sugar Bot
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd Sugar; node bot.js" -WindowStyle Normal

# TigerLily (Trigin) Bot
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd TigerLily; node bot.js" -WindowStyle Normal

Write-Host ""
Write-Host "✅ All services started in separate windows!" -ForegroundColor Green
Write-Host ""
Write-Host "Chameleon API + Activity: http://localhost:3001/discord_activity?frame_id=test" -ForegroundColor Gray
Write-Host "Chameleon API Health:     http://localhost:3001/api/health" -ForegroundColor Gray