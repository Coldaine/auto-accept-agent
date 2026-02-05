# Auto Accept (Personal) for Antigravity

Keeps Antigravity conversations moving by automatically clicking approval buttons (file edits, terminal commands, retry/resume prompts) via Chrome DevTools Protocol (CDP).

---

![background mode](https://raw.githubusercontent.com/MunKhin/auto-accept-agent/master/media/background-mode.png)

---

## Why?

Antigravity's multi-agent workflow is powerful, but it stops every time the agent needs approval. 

**That's dozens of interruptions per hour.**

Auto Accept eliminates the wait:
- ✅ **File edits** — Auto-applied
- ✅ **Terminal commands** — Auto-executed
- ✅ **Retry prompts** — Auto-confirmed
- ✅ **Stuck agents** — Auto-recovered

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

### Works Everywhere
- ✅ Antigravity
- ✅ Cursor
- ✅ Multiple windows
- ✅ Minimized/unfocused

---

## Quick Start (Windows)

1. **Install** the extension
2. **Enable CDP** when prompted (copy the PowerShell script to clipboard)
3. **Run the script** in PowerShell
4. **Restart** Antigravity completely
5. **Done** — Auto Accept activates automatically

The extension runs silently. Check the status bar for `Auto Accept: ON`.

---

## Technical Architecture

Auto Accept operates via a **CDP (Chrome DevTools Protocol) Bridge**:

1. **Bridge Initiation**: The extension connects to the IDE's internal browser process on port `9000`.
2. **Logic Injection**: It injects a specialized automation script (`full_cdp_script.js`) directly into the IDE's UI layer.
3. **Safety Monitoring**: Before clicking any "Run" button, the script scrapes the terminal context and cross-references it against a `Banned Commands` list.
4. **Autonomous Cycling**: In Background Mode, the extension programmatically switches between tabs to ensure agents in different conversations remain active.

## Troubleshooting (Antigravity)

### Connection Check
If the status bar says `OFF` or `PAUSED`, verify the CDP bridge:
1. Ensure Antigravity was launched with `--remote-debugging-port=9000`.
2. Run the diagnostic script:
   ```powershell
   node verify_connection_live.js
   ```

### Button Not Clicking
1. Open the **Output** panel in Antigravity.
2. Select **Personal Accept Logs**.
3. If you see `[BANNED]`, the command was blocked for safety.
4. If you see nothing, the IDE's UI might have updated; check the `.bg-ide-button-background` selector in `main_scripts/auto_accept.js`.

---

## Quick Start (Windows)

- Antigravity or Cursor IDE
- Enable remote debugging port (one-time setup via provided scripts)

---

## License

MIT