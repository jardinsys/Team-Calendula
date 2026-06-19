<#
.SYNOPSIS
    Starts Sugar bot (uses root config.json, token: discordTokens.sucre, needs MongoDB)
#>

Write-Host "🌸 Starting Sugar bot..." -ForegroundColor Magenta

if (-not (Test-Path "config.json")) {
    Write-Host "❌ config.json not found in root!" -ForegroundColor Red
    exit 1
}

cd Sugar
node bot.js