const vscode = require('vscode');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { SetupPanel } = require('../setup-panel');

const CDP_PORT = 9000;
const CDP_FLAG = `--remote-debugging-port=${CDP_PORT}`;

/**
 * Robust cross-platform manager for IDE shortcuts and relaunching
 */
class Relauncher {
    constructor(context, logger = console.log) {
        this.context = context;
        this.platform = os.platform();
        this.logger = logger;
    }

    log(msg) {
        this.logger(`[Relauncher] ${msg}`);
    }

    /**
     * Get the human-readable name of the IDE
     */
    getIdeName() {
        return 'Antigravity';
    }

    /**
     * Main entry point: ensures CDP is enabled and relaunches if necessary
     */
    async ensureCDPAndRelaunch() {
        this.log('Checking if current process has CDP flag...');
        const hasFlag = await this.checkShortcutFlag();

        if (hasFlag) {
            this.log('CDP flag already present in current process.');
            return { success: true, relaunched: false };
        }

        this.log('CDP flag missing in current process. Showing platform-specific script...');
        const ideName = this.getIdeName();
        const { script, instructions } = await this.getPlatformScriptAndInstructions();
        
        if (!script) {
            vscode.window.showErrorMessage(
                `Personal Accept: Unsupported platform. Please add --remote-debugging-port=9000 to your ${ideName} shortcut manually, then restart.`,
                'View Help'
            ).then(selection => {
                if (selection === 'View Help') {
                    vscode.env.openExternal(vscode.Uri.parse('https://github.com/Coldaine/auto-accept-agent#quick-start-windows'));
                }
            });
            return { success: false, relaunched: false };
        }

        // Show the new Setup Panel webview instead of modal message
        if (this.context) {
            SetupPanel.createOrShow(this.context.extensionUri, script, this.platform, ideName);
        } else {
            // Fallback for cases where context is not available
            const message = `Personal Accept: CDP flag missing. To enable Background Mode, please run the script for ${ideName} on ${this.platform}.`;
            const copyButton = 'Copy Script to Clipboard';

            const selection = await vscode.window.showInformationMessage(
                message,
                { modal: true, detail: `${instructions}\n\nScript:\n${script}` },
                copyButton
            );

            if (selection === copyButton) {
                await vscode.env.clipboard.writeText(script);
                vscode.window.showInformationMessage('Script copied to clipboard! Please paste it into a terminal and run it, then close and restart your IDE.');
            }
        }

        return { success: true, relaunched: false };
    }

    /**
     * Platform-specific check if the current launch shortcut has the flag
     */
    async checkShortcutFlag() {
        // Optimization: checking the process arguments of the current instance
        // This is the most reliable way to know if WE were launched with it
        const args = process.argv.join(' ');
        return args.includes('--remote-debugging-port=9000');
    }

    /**
     * Get platform-specific script and instructions for enabling CDP
     */
    async getPlatformScriptAndInstructions() {
        const ideName = this.getIdeName();
        const platform = this.platform;
        
        if (platform === 'win32') {
            const script = `$WshShell = New-Object -ComObject WScript.Shell
$SearchPaths = @(
    [System.IO.Path]::Combine($env:USERPROFILE, "Desktop"),
    [System.IO.Path]::Combine($env:USERPROFILE, "OneDrive", "Desktop"),
    [System.IO.Path]::Combine($env:APPDATA, "Microsoft", "Windows", "Start Menu", "Programs"),
    [System.IO.Path]::Combine($env:APPDATA, "Microsoft", "Internet Explorer", "Quick Launch", "User Pinned", "TaskBar")
)

$AllShortcuts = @()
foreach ($SearchPath in $SearchPaths) {
    if (Test-Path $SearchPath) {
        $Found = Get-ChildItem "$SearchPath\\*.lnk" -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "*${ideName}*" }
        if ($Found) {
            $AllShortcuts += $Found
            Write-Host "Found shortcut(s) in: $SearchPath" -ForegroundColor Cyan
        }
    }
}

if ($AllShortcuts.Count -eq 0) {
    Write-Host "No ${ideName} shortcut found. Creating one on Desktop..." -ForegroundColor Yellow
    $DesktopPath = [System.IO.Path]::Combine($env:USERPROFILE, "Desktop")
    $ShortcutPath = "$DesktopPath\\${ideName}.lnk"
    $Shortcut = $WshShell.CreateShortcut($ShortcutPath)
    $Shortcut.TargetPath = "$env:LOCALAPPDATA\\Programs\\${ideName}\\${ideName}.exe"
    $Shortcut.Arguments = "--remote-debugging-port=9000 --disable-gpu-driver-bug-workarounds --ignore-gpu-blacklist"
    $Shortcut.Save()
    Write-Host "Created new shortcut: $ShortcutPath" -ForegroundColor Green
} else {
    foreach ($ShortcutFile in $AllShortcuts) {
        $Shortcut = $WshShell.CreateShortcut($ShortcutFile.FullName)
        $Args = $Shortcut.Arguments
        if ($Args -match "--remote-debugging-port=\\d+") {
            $Shortcut.Arguments = $Args -replace "--remote-debugging-port=\\d+", "--remote-debugging-port=9000"
        } else {
            $Shortcut.Arguments = "--remote-debugging-port=9000 " + $Args
        }
        $Shortcut.Save()
        Write-Host "Updated $($ShortcutFile.Name) to port 9000" -ForegroundColor Green
    }
}`;
            return {
                script,
                instructions: `1. Open PowerShell as Administrator\n2. Copy the script above and paste it into PowerShell\n3. Press Enter to run\n4. After the script completes, close and restart ${ideName} completely.`
            };
        } else if (platform === 'darwin') {
            const script = `open -n -a "${ideName}" --args --remote-debugging-port=9000 --disable-gpu-driver-bug-workarounds --ignore-gpu-blacklist`;
            return {
                script,
                instructions: `1. Open Terminal\n2. Copy the command above and paste it into Terminal\n3. Press Enter to run\n4. This will launch ${ideName} with the required flag. You can also add the flag to your Dock icon: Right-click ${ideName} in Dock > Options > Keep in Dock, then edit the application's Info.plist.`
            };
        } else if (platform === 'linux') {
            const script = `#!/bin/bash
# Detect desktop environment
DESKTOP=\${XDG_CURRENT_DESKTOP:-""}
IDE_NAME="${ideName}"
IDE_NAME_LOWER=\$(echo "$IDE_NAME" | tr '[:upper:]' '[:lower:]')

# Function to modify .desktop file
modify_desktop_file() {
    local desktop_file="\$1"
    local backup_file="\${desktop_file}.bak"
    
    # Create backup
    cp "\$desktop_file" "\$backup_file"
    
    # Check if flag already exists
    if grep -q "--remote-debugging-port=9000" "\$desktop_file"; then
        echo "Flag already present in \$desktop_file"
        return 0
    fi
    
    # Add flag to Exec line
    sed -i 's|^Exec=.*|& --remote-debugging-port=9000|' "\$desktop_file"
    
    # Also add flag to TryExec if present
    if grep -q "^TryExec=" "\$desktop_file"; then
        sed -i 's|^TryExec=.*|& --remote-debugging-port=9000|' "\$desktop_file"
    fi
    
    echo "Modified \$desktop_file"
    return 0
}

# Search for .desktop files in common locations
DESKTOP_DIRS=(
    "\$HOME/.local/share/applications"
    "/usr/share/applications"
    "/usr/local/share/applications"
)

for dir in "\${DESKTOP_DIRS[@]}"; do
    if [ -d "\$dir" ]; then
        for file in "\$dir"/*.desktop; do
            if [ -f "\$file" ]; then
                if grep -qi "\$IDE_NAME_LOWER" "\$file"; then
                    echo "Found: \$file"
                    modify_desktop_file "\$file"
                fi
            fi
        done
    fi
done

echo "Script completed. Please close and restart ${ideName}."`;
            return {
                script,
                instructions: `1. Open Terminal\n2. Copy the script above and paste it into Terminal\n3. Make it executable: chmod +x script.sh (if saved as file)\n4. Run the script with bash\n5. After the script completes, close and restart ${ideName} completely.`
            };
        } else {
            return {
                script: '',
                instructions: 'Unsupported platform. Please manually add --remote-debugging-port=9000 to your IDE shortcut.'
            };
        }
    }
}

module.exports = { Relauncher };
