# setup.ps1
# One-shot setup for Auto Accept Agent in Antigravity IDE
# 1. Finds and patches all Antigravity shortcuts to enable CDP (--remote-debugging-port=9000)
# 2. Builds the .vsix if needed
# 3. Installs the extension into Antigravity
#
# Usage:
#   .\scripts\setup.ps1                    # Full setup
#   .\scripts\setup.ps1 -SkipShortcut      # Only install extension (shortcut already patched)
#   .\scripts\setup.ps1 -SkipInstall       # Only patch shortcut

param(
    [switch]$SkipShortcut,
    [switch]$SkipInstall,
    [int]$Port = 9000
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$IdeName = "Antigravity"
$CdpFlag = "--remote-debugging-port=$Port"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Auto Accept Agent - Setup" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ─────────────────────────────────────────────
# Step 1: Patch shortcuts to enable CDP
# ─────────────────────────────────────────────
if (-not $SkipShortcut) {
    Write-Host "[1/2] Patching shortcuts for CDP..." -ForegroundColor Yellow
    Write-Host ""

    $WshShell = New-Object -ComObject WScript.Shell

    # All locations where shortcuts might live
    $searchPaths = @(
        [System.IO.Path]::Combine($env:USERPROFILE, "Desktop"),
        [System.IO.Path]::Combine($env:APPDATA, "Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar"),
        [System.IO.Path]::Combine($env:APPDATA, "Microsoft\Windows\Start Menu\Programs"),
        [System.IO.Path]::Combine($env:ProgramData, "Microsoft\Windows\Start Menu\Programs")
    )

    # Also check OneDrive Desktop if it exists
    $oneDriveDesktop = [System.IO.Path]::Combine($env:USERPROFILE, "OneDrive\Desktop")
    if (Test-Path $oneDriveDesktop) {
        $searchPaths += $oneDriveDesktop
    }

    $found = 0
    $patched = 0

    foreach ($searchPath in $searchPaths) {
        if (-not (Test-Path $searchPath)) { continue }

        # Search recursively for .lnk files matching the IDE name
        $shortcuts = Get-ChildItem -Path $searchPath -Filter "*.lnk" -Recurse -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -like "*$IdeName*" }

        foreach ($shortcutFile in $shortcuts) {
            $found++
            $shortcut = $WshShell.CreateShortcut($shortcutFile.FullName)
            $args = $shortcut.Arguments

            if ($args -match "--remote-debugging-port=\d+") {
                if ($args -match "--remote-debugging-port=$Port") {
                    Write-Host "  OK   $($shortcutFile.FullName)" -ForegroundColor Green
                    Write-Host "        Already has CDP on port $Port" -ForegroundColor DarkGray
                } else {
                    $shortcut.Arguments = $args -replace "--remote-debugging-port=\d+", $CdpFlag
                    $shortcut.Save()
                    $patched++
                    Write-Host "  FIX  $($shortcutFile.FullName)" -ForegroundColor Yellow
                    Write-Host "        Updated port to $Port" -ForegroundColor DarkGray
                }
            } else {
                $shortcut.Arguments = "$CdpFlag $args".Trim()
                $shortcut.Save()
                $patched++
                Write-Host "  ADD  $($shortcutFile.FullName)" -ForegroundColor Green
                Write-Host "        Added CDP flag" -ForegroundColor DarkGray
            }
        }
    }

    if ($found -eq 0) {
        Write-Host "  No $IdeName shortcuts found. Creating one on Desktop..." -ForegroundColor Yellow

        $exePath = "$env:LOCALAPPDATA\Programs\$IdeName\$IdeName.exe"
        if (-not (Test-Path $exePath)) {
            Write-Host "  ERROR: $IdeName not found at $exePath" -ForegroundColor Red
            Write-Host "  Please install $IdeName first, or create a shortcut manually." -ForegroundColor Red
        } else {
            $desktopPath = [System.IO.Path]::Combine($env:USERPROFILE, "Desktop")
            $newShortcut = $WshShell.CreateShortcut("$desktopPath\$IdeName.lnk")
            $newShortcut.TargetPath = $exePath
            $newShortcut.Arguments = $CdpFlag
            $newShortcut.Save()
            $patched++
            Write-Host "  NEW  $desktopPath\$IdeName.lnk" -ForegroundColor Green
        }
    }

    Write-Host ""
    Write-Host "  Shortcuts found: $found | Patched: $patched" -ForegroundColor Cyan
    Write-Host ""
} else {
    Write-Host "[1/2] Skipping shortcut patch (--SkipShortcut)" -ForegroundColor DarkGray
    Write-Host ""
}

# ─────────────────────────────────────────────
# Step 2: Build and install the extension
# ─────────────────────────────────────────────
if (-not $SkipInstall) {
    Write-Host "[2/2] Installing extension..." -ForegroundColor Yellow
    Write-Host ""

    # Find the latest .vsix or build one
    $vsix = Get-ChildItem -Path $RepoRoot -Filter "*.vsix" | Sort-Object LastWriteTime -Descending | Select-Object -First 1

    if (-not $vsix) {
        Write-Host "  No .vsix found. Building..." -ForegroundColor Yellow
        Push-Location $RepoRoot
        try {
            npm run compile
            npx vsce package --no-dependencies
            $vsix = Get-ChildItem -Path $RepoRoot -Filter "*.vsix" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        } finally {
            Pop-Location
        }
    }

    if (-not $vsix) {
        Write-Host "  ERROR: Failed to build .vsix" -ForegroundColor Red
        exit 1
    }

    Write-Host "  VSIX: $($vsix.Name)" -ForegroundColor Green

    # Check if antigravity CLI is available
    $antigravityCli = Get-Command "antigravity" -ErrorAction SilentlyContinue
    if (-not $antigravityCli) {
        $antigravityCli = "$env:LOCALAPPDATA\Programs\$IdeName\bin\antigravity.cmd"
        if (-not (Test-Path $antigravityCli)) {
            Write-Host "  ERROR: antigravity CLI not found. Install manually:" -ForegroundColor Red
            Write-Host "    Extensions sidebar > ... > Install from VSIX > $($vsix.FullName)" -ForegroundColor Gray
            exit 1
        }
    } else {
        $antigravityCli = $antigravityCli.Source
    }

    Write-Host "  Installing into $IdeName..." -ForegroundColor Cyan
    & $antigravityCli --install-extension $vsix.FullName --force

    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "  Extension installed successfully!" -ForegroundColor Green
    } else {
        Write-Host "  ERROR: Installation failed (exit code $LASTEXITCODE)" -ForegroundColor Red
        exit 1
    }

    Write-Host ""
} else {
    Write-Host "[2/2] Skipping extension install (--SkipInstall)" -ForegroundColor DarkGray
    Write-Host ""
}

# ─────────────────────────────────────────────
# Done
# ─────────────────────────────────────────────
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Setup complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$isRunning = Get-Process -Name $IdeName -ErrorAction SilentlyContinue
if ($isRunning) {
    Write-Host "  NOTE: $IdeName is currently running." -ForegroundColor Yellow
    Write-Host "  You must FULLY CLOSE and RELAUNCH it (via the patched shortcut)" -ForegroundColor Yellow
    Write-Host "  for CDP and the extension to take effect." -ForegroundColor Yellow
} else {
    Write-Host "  Launch $IdeName using the patched shortcut to get started." -ForegroundColor White
}
Write-Host ""
