<#
.SYNOPSIS
    Starts Plum bot (uses root config.json, token: discordTokens.prune)
#>

Write-Host "🌸 Starting Plum bot..." -ForegroundColor Magenta

if (-not (Test-Path "config.json")) {
    Write-Host "❌ config.json not found in root!" -ForegroundColor Red
    exit 1
}

cd Plum
node bot.js