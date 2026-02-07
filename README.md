# Auto Accept (Personal) for Antigravity

Keeps Antigravity conversations moving by automatically clicking approval buttons (file edits, terminal commands, retry/resume prompts) via Chrome DevTools Protocol (CDP).

---

![background mode](https://raw.githubusercontent.com/Coldaine/auto-accept-agent/main/media/background-mode.png)

---

## Why?

Antigravity's multi-agent workflow is powerful, but it stops every time the agent needs approval.

**That's dozens of interruptions per hour.**

Auto Accept eliminates the wait:
- **File edits** — Auto-applied
- **Terminal commands** — Auto-executed
- **Retry prompts** — Auto-confirmed
- **Stuck agents** — Auto-recovered

---

## Features

### Auto-accept in active tab
Clicks `Accept` / `Retry` / `Resume` (and similar) whenever they appear.

### Background mode (all tabs)
Cycles through open Antigravity conversations and clicks approvals across tabs.

### Dangerous command blocking
Blocks auto-accept when the nearby command text matches a banned pattern list (customizable).

### Adjustable polling speed
Tune how often the agent scans for buttons.

### Real-time Status Overlay
Visual indicators show conversation state:
- **Purple** — In progress, actively polling
- **Green** — Task completed

---

## Quick Start (Windows)

Run the setup script in PowerShell:

```powershell
.\scripts\setup.ps1
```

This will:
1. Find all Antigravity shortcuts (Desktop, Start Menu, Taskbar, OneDrive) and add the CDP flag
2. Build and install the .vsix extension into Antigravity
3. Tell you to restart Antigravity

After restarting, Auto Accept activates automatically. Check the status bar for `Personal Accept: ACTIVE`.

### Manual steps (if you prefer)

1. Add `--remote-debugging-port=9000` to your Antigravity shortcut's target
2. Install the .vsix: `antigravity --install-extension auto-accept-agent-*.vsix --force`
3. Restart Antigravity

---

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/setup.ps1` | **One-shot setup** — patches shortcuts + installs extension |
| `scripts/setup.ps1 -SkipShortcut` | Only install the extension (shortcut already patched) |
| `scripts/setup.ps1 -SkipInstall` | Only patch shortcuts (extension already installed) |
| `scripts/launch-antigravity.ps1` | Launch Antigravity with CDP flag (doesn't patch shortcuts) |

---

## Technical Architecture

Auto Accept operates via a **CDP (Chrome DevTools Protocol) Bridge**:

1. **Bridge Initiation**: The extension connects to the IDE's internal browser process on port `9000`.
2. **Logic Injection**: It injects a specialized automation script (`full_cdp_script.js`) directly into the IDE's UI layer.
3. **Safety Monitoring**: Before clicking any "Run" button, the script scrapes the terminal context and cross-references it against a `Banned Commands` list.
4. **Autonomous Cycling**: In Background Mode, the extension programmatically switches between tabs to ensure agents in different conversations remain active.

## Troubleshooting

### Connection Check
If the status bar says `OFF` or `PAUSED`, verify the CDP bridge:
1. Ensure Antigravity was launched with `--remote-debugging-port=9000` (use the patched shortcut).
2. Verify CDP is responding:
   ```powershell
   Invoke-WebRequest -Uri 'http://127.0.0.1:9000/json/list' | Select-Object -ExpandProperty Content
   ```

### Button Not Clicking
1. Open the **Output** panel in Antigravity.
2. Select **Personal Accept Logs**.
3. If you see `[BANNED]`, the command was blocked for safety.
4. If you see nothing, the IDE's UI might have updated; check the button selectors in `main_scripts/full_cdp_script.js`.

---

## License

MIT
