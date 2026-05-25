const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    // We can open the local server (Vite is running on task-124, likely at http://localhost:5173)
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    
    // Let's click the canvas
    console.log("Wait for sim-canvas...");
    await page.waitForSelector('#sim-canvas');
    
    // Get bounding box
    const canvas = await page.$('#sim-canvas');
    const box = await canvas.boundingBox();
    console.log("Canvas box:", box);
    
    // Click in the middle
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    
    // Evaluate if obstacles changed
    const obstacleDrawn = await page.evaluate(() => {
        const ptr = sim.getObstaclePtr();
        const obs = new Uint8Array(moduleRef.HEAPU8.buffer, ptr, 150 * 100);
        let count = 0;
        for (let i = 0; i < obs.length; i++) {
            if (obs[i] === 1) count++;
        }
        return count;
    });
    
    console.log("Obstacles count:", obstacleDrawn);
    
    await browser.close();
})();
