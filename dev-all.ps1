<#
.SYNOPSIS
    Starts ALL bots + Chameleon stack (Redis, API, Chameleon Bot, Plum, Sugar, TigerLily/Trigin)
.DESCRIPTION
    Like docker compose up but running locally. Each component runs in a background job.
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

$jobs = @()

# Chameleon API
$jobs += Start-Job -ScriptBlock {
    cd Chameleon
    $env:REDIS_URL = 'redis://localhost:6379'
    node webapp/server.js
} -Name "Chameleon-API"

# Chameleon Bot
$jobs += Start-Job -ScriptBlock {
    cd Chameleon
    $env:REDIS_URL = 'redis://localhost:6379'
    node bot.js
} -Name "Chameleon-Bot"

# Plum Bot
$jobs += Start-Job -ScriptBlock {
    cd Plum
    node bot.js
} -Name "Plum-Bot"

# Sugar Bot
$jobs += Start-Job -ScriptBlock {
    cd Sugar
    node bot.js
} -Name "Sugar-Bot"

# TigerLily (Trigin) Bot
$jobs += Start-Job -ScriptBlock {
    cd TigerLily
    node bot.js
} -Name "TigerLily-Bot"

Write-Host ""
Write-Host "✅ All services started!" -ForegroundColor Green
Write-Host ""
Write-Host "Chameleon API + Activity: http://localhost:3001/discord_activity?frame_id=test" -ForegroundColor Gray
Write-Host "Chameleon API Health:     http://localhost:3001/api/health" -ForegroundColor Gray
Write-Host ""
Write-Host "Running jobs:" -ForegroundColor Cyan
Get-Job -Name "*-Bot", "*-API" | Format-Table Name, State, HasMoreData -AutoSize

Write-Host ""
Write-Host "Press Ctrl+C to stop ALL..." -ForegroundColor Yellow

try {
    while ($true) { Start-Sleep 1 }
} finally {
    Write-Host "`n🛑 Stopping all services..." -ForegroundColor Yellow
    Get-Job -Name "*-Bot", "*-API" | Stop-Job -ErrorAction SilentlyContinue
    Get-Job -Name "*-Bot", "*-API" | Remove-Job -ErrorAction SilentlyContinue
    Write-Host "All stopped." -ForegroundColor Green
}