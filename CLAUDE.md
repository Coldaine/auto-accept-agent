# Auto Accept Agent

VS Code extension that auto-accepts AI suggestions in **Antigravity IDE only**. This is not a general-purpose or multi-IDE extension — it targets a single IDE (Antigravity, a VS Code fork) with known UI structure.

## CRITICAL: Setup Required Before Extension Works

**The extension does NOTHING without CDP.** Antigravity must be launched with `--remote-debugging-port=9000` or the extension will sit idle showing OFF.

**First-time setup** (patches all shortcuts + installs extension):
```powershell
.\scripts\setup.ps1
```

**After setup**, every Antigravity launch via the patched shortcut will have CDP enabled automatically. If CDP stops working, re-run the setup script — it's idempotent.

**Quick verification** that CDP is active:
```powershell
Invoke-WebRequest -Uri 'http://127.0.0.1:9000/json/list' | Select-Object -ExpandProperty Content
```

If this returns an empty array or JSON, CDP is working. If it errors, Antigravity wasn't launched with the flag.

## Key Context for AI Reviewers

- **Antigravity-only**: All selectors and DOM assumptions are intentional for this specific IDE. There is no multi-IDE support — all Cursor/Code branching has been removed.
- **No page URL filtering**: CDP connects to ALL page/webview targets, not just `workbench.html`. This is critical because Antigravity's agent panel (where accept/run buttons live) is a cross-origin iframe that requires separate CDP targeting.
- **Broad button selectors**: `['button', '[class*="button"]']` combined with `isAcceptButton()` text filtering. The broad selectors are necessary to find buttons across different DOM contexts. Do not narrow them to specific class names — Antigravity's UI classes change between versions.
- **Pro-gating removed**: This is a personal fork. The `isPro` config field and all branching on it have been removed.

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
3. **Connection**: CDPHandler scans ports 8997–9003, finds all page/webview targets via `/json/list`, connects via WebSocket
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

## Known Pitfalls (Lessons from Fork)

These bugs were introduced during the fork from MunKhin/auto-accept-agent. They are documented here so future AI reviewers and maintainers do not re-introduce them.

1. **DO NOT filter CDP pages by URL.** The `_getPages()` method must connect to ALL `page`/`webview` targets. Antigravity's agent panel is a cross-origin iframe — its buttons are invisible from the main workbench page's DOM. CDP needs to inject into all available targets.

2. **DO NOT use narrow CSS selectors for buttons.** Antigravity's UI classes change between versions (e.g., `.bg-ide-button-background` no longer exists). Use broad selectors (`button`, `[class*="button"]`) and rely on `isAcceptButton()` text matching to identify accept/run/retry buttons.

3. **DO NOT add Cursor/Code IDE branching.** This is an Antigravity-only extension. The upstream supports multiple IDEs, but this fork removed all Cursor-specific code (`cursorLoop`, Cursor tab selectors, `anysphere` class matching). Do not re-add them.

4. **Rebuild the VSIX after changing `package.json`.** The publisher identity is baked into the VSIX manifest at build time. If you change the publisher in `package.json`, the old VSIX still contains the old publisher. Always run `npm run package` to rebuild.

## Branding

- **Display name**: "Personal Accept"
- **Publisher**: Coldaine
- **Icon**: media/icon.png (mouse cursor + sparkles)
- No references to original authors (MunKhin / Antigravity-AI) remain in the codebase
