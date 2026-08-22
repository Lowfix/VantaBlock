# Re-applies the VantaBlock Pterodactyl Panel theme (Blueprint framework + the
# "vantablock" CSS extension + a handful of core-file edits + the legacy Admin
# UI recolor + the "VantaBlock" panel name).
#
# Why this script exists: none of this survives a `docker compose up -d` /
# container recreate of pterodactyl-panel-1 on the CasaOS box, because only
# data/panel-var, the nginx conf, and logs are bind-mounted - the rest of
# /app (Blueprint, node_modules, our edited source files, compiled assets)
# lives only in the container's writable layer. See .claude/PANEL_THEME.md
# for the full story of how this was built and why it works the way it does.
#
# Safe to re-run any time the theme needs restoring (or updating - edit the
# files under pterodactyl/theme/ first, then re-run this script).
#
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\deploy-panel-theme.ps1
#     or: npm run deploy:panel-theme

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$themeDir = Join-Path $repoRoot "pterodactyl\theme"
$server = "192.168.1.248"
$sshUser = "glitch"
$sshKey = "$env:USERPROFILE\.ssh\vantablock_deploy"
$container = "pterodactyl-panel-1"
$sshOpts = @("-i", $sshKey, "-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=8")

function Remote($command) {
    & ssh @sshOpts "$sshUser@$server" $command
    if ($LASTEXITCODE -ne 0) { throw "Remote command failed: $command" }
}

function RemoteDockerExec($innerCommand, [string]$envVars = "") {
    $dockerCmd = "docker exec $envVars $container sh -c '$innerCommand'"
    Remote $dockerCmd
}

Write-Host "Step 1/8: Installing build dependencies (idempotent)..." -ForegroundColor Cyan
RemoteDockerExec "apk add --no-cache nodejs yarn bash zip ncurses coreutils"

Write-Host "Step 2/8: Downloading and extracting Blueprint framework..." -ForegroundColor Cyan
RemoteDockerExec "cd /app && curl -sSL -o release.zip https://github.com/BlueprintFramework/framework/releases/download/beta-2026-08/release.zip && unzip -o -q release.zip && rm -f release.zip"

Write-Host "Step 3/8: yarn install (against Blueprint's package.json/yarn.lock - must run AFTER extraction above, not before)..." -ForegroundColor Cyan
RemoteDockerExec "cd /app && yarn install --non-interactive"

Write-Host "Step 4/8: Installing the Blueprint framework (CI mode)..." -ForegroundColor Cyan
RemoteDockerExec "cd /app && bash blueprint.sh" "-e BLUEPRINT_ENVIRONMENT=ci -e TERM=xterm"

Write-Host "Step 5/8: Packaging and installing the vantablock CSS extension..." -ForegroundColor Cyan
$extZip = Join-Path $env:TEMP "vantablock.blueprint"
if (Test-Path $extZip) { Remove-Item $extZip }
Compress-Archive -Path (Join-Path $themeDir "extension\*") -DestinationPath $extZip
scp @sshOpts $extZip "${sshUser}@${server}:/tmp/vantablock.blueprint"
if ($LASTEXITCODE -ne 0) { throw "scp of extension package failed" }
Remove-Item $extZip
Remote "docker cp /tmp/vantablock.blueprint ${container}:/app/vantablock.blueprint && rm /tmp/vantablock.blueprint"
RemoteDockerExec "cd /app && echo y | blueprint -install vantablock" "-e TERM=xterm"

Write-Host "Step 6/8: Copying edited source files + logo..." -ForegroundColor Cyan
$filesToCopy = @(
    @{ local = "tailwind.config.js"; remote = "/app/tailwind.config.js" },
    @{ local = "LoginFormContainer.tsx"; remote = "/app/resources/scripts/components/auth/LoginFormContainer.tsx" },
    @{ local = "LoginContainer.tsx"; remote = "/app/resources/scripts/components/auth/LoginContainer.tsx" },
    @{ local = "pterodactyl.css"; remote = "/app/public/themes/pterodactyl/css/pterodactyl.css" },
    @{ local = "vantablock-logo.svg"; remote = "/app/public/assets/svgs/vantablock.svg" }
)
foreach ($f in $filesToCopy) {
    $localPath = Join-Path $themeDir $f.local
    $tmpName = "vbtheme_$($f.local -replace '[\\/]', '_')"
    scp @sshOpts $localPath "${sshUser}@${server}:/tmp/$tmpName"
    if ($LASTEXITCODE -ne 0) { throw "scp of $($f.local) failed" }
    Remote "docker cp /tmp/$tmpName ${container}:$($f.remote) && rm /tmp/$tmpName"
}

Write-Host "Step 7/8: Rebuilding panel assets (cache-cleared, legacy OpenSSL provider)..." -ForegroundColor Cyan
RemoteDockerExec "cd /app && rm -rf node_modules/.cache"
RemoteDockerExec "cd /app && yarn run build:production" "-e NODE_OPTIONS=--openssl-legacy-provider"
RemoteDockerExec "chown -R www-data:www-data /app"

Write-Host "Step 8/8: Setting the panel name to VantaBlock..." -ForegroundColor Cyan
$tinkerScript = @'
\Illuminate\Support\Facades\DB::table('settings')->updateOrInsert(
    ['key' => 'settings::app:name'],
    ['value' => 'VantaBlock']
);
echo "done\n";
'@
$tinkerPath = Join-Path $env:TEMP "vbtheme_set_name.php"
Set-Content -Path $tinkerPath -Value $tinkerScript -Encoding utf8
scp @sshOpts $tinkerPath "${sshUser}@${server}:/tmp/vbtheme_set_name.php"
if ($LASTEXITCODE -ne 0) { throw "scp of tinker script failed" }
Remove-Item $tinkerPath
Remote "docker cp /tmp/vbtheme_set_name.php ${container}:/tmp/set_name.php && rm /tmp/vbtheme_set_name.php"
RemoteDockerExec "cd /app && php artisan tinker < /tmp/set_name.php && rm /tmp/set_name.php"
RemoteDockerExec "cd /app && php artisan cache:clear && php artisan config:clear && php artisan view:clear"

Write-Host "Verifying..." -ForegroundColor Cyan
try {
    $login = Invoke-WebRequest -Uri "http://$server/auth/login" -UseBasicParsing -TimeoutSec 10
    if ($login.StatusCode -eq 200 -and $login.Content -match "VantaBlock") {
        Write-Host "Theme re-applied successfully - http://$server/auth/login is responding and branded." -ForegroundColor Green
    } else {
        Write-Host "Ran to completion, but the verification check looked off - check the panel manually." -ForegroundColor Yellow
    }
} catch {
    Write-Host "Ran to completion, but the health check request failed: $_" -ForegroundColor Red
}
