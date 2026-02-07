const vscode = require('vscode');

class SettingsPanel {
    static currentPanel = undefined;
    static viewType = 'autoAcceptSettings';

    static createOrShow(extensionUri, context) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (SettingsPanel.currentPanel) {
            SettingsPanel.currentPanel.panel.reveal(column);
            SettingsPanel.currentPanel.refresh();
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            SettingsPanel.viewType,
            'Personal Accept Settings',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        SettingsPanel.currentPanel = new SettingsPanel(panel, extensionUri, context);
    }

    constructor(panel, extensionUri, context) {
        this.panel = panel;
        this.extensionUri = extensionUri;
        this.context = context;
        this.disposables = [];

        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'setFrequency': {
                        const value = Number(message.value);
                        if (Number.isFinite(value)) {
                            await this.context.globalState.update('auto-accept-frequency', value);
                            vscode.commands.executeCommand('auto-accept.updateFrequency', value);
                        }
                        break;
                    }
                    case 'getROIStats': {
                        this.sendROIStats();
                        break;
                    }
                    case 'updateBannedCommands': {
                        const commands = Array.isArray(message.commands) ? message.commands : [];
                        await this.context.globalState.update('auto-accept-banned-commands', commands);
                        vscode.commands.executeCommand('auto-accept.updateBannedCommands', commands);
                        this.panel.webview.postMessage({ command: 'savedOk' });
                        break;
                    }
                    case 'getBannedCommands': {
                        this.sendBannedCommands();
                        break;
                    }
                }
            },
            null,
            this.disposables
        );

        this.refresh();
    }

    refresh() {
        this.panel.webview.html = this.getHtmlContent();
        setTimeout(() => {
            this.sendInitialState();
            this.sendROIStats();
            this.sendBannedCommands();
        }, 50);
    }

    async sendROIStats() {
        try {
            const roiStats = await vscode.commands.executeCommand('auto-accept.getROIStats');
            this.panel.webview.postMessage({
                command: 'updateROIStats',
                roiStats
            });
        } catch {
            // Ignore if unavailable
        }
    }

    sendBannedCommands() {
        const defaultBannedCommands = [
            'rm -rf /',
            'rm -rf ~',
            'rm -rf *',
            'format c:',
            'del /f /s /q',
            'rmdir /s /q',
            ':(){:|:&};:',
            'dd if=',
            'mkfs.',
            '> /dev/sda',
            'chmod -R 777 /'
        ];
        const bannedCommands = this.context.globalState.get('auto-accept-banned-commands', defaultBannedCommands);
        this.panel.webview.postMessage({ command: 'updateBannedCommands', bannedCommands });
    }

    sendInitialState() {
        const frequency = this.context.globalState.get('auto-accept-frequency', 750);
        this.panel.webview.postMessage({ command: 'updateFrequency', frequency });
    }

    getHtmlContent() {
        const css = `
            :root {
                --bg: #0b0b10;
                --card: #13131a;
                --border: rgba(255,255,255,0.08);
                --fg: rgba(255,255,255,0.92);
                --dim: rgba(255,255,255,0.60);
                --accent: #8b5cf6;
                --good: #22c55e;
                --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
                --font: "Segoe UI", system-ui, -apple-system, sans-serif;
            }
            body { margin: 0; padding: 24px; font-family: var(--font); background: var(--bg); color: var(--fg); }
            h1 { margin: 0 0 6px 0; font-size: 22px; }
            .sub { margin: 0 0 18px 0; color: var(--dim); font-size: 13px; }
            .grid { display: grid; grid-template-columns: 1fr; gap: 14px; max-width: 760px; }
            .card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 16px; }
            .row { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
            .label { font-size: 12px; color: var(--dim); letter-spacing: 0.4px; text-transform: uppercase; }
            .val { font-variant-numeric: tabular-nums; color: var(--accent); font-weight: 700; }
            input[type="range"] { width: 100%; accent-color: var(--accent); }
            textarea { width: 100%; min-height: 140px; background: rgba(0,0,0,0.35); border: 1px solid var(--border); border-radius: 8px; padding: 10px; color: var(--fg); font-family: var(--mono); font-size: 12px; outline: none; resize: vertical; }
            textarea:focus { border-color: rgba(139, 92, 246, 0.6); }
            .btnRow { display: flex; gap: 10px; margin-top: 10px; }
            button { cursor: pointer; border-radius: 8px; padding: 10px 12px; border: 1px solid var(--border); background: rgba(255,255,255,0.04); color: var(--fg); font-weight: 600; }
            button.primary { background: rgba(139, 92, 246, 0.15); border-color: rgba(139, 92, 246, 0.35); }
            .ok { color: var(--good); font-size: 12px; height: 16px; margin-top: 8px; }
            .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
            .stat { background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.04); border-radius: 10px; padding: 10px; }
            .stat .n { font-size: 20px; font-weight: 800; }
            .stat .k { font-size: 11px; color: var(--dim); text-transform: uppercase; letter-spacing: 0.4px; margin-top: 4px; }
            @media (max-width: 720px) { .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        `;

        return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>${css}</style>
</head>
<body>
  <h1>Personal Accept Settings</h1>
  <p class="sub">Local-only settings. No accounts, no licensing, no external links.</p>

  <div class="grid">
    <div class="card">
      <div class="row">
        <div class="label">Polling Speed</div>
        <div class="val" id="freqVal">...</div>
      </div>
      <div style="margin-top: 10px;">
        <input id="freq" type="range" min="200" max="3000" step="50" value="750" />
      </div>
      <div style="margin-top: 8px; color: var(--dim); font-size: 12px;">
        Lower = faster auto-accept, higher = less CPU.
      </div>
    </div>

    <div class="card">
      <div class="row" style="margin-bottom: 10px;">
        <div class="label">This Week</div>
        <div style="color: var(--dim); font-size: 12px;">(resets Sunday)</div>
      </div>
      <div class="stats">
        <div class="stat"><div class="n" id="roiClicks">0</div><div class="k">Clicks</div></div>
        <div class="stat"><div class="n" id="roiTime">0m</div><div class="k">Time Saved</div></div>
        <div class="stat"><div class="n" id="roiSessions">0</div><div class="k">Sessions</div></div>
        <div class="stat"><div class="n" id="roiBlocked">0</div><div class="k">Blocked</div></div>
      </div>
    </div>

    <div class="card">
      <div class="row">
        <div class="label">Banned Commands</div>
        <div style="color: var(--dim); font-size: 12px;">one pattern per line</div>
      </div>
      <div style="margin-top: 10px;">
        <textarea id="banned" spellcheck="false"></textarea>
      </div>
      <div class="btnRow">
        <button class="primary" id="save">Save</button>
        <button id="reset">Reset Defaults</button>
      </div>
      <div class="ok" id="status"></div>
    </div>
  </div>

<script>
  const vscode = acquireVsCodeApi();
  const freq = document.getElementById('freq');
  const freqVal = document.getElementById('freqVal');
  const banned = document.getElementById('banned');
  const save = document.getElementById('save');
  const reset = document.getElementById('reset');
  const status = document.getElementById('status');

  const defaultBannedCommands = ["rm -rf /","rm -rf ~","rm -rf *","format c:","del /f /s /q","rmdir /s /q",":(){:|:&};:","dd if=","mkfs.","> /dev/sda","chmod -R 777 /"];

  function renderFreq(ms) {
    const s = (ms / 1000).toFixed(2);
    freqVal.textContent = s + 's (' + ms + 'ms)';
  }

  freq.addEventListener('input', () => {
    const ms = Number(freq.value);
    renderFreq(ms);
    vscode.postMessage({ command: 'setFrequency', value: ms });
  });

  save.addEventListener('click', () => {
    const lines = banned.value.split('\n').map(l => l.trim()).filter(Boolean);
    vscode.postMessage({ command: 'updateBannedCommands', commands: lines });
  });

  reset.addEventListener('click', () => {
    banned.value = defaultBannedCommands.join('\n');
    vscode.postMessage({ command: 'updateBannedCommands', commands: defaultBannedCommands });
  });

  window.addEventListener('message', (e) => {
    const msg = e.data;
    if (!msg || !msg.command) return;

    if (msg.command === 'updateFrequency') {
      const ms = Number(msg.frequency || 750);
      freq.value = String(ms);
      renderFreq(ms);
    }

    if (msg.command === 'updateROIStats') {
      const roi = msg.roiStats || {};
      document.getElementById('roiClicks').textContent = roi.clicksThisWeek || 0;
      document.getElementById('roiSessions').textContent = roi.sessionsThisWeek || 0;
      document.getElementById('roiBlocked').textContent = roi.blockedThisWeek || 0;
      document.getElementById('roiTime').textContent = roi.timeSavedFormatted || '0m';
    }

    if (msg.command === 'updateBannedCommands') {
      const list = Array.isArray(msg.bannedCommands) ? msg.bannedCommands : defaultBannedCommands;
      banned.value = list.join('\n');
    }

    if (msg.command === 'savedOk') {
      status.textContent = 'Saved';
      setTimeout(() => status.textContent = '', 1800);
    }
  });

  // Initial load
  vscode.postMessage({ command: 'getROIStats' });
  vscode.postMessage({ command: 'getBannedCommands' });
</script>
</body>
</html>`;
    }

    dispose() {
        SettingsPanel.currentPanel = undefined;
        this.panel.dispose();
        while (this.disposables.length) {
            const d = this.disposables.pop();
            if (d) d.dispose();
        }
    }
}

module.exports = { SettingsPanel };
