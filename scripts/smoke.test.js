const { chromium } = require('playwright');
const { spawn } = require('child_process');

(async () => {
    console.log('Starting Vite server...');
    const server = spawn('npm', ['run', 'dev'], { stdio: 'pipe' });

    // Wait for the server to boot up
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('Launching browser...');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
        console.log('Navigating to simulator...');
        await page.goto('http://localhost:5173');

        // Wait for WASM to load and the canvas to be ready
        await page.waitForSelector('#fluid-canvas', { state: 'visible', timeout: 10000 });
        
        console.log('Drawing on the canvas...');
        const canvas = await page.$('#fluid-canvas');
        const box = await canvas.boundingBox();
        
        if (box) {
            // Simulate pointer events (drawing a stroke)
            await page.mouse.move(box.x + 100, box.y + 100);
            await page.mouse.down();
            await page.mouse.move(box.x + 200, box.y + 200, { steps: 10 });
            await page.mouse.up();
            
            console.log('Smoke test passed: Canvas interaction successful.');
        } else {
            throw new Error('Canvas bounding box not found.');
        }
    } catch (err) {
        console.error('Smoke test failed:', err);
        process.exit(1);
    } finally {
        console.log('Cleaning up...');
        await browser.close();
        server.kill();
        process.exit(0);
    }
})();
