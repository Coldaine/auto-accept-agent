const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_PORT = 9000;
const PORT_RANGE = 3; // 9000 +/- 3

class CDPHandler {
    constructor(logger = console.log) {
        this.logger = logger;
        this.connections = new Map(); // port:pageId -> {ws, injected}
        this.isEnabled = false;
        this.msgId = 1;
    }

    log(msg) {
        this.logger(`[CDP] ${msg}`);
    }

    /**
     * Check if any CDP port in the target range is active
     */
    async isCDPAvailable() {
        for (let port = BASE_PORT - PORT_RANGE; port <= BASE_PORT + PORT_RANGE; port++) {
            try {
                const pages = await this._getPages(port);
                if (pages.length > 0) return true;
            } catch (e) { }
        }
        return false;
    }

    /**
     * Start/maintain the CDP connection and injection loop
     */
    async start(config) {
        this.isEnabled = true;
        this.log(`Scanning ports ${BASE_PORT - PORT_RANGE} to ${BASE_PORT + PORT_RANGE}...`);

        for (let port = BASE_PORT - PORT_RANGE; port <= BASE_PORT + PORT_RANGE; port++) {
            try {
                const pages = await this._getPages(port);
                for (const page of pages) {
                    const id = `${port}:${page.id}`;
                    if (!this.connections.has(id)) {
                        await this._connect(id, page.webSocketDebuggerUrl);
                    }
                    await this._inject(id, config);
                }
            } catch (e) { }
        }
    }

    async stop() {
        this.isEnabled = false;
        for (const [id, conn] of this.connections) {
            try {
                await this._evaluate(id, 'if(window.__autoAcceptStop) window.__autoAcceptStop()');
                conn.ws.close();
            } catch (e) { }
        }
        this.connections.clear();
    }

    async _getPages(port) {
        return new Promise((resolve, reject) => {
            const req = http.get({ hostname: '127.0.0.1', port, path: '/json/list', timeout: 500 }, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try {
                        const pages = JSON.parse(body);
                        // Filter for workbench pages only (the main IDE window)
                        const filtered = pages.filter(p =>
                            p.webSocketDebuggerUrl &&
                            (p.type === 'page' || p.type === 'webview') &&
                            p.url && p.url.includes('workbench.html')
                        );
                        if (pages.length !== filtered.length) {
                            this.log(`Port ${port}: filtered ${pages.length - filtered.length} non-workbench pages`);
                        }
                        resolve(filtered);
                    } catch (e) { resolve([]); }
                });
            });
            req.on('error', () => resolve([]));
            req.on('timeout', () => { req.destroy(); resolve([]); });
        });
    }

    async _connect(id, url) {
        return new Promise((resolve) => {
            const ws = new WebSocket(url);

            // Connection timeout - don't hang forever
            const connectionTimeout = setTimeout(() => {
                ws.terminate();
                this.log(`Connection timeout for ${id}`);
                resolve(false);
            }, 5000);

            ws.on('open', () => {
                clearTimeout(connectionTimeout);
                this.connections.set(id, { ws, injected: false });
                this.log(`Connected to page ${id}`);
                resolve(true);
            });
            ws.on('error', (err) => {
                clearTimeout(connectionTimeout);
                this.log(`Connection error for ${id}: ${err.message || 'Unknown error'}`);
                resolve(false);
            });
            ws.on('close', () => {
                this.connections.delete(id);
                this.log(`Disconnected from page ${id}`);
            });
        });
    }

    async _inject(id, config) {
        const conn = this.connections.get(id);
        if (!conn) return;

        try {
            if (!conn.injected) {
                const scriptPath = path.join(__dirname, '..', 'main_scripts', 'full_cdp_script.js');
                const script = fs.readFileSync(scriptPath, 'utf8');
                await this._evaluate(id, script);
                conn.injected = true;
                this.log(`Script injected into ${id}`);
            }

            await this._evaluate(id, `if(window.__autoAcceptStart) window.__autoAcceptStart(${JSON.stringify(config)})`);
        } catch (e) {
            this.log(`Injection failed for ${id}: ${e.message}`);
        }
    }

    async _evaluate(id, expression) {
        const conn = this.connections.get(id);
        if (!conn || conn.ws.readyState !== WebSocket.OPEN) return;

        return new Promise((resolve, reject) => {
            const currentId = this.msgId++;
            let onMessage;

            // Cleanup function to prevent memory leaks
            const cleanup = () => {
                clearTimeout(timeout);
                if (onMessage) conn.ws.off('message', onMessage);
            };

            const timeout = setTimeout(() => {
                cleanup();
                reject(new Error('CDP Timeout'));
            }, 2000);

            onMessage = (data) => {
                try {
                    const msg = JSON.parse(data.toString());
                    if (msg.id === currentId) {
                        cleanup();
                        // Check for CDP-level errors
                        if (msg.result?.exceptionDetails) {
                            this.log(`Evaluation error: ${msg.result.exceptionDetails.text || 'Unknown'}`);
                        }
                        resolve(msg.result);
                    }
                } catch (e) {
                    // Ignore malformed messages not intended for us
                }
            };

            conn.ws.on('message', onMessage);
            conn.ws.send(JSON.stringify({
                id: currentId,
                method: 'Runtime.evaluate',
                params: { expression, userGesture: true, awaitPromise: true }
            }));
        });
    }

    async _evaluateJson(id, expression, fallback) {
        try {
            const wrapped = `(() => {\n` +
                `  try {\n` +
                `    const v = (${expression});\n` +
                `    return JSON.stringify(v);\n` +
                `  } catch (e) {\n` +
                `    return '';\n` +
                `  }\n` +
                `})()`;
            const res = await this._evaluate(id, wrapped);
            const value = res?.result?.value;
            if (!value || typeof value !== 'string') return fallback;
            return JSON.parse(value);
        } catch (e) {
            return fallback;
        }
    }

    async getStats() {
        const stats = { clicks: 0, blocked: 0, fileEdits: 0, terminalCommands: 0 };
        for (const [id] of this.connections) {
            try {
                const s = await this._evaluateJson(id, 'window.__autoAcceptGetStats ? window.__autoAcceptGetStats() : {}', {});
                stats.clicks += s.clicks || 0;
                stats.blocked += s.blocked || 0;
                stats.fileEdits += s.fileEdits || 0;
                stats.terminalCommands += s.terminalCommands || 0;
            } catch (e) { }
        }
        return stats;
    }

    async getSessionSummary() {
        // Aggregate summaries across connected pages
        const summary = { clicks: 0, blocked: 0, fileEdits: 0, terminalCommands: 0 };
        for (const [id] of this.connections) {
            const s = await this._evaluateJson(
                id,
                'window.__autoAcceptGetSessionSummary ? window.__autoAcceptGetSessionSummary() : (window.__autoAcceptGetStats ? window.__autoAcceptGetStats() : {})',
                {}
            );
            summary.clicks += s.clicks || 0;
            summary.blocked += s.blocked || 0;
            summary.fileEdits += s.fileEdits || 0;
            summary.terminalCommands += s.terminalCommands || 0;
        }
        return summary;
    }
    async setFocusState(isFocused) {
        for (const [id] of this.connections) {
            try {
                await this._evaluate(id, `if(window.__autoAcceptSetFocusState) window.__autoAcceptSetFocusState(${isFocused})`);
            } catch (e) { }
        }
    }

    getConnectionCount() { return this.connections.size; }

    async getAwayActions() {
        let total = 0;
        for (const [id] of this.connections) {
            const v = await this._evaluateJson(
                id,
                'window.__autoAcceptGetAwayActions ? window.__autoAcceptGetAwayActions() : 0',
                0
            );
            total += Number(v) || 0;
        }
        return total;
    }

    async resetStats() {
        // Collect and reset stats inside each page (weekly aggregation in extension)
        const aggregate = { clicks: 0, blocked: 0 };
        for (const [id] of this.connections) {
            const s = await this._evaluateJson(
                id,
                'window.__autoAcceptResetStats ? window.__autoAcceptResetStats() : { clicks: 0, blocked: 0 }',
                { clicks: 0, blocked: 0 }
            );
            aggregate.clicks += s.clicks || 0;
            aggregate.blocked += s.blocked || 0;
        }
        return aggregate;
    }

    async hideBackgroundOverlay() {
        for (const [id] of this.connections) {
            try {
                await this._evaluate(id, `(() => { const el = document.getElementById('__autoAcceptBgOverlay'); if (el) el.remove(); })()`);
            } catch (e) { }
        }
    }
}

module.exports = { CDPHandler };
