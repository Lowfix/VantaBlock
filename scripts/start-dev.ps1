# Starts the full Vantablock dev environment: boots WSL, keeps it awake, makes sure
# Wings is running, then starts the Vantablock web + API servers.
#
# The Pterodactyl Panel + database now live on their own box (192.168.1.248) — this
# machine only runs Wings (the daemon that manages the actual game server containers).
#
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\start-dev.ps1
#     or: npm run start:all

$repoRoot = Split-Path -Parent $PSScriptRoot
$panelUrl = "http://192.168.1.248"

Write-Host "Booting WSL (Ubuntu)..." -ForegroundColor Cyan
wsl -d Ubuntu -- echo ready | Out-Null

Write-Host "Checking WSL keep-alive (prevents WSL2 idling out and dropping Wings)..." -ForegroundColor Cyan
$existingKeepAlive = Get-CimInstance Win32_Process -Filter "Name = 'wsl.exe'" |
    Where-Object { $_.CommandLine -and $_.CommandLine -like "*sleep infinity*" }
if (-not $existingKeepAlive) {
    Start-Process -FilePath "wsl" -ArgumentList "-d", "Ubuntu", "--", "sleep", "infinity" -WindowStyle Hidden
    Write-Host "Keep-alive started." -ForegroundColor Green
} else {
    Write-Host "Keep-alive already running." -ForegroundColor Yellow
}

Write-Host "Making sure Wings is running..." -ForegroundColor Cyan
wsl -d Ubuntu -- sudo systemctl start wings

Write-Host "Checking the Panel (http://192.168.1.248) is reachable..." -ForegroundColor Cyan
$panelReady = $false
for ($i = 0; $i -lt 10; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "$panelUrl/" -UseBasicParsing -TimeoutSec 3
        if ($response.StatusCode -eq 200) {
            $panelReady = $true
            break
        }
    } catch {
        # not up yet, keep polling
    }
    Start-Sleep -Seconds 2
}
if ($panelReady) {
    Write-Host "Panel is reachable." -ForegroundColor Green
} else {
    Write-Host "Panel didn't respond - check the Panel/DB box at 192.168.1.248 is powered on and reachable." -ForegroundColor Yellow
}

Write-Host "Starting Vantablock (web + API)..." -ForegroundColor Cyan
Set-Location $repoRoot
npm run dev:all
