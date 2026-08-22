# Redeploys Vantablock to the production box (Panel + DB + Vantablock itself, on
# their own server at 192.168.1.248 - see scripts/start-dev.ps1 for the Wings side,
# which stays on this machine).
#
# Packages the current source (excluding node_modules, dist, pterodactyl/data), ships
# it to the server, reinstalls dependencies, rebuilds the frontend, and restarts the
# API service. The server's own .env and server/data.db are left untouched since
# they're never part of the package.
#
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\deploy-server.ps1
#     or: npm run deploy:server

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$server = "192.168.1.248"
$sshUser = "glitch"
$sshKey = "$env:USERPROFILE\.ssh\vantablock_deploy"
$remoteDir = "/opt/vantablock"
# nginx (and the Express API behind it) are loopback-only as of 2026-08-21 (see
# INFRASTRUCTURE.md) — no longer reachable at 192.168.1.248:8081 from this
# machine on purpose, so the health check below runs *on the box itself* over
# SSH instead of a direct HTTP request from here.
$healthUrl = "http://127.0.0.1:8081/api/health"

function Remote($command) {
    ssh -i $sshKey "$sshUser@$server" $command
    if ($LASTEXITCODE -ne 0) { throw "Remote command failed: $command" }
}

function RemoteOutput($command) {
    return (ssh -i $sshKey "$sshUser@$server" $command)
}

Write-Host "Packaging source..." -ForegroundColor Cyan
$tarPath = Join-Path $env:TEMP "vantablock-deploy.tar.gz"
if (Test-Path $tarPath) { Remove-Item $tarPath }
Push-Location $repoRoot
try {
    & "$env:WINDIR\System32\tar.exe" -czf $tarPath `
        --exclude=node_modules --exclude=dist --exclude=pterodactyl/data `
        --exclude=.git --exclude=*.log --exclude=server/data.db `
        --exclude=server/data.db-wal --exclude=server/data.db-shm `
        src server public index.html vite.config.ts tsconfig.json tsconfig.app.json `
        tsconfig.node.json tsconfig.server.json package.json package-lock.json scripts
    if ($LASTEXITCODE -ne 0) { throw "tar failed" }
} finally {
    Pop-Location
}

Write-Host "Uploading to $server..." -ForegroundColor Cyan
scp -i $sshKey $tarPath "${sshUser}@${server}:/tmp/vantablock-deploy.tar.gz"
if ($LASTEXITCODE -ne 0) { throw "scp failed" }
Remove-Item $tarPath

Write-Host "Extracting and installing on the server..." -ForegroundColor Cyan
Remote "cd $remoteDir && tar -xzf /tmp/vantablock-deploy.tar.gz && rm /tmp/vantablock-deploy.tar.gz"
Remote "cd $remoteDir && npm install"

Write-Host "Building..." -ForegroundColor Cyan
Remote "cd $remoteDir && npm run build"

Write-Host "Restarting the API service..." -ForegroundColor Cyan
Remote "systemctl --user restart vantablock-api"

Write-Host "Checking health..." -ForegroundColor Cyan
Start-Sleep -Seconds 2
try {
    $status = RemoteOutput "curl -s -o /dev/null -w '%{http_code}' $healthUrl"
    if ($status -eq "200") {
        Write-Host "Deployed successfully - $healthUrl is responding." -ForegroundColor Green
    } else {
        Write-Host "Deployed, but health check returned status $status." -ForegroundColor Yellow
    }
} catch {
    Write-Host "Deployed, but health check failed: $_" -ForegroundColor Red
}
