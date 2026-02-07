# launch-antigravity.ps1
# Launches Antigravity (or Cursor) with Chrome DevTools Protocol (CDP) enabled
# This is required for Personal Accept to work
#
# Usage:
#   .\launch-antigravity.ps1              # Launches Antigravity
#   .\launch-antigravity.ps1 -IDE Cursor  # Launches Cursor instead
#
# Port: 9000 (default CDP port for Personal Accept)

param(
    [ValidateSet("Antigravity", "Cursor", "Code")]
    [string]$IDE = "Antigravity",

    [int]$Port = 9000
)

$ErrorActionPreference = "Stop"

# Common install locations
$installPaths = @(
    "$env:LOCALAPPDATA\Programs\$IDE\$IDE.exe",
    "$env:LOCALAPPDATA\$IDE\$IDE.exe",
    "$env:ProgramFiles\$IDE\$IDE.exe",
    "$env:ProgramFiles(x86)\$IDE\$IDE.exe"
)

# Find the executable
$exePath = $null
foreach ($path in $installPaths) {
    if (Test-Path $path) {
        $exePath = $path
        break
    }
}

if (-not $exePath) {
    Write-Host "ERROR: Could not find $IDE installation." -ForegroundColor Red
    Write-Host "Searched locations:" -ForegroundColor Yellow
    $installPaths | ForEach-Object { Write-Host "  - $_" -ForegroundColor Gray }
    Write-Host ""
    Write-Host "Please specify the path manually or ensure $IDE is installed." -ForegroundColor Yellow
    exit 1
}

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Personal Accept - CDP Launcher" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "IDE:  $IDE" -ForegroundColor Green
Write-Host "Path: $exePath" -ForegroundColor Green
Write-Host "CDP Port: $Port" -ForegroundColor Green
Write-Host ""

# Check if already running with CDP
$existingProcess = Get-Process -Name $IDE -ErrorAction SilentlyContinue
if ($existingProcess) {
    Write-Host "WARNING: $IDE is already running." -ForegroundColor Yellow
    Write-Host "For CDP to work, you should close all $IDE windows first." -ForegroundColor Yellow
    Write-Host ""
    $response = Read-Host "Close existing instances and continue? (Y/N)"
    if ($response -eq 'Y' -or $response -eq 'y') {
        Write-Host "Closing $IDE..." -ForegroundColor Yellow
        Stop-Process -Name $IDE -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    } else {
        Write-Host "Aborted. Please close $IDE manually and try again." -ForegroundColor Red
        exit 1
    }
}

# Launch with CDP flag
$arguments = @(
    "--remote-debugging-port=$Port",
    "--disable-gpu-driver-bug-workarounds",
    "--ignore-gpu-blacklist"
)

Write-Host "Launching $IDE with CDP enabled..." -ForegroundColor Cyan
Write-Host "Command: `"$exePath`" $($arguments -join ' ')" -ForegroundColor Gray
Write-Host ""

Start-Process -FilePath $exePath -ArgumentList $arguments

Write-Host "SUCCESS! $IDE launched with CDP on port $Port" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Wait for $IDE to fully load" -ForegroundColor White
Write-Host "  2. Click the Personal Accept status bar item to enable" -ForegroundColor White
Write-Host "  3. You should see 'Personal Accept: ACTIVE'" -ForegroundColor White
Write-Host ""
Write-Host "To verify CDP is working, run:" -ForegroundColor Yellow
Write-Host "  Invoke-WebRequest -Uri 'http://127.0.0.1:$Port/json/list' | Select-Object -ExpandProperty Content" -ForegroundColor Gray
