# Stops the full Vantablock dev environment: kills the web + API dev servers,
# stops the WSL keep-alive, and shuts down WSL (which also stops Wings and any
# running game server containers inside it).
#
# The Pterodactyl Panel + database live on their own box (192.168.1.248) now —
# there's no local panel stack on this machine to stop.
#
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\stop-dev.ps1
#     or: npm run stop:all

$repoRoot = Split-Path -Parent $PSScriptRoot

Write-Host "Stopping Vantablock dev servers (ports 5173 and 3001)..." -ForegroundColor Cyan
foreach ($port in 5173, 3001) {
    $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($conn in $conns) {
        try {
            Stop-Process -Id $conn.OwningProcess -Force -ErrorAction Stop
            Write-Host "Stopped process on port $port (PID $($conn.OwningProcess))." -ForegroundColor Green
        } catch {
            Write-Host "Could not stop process on port $port : $_" -ForegroundColor Yellow
        }
    }
}

Write-Host "Stopping the WSL keep-alive process..." -ForegroundColor Cyan
Get-CimInstance Win32_Process -Filter "Name = 'wsl.exe'" |
    Where-Object { $_.CommandLine -and $_.CommandLine -like "*sleep infinity*" } |
    ForEach-Object {
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }

Write-Host "Shutting down WSL..." -ForegroundColor Cyan
wsl --shutdown

Write-Host "Everything is stopped." -ForegroundColor Green
