<#
.SYNOPSIS
    Starts Chameleon Activity stack: Redis + Activity Server + Bot
.DESCRIPTION
    Like docker compose up redis chameleon-activity chameleon-bot locally.
    Activity is served at root / by a dedicated Express server.
    Webapp is NOT started here.
#>

Write-Host "🎡 Chameleon Activity Dev Launcher" -ForegroundColor Magenta
Write-Host "════════════════════════════════" -ForegroundColor Magenta
Write-Host ""

# Ensure Redis is running (container or docker run)
Write-Host "Checking Redis..." -ForegroundColor Cyan
$redis = docker ps --filter "name=redis" --format "{{.Names}}" 2>$null
if (-not $redis) {
    Write-Host "Starting Redis..." -ForegroundColor Cyan
    docker run -d --name redis -p 6379:6379 redis:7-alpine
    Start-Sleep 2
} else {
    Write-Host "Redis already running: $redis" -ForegroundColor Green
}

$choice = $null
while ($choice -notmatch '^[1-4]$') {
    Write-Host ""
    Write-Host "Select what to start:" -ForegroundColor Cyan
    Write-Host "  1) Activity Server only      (port 3001, serves Activity at /)" -ForegroundColor Gray
    Write-Host "  2) Bot only                  (connects to Discord)" -ForegroundColor Gray
    Write-Host "  3) Both (Activity + Bot) in separate windows" -ForegroundColor Gray
    Write-Host "  4) Both in this terminal (Activity background, Bot foreground)" -ForegroundColor Gray
    Write-Host ""
    $choice = Read-Host "Choice [1-4]"
}

switch ($choice) {
    '1' {
        Write-Host "Starting Activity Server on port 3001..." -ForegroundColor Cyan
        cd Chameleon
        $env:REDIS_URL = 'redis://localhost:6379'
        node activity/server.js
    }
    '2' {
        Write-Host "Starting Chameleon Bot..." -ForegroundColor Cyan
        cd Chameleon
        $env:REDIS_URL = 'redis://localhost:6379'
        node bot.js
    }
    '3' {
        Write-Host "Starting Activity Server in new window..." -ForegroundColor Cyan
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd Chameleon; `$env:REDIS_URL='redis://localhost:6379'; node activity/server.js" -WindowStyle Normal
        Start-Sleep 2

        Write-Host "Starting Bot in new window..." -ForegroundColor Cyan
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd Chameleon; `$env:REDIS_URL='redis://localhost:6379'; node bot.js" -WindowStyle Normal

        Write-Host ""
        Write-Host "✅ Activity + Bot started in separate windows!" -ForegroundColor Green
        Write-Host "   Activity:     http://localhost:3001/" -ForegroundColor Gray
        Write-Host "   Activity Health: http://localhost:3001/api/health" -ForegroundColor Gray
    }
    '4' {
        Write-Host "Starting Activity Server in background..." -ForegroundColor Cyan
        $activityJob = Start-Job -ScriptBlock {
            cd Chameleon
            $env:REDIS_URL = 'redis://localhost:6379'
            node activity/server.js
        } -Name "Chameleon-Activity"

        Start-Sleep 2

        Write-Host "Starting Bot in foreground (Ctrl+C stops both)..." -ForegroundColor Cyan
        cd Chameleon
        $env:REDIS_URL = 'redis://localhost:6379'
        try {
            node bot.js
        } finally {
            Stop-Job -Name "Chameleon-Activity" -ErrorAction SilentlyContinue
            Remove-Job -Name "Chameleon-Activity" -ErrorAction SilentlyContinue
        }
    }
}
