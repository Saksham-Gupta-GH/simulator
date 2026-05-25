let moduleRef = null;
let solver = null;

// Config
const N = 200;
const iter = 16;
const dt = 0.1;
const diff = 0.0;
const visc = 0.0000001;

// UI Elements
const canvas = document.getElementById('fluid-canvas');
const ctx = canvas.getContext('2d');
// Canvas CSS size is handled by Flexbox, internal resolution is N x N
canvas.width = N;
canvas.height = N;

const imgData = ctx.createImageData(N, N);
const fpsCounter = document.getElementById('fps-counter');

// State
let isDrawing = false;
let activeTool = 'draw'; // 'draw' or 'erase'
let brushSize = 10;
let lastTime = performance.now();

function getCanvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: Math.floor((e.clientX - rect.left) * scaleX),
        y: Math.floor((e.clientY - rect.top) * scaleY)
    };
}

function applyBrush(x, y) {
    if (!solver) return;
    const isSolid = activeTool === 'draw';
    // Draw a circle
    for (let i = -brushSize; i <= brushSize; i++) {
        for (let j = -brushSize; j <= brushSize; j++) {
            if (i*i + j*j <= brushSize*brushSize) {
                solver.setObstacle(x + i, y + j, isSolid);
            }
        }
    }
}

function initControls() {
    const drawBtn = document.getElementById('btn-draw');
    const eraseBtn = document.getElementById('btn-erase');
    const clearBtn = document.getElementById('btn-clear');
    const brushSlider = document.getElementById('brush-size');
    const brushVal = document.getElementById('brush-size-val');

    drawBtn.addEventListener('click', () => {
        activeTool = 'draw';
        drawBtn.classList.add('active');
        eraseBtn.classList.remove('active');
    });

    eraseBtn.addEventListener('click', () => {
        activeTool = 'erase';
        eraseBtn.classList.add('active');
        drawBtn.classList.remove('active');
    });

    clearBtn.addEventListener('click', () => {
        if (solver) solver.clearObstacles();
    });

    brushSlider.addEventListener('input', (e) => {
        brushSize = parseInt(e.target.value);
        brushVal.innerText = brushSize;
    });

    // Mouse Events
    canvas.addEventListener('mousedown', (e) => {
        isDrawing = true;
        const pos = getCanvasPos(e);
        applyBrush(pos.x, pos.y);
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!isDrawing) return;
        const pos = getCanvasPos(e);
        applyBrush(pos.x, pos.y);
    });

    window.addEventListener('mouseup', () => {
        isDrawing = false;
    });
    
    // Prevent context menu
    canvas.addEventListener('contextmenu', e => e.preventDefault());
}

function render() {
    if (!solver || !moduleRef) return;

    solver.step();

    const HEAPF32 = moduleRef.HEAPF32;
    const HEAPU8 = moduleRef.HEAPU8;

    const densityPtr = solver.getDensityPtr();
    const obsPtr = solver.getObstaclesPtr();
    const size = solver.getSize();

    const densityArray = new Float32Array(HEAPF32.buffer, densityPtr, size);
    const obsArray = new Uint8Array(HEAPU8.buffer, obsPtr, size);

    const data = imgData.data;

    // Render loop
    for (let i = 0; i < size; i++) {
        const d = densityArray[i];
        const isWall = obsArray[i];
        
        const pxIdx = i * 4;

        if (isWall) {
            // Neon pink wall
            data[pxIdx] = 255;
            data[pxIdx + 1] = 0;
            data[pxIdx + 2] = 255;
            data[pxIdx + 3] = 255;
        } else {
            // Cyan smoke intensity
            // Map density to brightness
            const brightness = Math.min(255, d * 2.5); // Boost visual intensity
            
            // Render against a very dark blue background (0, 5, 15)
            data[pxIdx] = brightness * 0.1;       // R
            data[pxIdx + 1] = brightness * 0.8 + 5;  // G
            data[pxIdx + 2] = brightness * 1.0 + 15; // B
            data[pxIdx + 3] = 255;                // A
        }
    }

    ctx.putImageData(imgData, 0, 0);

    // Calculate FPS
    const now = performance.now();
    const frameTime = now - lastTime;
    lastTime = now;
    fpsCounter.innerText = Math.round(1000 / frameTime);

    requestAnimationFrame(render);
}

// Load WebAssembly
createFluidSimModule({
    locateFile: (path) => path.endsWith('.wasm') ? 'wasm/' + path : path
}).then((module) => {
    moduleRef = module;
    
    solver = new module.FluidSolver(N, diff, visc, dt);
    
    // Draw an initial aerodynamic teardrop shape
    solver.setObstacle(80, 100, true);
    for(let i=-20; i<20; i++) {
        for(let j=-10; j<10; j++) {
            if (i*i/400 + j*j/100 <= 1) {
                solver.setObstacle(80 + i, 100 + j, true);
            }
        }
    }
    
    initControls();
    console.log("AeroFlow AI Loaded!");
    
    lastTime = performance.now();
    requestAnimationFrame(render);
});
