
const { CDPHandler } = require('./main_scripts/cdp-handler');

async function verify() {
    console.log('Searching for Antigravity targets on 9000...');
    const handler = new CDPHandler();
    
    // Internal method is _getPages
    const targets = await handler._getPages(9000);
    const workbenchTerminal = targets.find(t => t.url.includes('workbench.html'));
    
    if (!workbenchTerminal) {
        console.error('Could not find Antigravity workbench window! Found targets:', targets.map(t => t.title));
        process.exit(1);
    }

    console.log(`Found window: "${workbenchTerminal.title}". Connecting...`);
    const pageId = `9000:${workbenchTerminal.id}`;
    
    try {
        // Internal method is _connect
        await handler._connect(pageId, workbenchTerminal.webSocketDebuggerUrl);
        console.log('Connected. Injected script initialization...');
        
        // Internal method is _inject which reads file and evaluates
        // We'll use a dummy config
        const config = { 
            pollFrequency: 100, 
            backgroundMode: true,
            bannedCommands: []
        };
        
        await handler._inject(pageId, config);
        console.log('Script injected and started.');

        // Verify status
        console.log('Scanning for buttons...');
        const result = await handler._evaluate(pageId, `(() => {
            const buttons = Array.from(document.querySelectorAll('button, .monaco-button, .button'));
            const list = buttons.map(b => b.innerText || b.textContent).filter(t => t && t.length < 50);
            return JSON.stringify({
                buttonCount: buttons.length,
                labels: list.slice(0, 10),
                foundAccept: list.some(text => /accept|resume|confirm|allow|apply|try again/i.test(text))
            });
        })()`);

        const value = JSON.parse(result.result.value);
        console.log('--- SCAN RESULTS ---');
        console.log(JSON.stringify(value, null, 2));
        
        if (value.foundAccept) {
            console.log('✅ SUCCESS: Found a match for an Accept/Resume button!');
        } else {
            console.log('ℹ️ Connected, but no matching buttons are currently visible on screen (Normal if no prompt is active).');
        }

        process.exit(0);
    } catch (err) {
        console.error('Connection failed:', err);
        process.exit(1);
    }
}

verify();
