let moduleRef = null;
let solver = null;

// Config
const N = 200;
const iter = 16;
const dt = 0.1;
let diff = 0.0;
let visc = 0.0000001;
let globalDensity = 100.0;

// UI Elements
const canvas = document.getElementById('fluid-canvas');
const ctx = canvas.getContext('2d');
canvas.width = N;
canvas.height = N;

const imgData = ctx.createImageData(N, N);
const fpsCounter = document.getElementById('fps-counter');

// State
let isDrawing = false;
let activeTool = 'draw'; // 'draw', 'erase', 'circle', 'rect', 'tri', 'src-point', 'src-line'
let brushSize = 10;
let shapeRot = 0; // Degrees
let lastTime = performance.now();
let lastMousePos = null;

// Emitter Settings
let srcDir = 0; // Degrees
let srcSpeed = 50;
let sources = [];

function getCanvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: Math.floor((e.clientX - rect.left) * scaleX),
        y: Math.floor((e.clientY - rect.top) * scaleY)
    };
}

// Seamless Brush Interpolation (Lerp)
function drawStroke(x0, y0, x1, y1) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.max(1, Math.floor(distance));
    
    for (let i = 0; i <= steps; i++) {
        const t = steps === 0 ? 0 : i / steps;
        const x = Math.round(x0 + dx * t);
        const y = Math.round(y0 + dy * t);
        stampShape(x, y);
    }
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
        const box = Math.ceil(half * 1.5);
        for (let i = -box; i <= box; i++) {
            for (let j = -box; j <= box; j++) {
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

function placeSource(cx, cy) {
    if (activeTool === 'src-point') {
        sources.push({
            type: 'point',
            x: cx,
            y: cy,
            dir: srcDir,
            speed: srcSpeed
        });
    } else if (activeTool === 'src-line') {
        sources.push({
            type: 'line',
            x: cx,
            y: cy,
            length: brushSize * 2,
            angle: shapeRot, // Orientation of the line
            dir: srcDir,     // Direction the fluid is blowing
            speed: srcSpeed
        });
    }
}

function applySources() {
    if (!solver) return;
    
    for (const src of sources) {
        const radDir = (src.dir * Math.PI) / 180;
        const vx = Math.cos(radDir) * src.speed;
        const vy = Math.sin(radDir) * src.speed;
        
        if (src.type === 'point') {
            solver.addDensity(src.x, src.y, globalDensity);
            solver.addVelocity(src.x, src.y, vx, vy);
        } else if (src.type === 'line') {
            const radAngle = (src.angle * Math.PI) / 180;
            const cosA = Math.cos(radAngle);
            const sinA = Math.sin(radAngle);
            
            // Iterate along the line
            const half = src.length / 2;
            for (let t = -half; t <= half; t++) {
                const px = Math.round(src.x + t * cosA);
                const py = Math.round(src.y + t * sinA);
                solver.addDensity(px, py, globalDensity);
                solver.addVelocity(px, py, vx, vy);
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
    
    const srcPoint = document.getElementById('btn-src-point');
    const srcLine = document.getElementById('btn-src-line');
    const clearSrc = document.getElementById('btn-clear-src');
    
    const toolBtns = [drawBtn, eraseBtn, shapeCircle, shapeRect, shapeTri, srcPoint, srcLine];
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
    srcPoint.addEventListener('click', () => setTool('src-point', srcPoint));
    srcLine.addEventListener('click', () => setTool('src-line', srcLine));

    clearBtn.addEventListener('click', () => {
        if (solver) solver.clearObstacles();
    });
    
    clearSrc.addEventListener('click', () => {
        sources = [];
    });

    // Sliders
    document.getElementById('brush-size').addEventListener('input', (e) => {
        brushSize = parseInt(e.target.value);
        document.getElementById('brush-size-val').innerText = brushSize;
    });
    document.getElementById('shape-rot').addEventListener('input', (e) => {
        shapeRot = parseInt(e.target.value);
        document.getElementById('shape-rot-val').innerText = shapeRot;
    });
    document.getElementById('src-dir').addEventListener('input', (e) => {
        srcDir = parseInt(e.target.value);
        document.getElementById('src-dir-val').innerText = srcDir;
    });
    document.getElementById('src-speed').addEventListener('input', (e) => {
        srcSpeed = parseInt(e.target.value);
        document.getElementById('src-speed-val').innerText = srcSpeed;
    });

    document.getElementById('prop-dens').addEventListener('input', (e) => {
        globalDensity = parseFloat(e.target.value);
        document.getElementById('prop-dens-val').innerText = globalDensity;
    });
    document.getElementById('prop-visc').addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        document.getElementById('prop-visc-val').innerText = val.toFixed(4);
        if(solver) solver.setViscosity(val);
    });

    // Mouse Events
    canvas.addEventListener('mousedown', (e) => {
        const pos = getCanvasPos(e);
        lastMousePos = pos;
        
        if (activeTool.startsWith('src-')) {
            placeSource(pos.x, pos.y);
        } else {
            isDrawing = true;
            stampShape(pos.x, pos.y);
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!isDrawing) return;
        const pos = getCanvasPos(e);
        if (activeTool === 'draw' || activeTool === 'erase') {
            drawStroke(lastMousePos.x, lastMousePos.y, pos.x, pos.y);
        } else {
            // Only stamp once per click for perfect shapes, or lerp?
            // Usually, you don't drag perfect shapes, but if they do, just stamp.
            stampShape(pos.x, pos.y);
        }
        lastMousePos = pos;
    });

    window.addEventListener('mouseup', () => {
        isDrawing = false;
        lastMousePos = null;
    });
    
    canvas.addEventListener('contextmenu', e => e.preventDefault());
}

function render() {
    if (!solver || !moduleRef) return;

    applySources();
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
    
    // Set an initial Wind Tunnel Source manually to replace the old C++ one
    brushSize = 60; // Make it a large line
    shapeRot = 90; // Vertical line
    srcDir = 0; // Blowing right
    srcSpeed = 50;
    activeTool = 'src-line';
    placeSource(2, N/2);
    
    // Add default aerodynamic obstacle
    brushSize = 15;
    shapeRot = -20;
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
