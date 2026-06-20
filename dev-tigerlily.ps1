<#
.SYNOPSIS
    Starts TigerLily bot (Trigin) - uses root config.json, token: discordTokens.trigin, needs MongoDB
#>

Write-Host "🐯 Starting TigerLily (Trigin) bot..." -ForegroundColor Yellow

if (-not (Test-Path "config.json")) {
    Write-Host "❌ config.json not found in root!" -ForegroundColor Red
    exit 1
}

cd TigerLily
node bot.js