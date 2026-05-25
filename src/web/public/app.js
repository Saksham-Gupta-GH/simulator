let moduleRef = null;
let solver = null;

// Config
const N = 200;
const iter = 16;
const dt = 0.1;
let diff = 0.0;
let visc = 0.0000001;

// UI Elements
const canvas = document.getElementById('fluid-canvas');
const ctx = canvas.getContext('2d');
canvas.width = N;
canvas.height = N;

const imgData = ctx.createImageData(N, N);
const fpsCounter = document.getElementById('fps-counter');

// State
let isDrawing = false;
let activeTool = 'draw'; // 'draw', 'erase', 'circle', 'rect', 'tri'
let brushSize = 10;
let shapeRot = 0; // Degrees
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

function stampShape(cx, cy) {
    if (!solver) return;
    const isSolid = activeTool !== 'erase';
    
    const rad = (shapeRot * Math.PI) / 180;
    const cosA = Math.cos(-rad);
    const sinA = Math.sin(-rad);

    const half = brushSize;

    if (activeTool === 'draw' || activeTool === 'erase' || activeTool === 'circle') {
        for (let i = -half; i <= half; i++) {
            for (let j = -half; j <= half; j++) {
                if (i*i + j*j <= half*half) {
                    solver.setObstacle(cx + i, cy + j, isSolid);
                }
            }
        }
    } 
    else if (activeTool === 'rect') {
        // Iterate over a bounding box large enough to hold the rotated rect
        const box = Math.ceil(half * 1.5);
        for (let i = -box; i <= box; i++) {
            for (let j = -box; j <= box; j++) {
                // Rotate point back to local space
                const rx = i * cosA - j * sinA;
                const ry = i * sinA + j * cosA;
                
                if (rx >= -half && rx <= half && ry >= -half && ry <= half) {
                    solver.setObstacle(cx + i, cy + j, isSolid);
                }
            }
        }
    }
    else if (activeTool === 'tri') {
        const box = Math.ceil(half * 1.5);
        // Triangle vertices (pointing right originally)
        const p1 = {x: half, y: 0};
        const p2 = {x: -half, y: half};
        const p3 = {x: -half, y: -half};
        
        function sign(p1, p2, p3) {
            return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
        }

        for (let i = -box; i <= box; i++) {
            for (let j = -box; j <= box; j++) {
                const rx = i * cosA - j * sinA;
                const ry = i * sinA + j * cosA;
                
                const pt = {x: rx, y: ry};
                const d1 = sign(pt, p1, p2);
                const d2 = sign(pt, p2, p3);
                const d3 = sign(pt, p3, p1);
                
                const has_neg = (d1 < 0) || (d2 < 0) || (d3 < 0);
                const has_pos = (d1 > 0) || (d2 > 0) || (d3 > 0);
                
                if (!(has_neg && has_pos)) {
                    solver.setObstacle(cx + i, cy + j, isSolid);
                }
            }
        }
    }
}

function initControls() {
    const drawBtn = document.getElementById('btn-draw');
    const eraseBtn = document.getElementById('btn-erase');
    const clearBtn = document.getElementById('btn-clear');
    
    const shapeCircle = document.getElementById('btn-shape-circle');
    const shapeRect = document.getElementById('btn-shape-rect');
    const shapeTri = document.getElementById('btn-shape-tri');
    
    const toolBtns = [drawBtn, eraseBtn, shapeCircle, shapeRect, shapeTri];
    const setTool = (name, btn) => {
        activeTool = name;
        toolBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    };

    drawBtn.addEventListener('click', () => setTool('draw', drawBtn));
    eraseBtn.addEventListener('click', () => setTool('erase', eraseBtn));
    shapeCircle.addEventListener('click', () => setTool('circle', shapeCircle));
    shapeRect.addEventListener('click', () => setTool('rect', shapeRect));
    shapeTri.addEventListener('click', () => setTool('tri', shapeTri));

    clearBtn.addEventListener('click', () => {
        if (solver) solver.clearObstacles();
    });

    const brushSlider = document.getElementById('brush-size');
    const rotSlider = document.getElementById('shape-rot');
    
    brushSlider.addEventListener('input', (e) => {
        brushSize = parseInt(e.target.value);
        document.getElementById('brush-size-val').innerText = brushSize;
    });
    
    rotSlider.addEventListener('input', (e) => {
        shapeRot = parseInt(e.target.value);
        document.getElementById('shape-rot-val').innerText = shapeRot;
    });

    // Fluid Properties
    const propWind = document.getElementById('prop-wind');
    const propDens = document.getElementById('prop-dens');
    const propVisc = document.getElementById('prop-visc');

    propWind.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        document.getElementById('prop-wind-val').innerText = val;
        if(solver) solver.setWindSpeed(val);
    });

    propDens.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        document.getElementById('prop-dens-val').innerText = val;
        if(solver) solver.setWindDensity(val);
    });

    propVisc.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        document.getElementById('prop-visc-val').innerText = val.toFixed(4);
        if(solver) solver.setViscosity(val);
    });

    // Mouse Events
    canvas.addEventListener('mousedown', (e) => {
        const pos = getCanvasPos(e);
        stampShape(pos.x, pos.y);
        if (activeTool === 'draw' || activeTool === 'erase') {
            isDrawing = true;
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!isDrawing) return;
        const pos = getCanvasPos(e);
        stampShape(pos.x, pos.y);
    });

    window.addEventListener('mouseup', () => {
        isDrawing = false;
    });
    
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

    for (let i = 0; i < size; i++) {
        const d = densityArray[i];
        const isWall = obsArray[i];
        
        const pxIdx = i * 4;

        if (isWall) {
            data[pxIdx] = 255;
            data[pxIdx + 1] = 0;
            data[pxIdx + 2] = 255;
            data[pxIdx + 3] = 255;
        } else {
            const brightness = Math.min(255, d * 2.5); 
            
            data[pxIdx] = brightness * 0.1;       
            data[pxIdx + 1] = brightness * 0.8 + 5;  
            data[pxIdx + 2] = brightness * 1.0 + 15; 
            data[pxIdx + 3] = 255;                
        }
    }

    ctx.putImageData(imgData, 0, 0);

    const now = performance.now();
    const frameTime = now - lastTime;
    lastTime = now;
    fpsCounter.innerText = Math.round(1000 / frameTime);

    requestAnimationFrame(render);
}

createFluidSimModule({
    locateFile: (path) => path.endsWith('.wasm') ? 'wasm/' + path : path
}).then((module) => {
    moduleRef = module;
    
    solver = new module.FluidSolver(N, diff, visc, dt);
    
    // Default shape
    brushSize = 15;
    shapeRot = -20; // Angle it slightly upward to show aerodynamic lift!
    activeTool = 'rect';
    stampShape(70, 100);
    
    // Reset back to defaults for user
    brushSize = 10;
    shapeRot = 0;
    activeTool = 'draw';
    
    initControls();
    console.log("AeroFlow AI Loaded!");
    
    lastTime = performance.now();
    requestAnimationFrame(render);
});
