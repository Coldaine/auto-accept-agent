# Auto Accept Agent

VS Code extension that auto-accepts AI suggestions in **Antigravity IDE only**. This is not a general-purpose or multi-IDE extension — it targets a single IDE (Antigravity, a VS Code fork) with known UI structure.

## Key Context for AI Reviewers

- **Antigravity-only**: All selectors, URL filters, and DOM assumptions are intentional for this specific IDE. Do not flag them as "fragile across IDEs" or "too broad" — they are correct for the target environment.
- **`workbench.html` filter**: The known main page URL for Antigravity. This is not an assumption — it is how VS Code forks work.
- **Selectors like `button[class*="primary"]`**: Scoped by `isAcceptButton()` text-pattern filtering. The combination is precise for Antigravity's UI.
- **`isPro: true` is hardcoded**: This is a personal fork. Pro-gating logic from the original project is bypassed.

## Architecture

```
extension.js                          ← VS Code extension entry point
├── main_scripts/cdp-handler.js       ← CDP connection, port scanning, script injection
├── main_scripts/full_cdp_script.js   ← Injected DOM script (runs in browser context)
├── main_scripts/relauncher.js        ← CDP setup detection and launch script generation
└── settings-panel.js                 ← WebView settings UI (lazy-loaded)
```

### How It Works

1. **Activation**: Extension activates on `onStartupFinished`, creates status bar items, restores state from globalState
2. **CDP Setup**: User must launch Antigravity with `--remote-debugging-port=9000`. Relauncher detects this and provides platform-specific scripts if missing
3. **Connection**: CDPHandler scans ports 8997–9003, finds pages via `/json/list`, filters for `workbench.html`, connects via WebSocket
4. **Injection**: `full_cdp_script.js` is injected via `Runtime.evaluate`. It exposes lifecycle functions (`__autoAcceptStart`, `__autoAcceptStop`, etc.)
5. **Polling**: Extension syncs config every 5 seconds. Injected script polls for accept buttons at configurable interval (200–3000ms, default 750ms)

### Foreground vs Background Mode

- **Foreground**: Clicks accept buttons in the active conversation tab only
- **Background**: Cycles through all conversation tabs, tracks per-tab completion via badge detection (Good/Bad badges), shows overlay with progress

### Key Injected Script Features (full_cdp_script.js)

- **Button clicking**: Multi-selector matching → `isAcceptButton()` text filtering → banned command check → click + verify removal
- **Banned commands**: Walks DOM to find command text near buttons, matches against regex/literal patterns (e.g., `rm -rf`, fork bombs)
- **Analytics**: Tracks clicks, file edits, terminal commands, blocked actions, away actions. Weekly ROI stats with auto-rollover
- **Overlay**: Background mode UI showing per-tab progress (purple=working, green=done)
- **Instance locking**: Heartbeat-based coordination prevents multiple extension instances from competing

## State Keys (globalState)

| Key | Purpose |
|-----|---------|
| `auto-accept-enabled-global` | Main on/off toggle |
| `auto-accept-frequency` | Poll interval ms |
| `auto-accept-background-mode` | Background mode toggle |
| `auto-accept-banned-commands` | Command block patterns |
| `auto-accept-roi-stats` | Weekly aggregate stats |

## Build & Package

```bash
npm run compile    # esbuild → dist/extension.js
npm run package    # npx vsce package → .vsix
```

The `.vscodeignore` excludes everything except dist/, main_scripts/, media/, settings-panel.js, and `node_modules/ws/` (the only runtime dependency).

## Branding

- **Display name**: "Personal Accept"
- **Publisher**: Coldaine
- **Icon**: media/icon.png (mouse cursor + sparkles)
- No references to original authors (MunKhin / Antigravity-AI) remain in the codebase
