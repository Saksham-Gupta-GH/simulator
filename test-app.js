const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('./src/web/index.html', 'utf8');
const dom = new JSDOM(html);
global.window = dom.window;
global.document = dom.window.document;
global.HTMLCanvasElement = dom.window.HTMLCanvasElement;
global.requestAnimationFrame = (cb) => setTimeout(cb, 16);

// mock canvas
HTMLCanvasElement.prototype.getContext = function() {
    return {
        fillRect: () => {},
        createImageData: () => ({ data: new Uint8Array(15000 * 4) }),
        putImageData: () => {},
        drawImage: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        stroke: () => {},
        strokeRect: () => {},
        fillText: () => {}
    };
};
HTMLCanvasElement.prototype.getBoundingClientRect = () => ({ width: 900, height: 600, left: 0, top: 0 });

const ModuleInit = require('./src/web/public/wasm/fluid_sim.js');
const appjsOrig = fs.readFileSync('./src/web/public/app.js', 'utf8');

// We just inject the Module logic directly into app.js scope to test it naturally
const testScript = `
    const ModuleInit = require('./src/web/public/wasm/fluid_sim.js');
    let createFluidSimModule = ModuleInit;
    
    ` + appjsOrig + `
    
    setTimeout(() => {
        if (!sim) {
            console.error("SIM IS STILL NULL");
        } else {
            console.log("Sim initialized correctly. Frame should have run.");
        }
    }, 1000);
`;

try {
    eval(testScript);
} catch(e) {
    console.error("CRASH:", e);
}
