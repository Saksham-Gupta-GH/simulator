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
const srcCountEl = document.getElementById('src-count');
const emittersListEl = document.getElementById('emitters-list');

// State
let isDrawing = false;
let activeTool = 'draw'; 
let brushSize = 10;
let shapeRot = 0; // Degrees
let lastTime = performance.now();
let lastMousePos = null;

// Sources State
let sources = [];
let sourceIdCounter = 0;

function getCanvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: Math.floor((e.clientX - rect.left) * scaleX),
        y: Math.floor((e.clientY - rect.top) * scaleY)
    };
}

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

// ----------------------------------------------------
// UI Logic for Emitter Cards
// ----------------------------------------------------
function placeSource(cx, cy) {
    if (activeTool === 'src-point') {
        sources.push({
            id: sourceIdCounter++,
            type: 'point',
            x: cx,
            y: cy,
            dir: shapeRot, // initial direction based on UI rot
            speed: 50
        });
    } else if (activeTool === 'src-line') {
        sources.push({
            id: sourceIdCounter++,
            type: 'line',
            x: cx,
            y: cy,
            length: brushSize * 4,
            angle: shapeRot, // orientation of the line itself
            dir: shapeRot - 90, // default flow direction perpendicular to line
            speed: 50
        });
    }
    renderEmittersUI();
}

function renderEmittersUI() {
    srcCountEl.innerText = sources.length;
    emittersListEl.innerHTML = '';

    sources.forEach((src) => {
        const card = document.createElement('div');
        card.className = 'emitter-card';

        const header = document.createElement('div');
        header.className = 'emitter-header';
        
        const title = document.createElement('div');
        title.className = 'emitter-title';
        title.innerHTML = src.type === 'point' 
            ? '<i class="fa-solid fa-location-dot" style="color:#1a73e8;"></i> Point Source'
            : '<i class="fa-solid fa-grip-lines-vertical" style="color:#1a73e8;"></i> Line Source';

        const delBtn = document.createElement('button');
        delBtn.className = 'emitter-delete';
        delBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        delBtn.onclick = () => {
            sources = sources.filter(s => s.id !== src.id);
            renderEmittersUI();
        };

        header.appendChild(title);
        header.appendChild(delBtn);
        card.appendChild(header);

        // Speed Slider
        const speedGroup = document.createElement('div');
        speedGroup.className = 'slider-group';
        speedGroup.style.marginBottom = '8px';
        speedGroup.innerHTML = `
            <label>Speed <span><span id="speed-val-${src.id}">${src.speed}</span></span></label>
            <input type="range" min="0" max="200" value="${src.speed}">
        `;
        const speedSlider = speedGroup.querySelector('input');
        speedSlider.addEventListener('input', (e) => {
            src.speed = parseInt(e.target.value);
            speedGroup.querySelector(`#speed-val-${src.id}`).innerText = src.speed;
        });
        card.appendChild(speedGroup);

        // Direction Slider
        const dirGroup = document.createElement('div');
        dirGroup.className = 'slider-group';
        dirGroup.style.marginBottom = '8px';
        dirGroup.innerHTML = `
            <label>Flow Direction <span><span id="dir-val-${src.id}">${src.dir}</span>°</span></label>
            <input type="range" min="-180" max="180" value="${src.dir}">
        `;
        const dirSlider = dirGroup.querySelector('input');
        dirSlider.addEventListener('input', (e) => {
            src.dir = parseInt(e.target.value);
            dirGroup.querySelector(`#dir-val-${src.id}`).innerText = src.dir;
        });
        card.appendChild(dirGroup);

        // Length Slider (Line Only)
        if (src.type === 'line') {
            const lenGroup = document.createElement('div');
            lenGroup.className = 'slider-group';
            lenGroup.style.marginBottom = '0';
            lenGroup.innerHTML = `
                <label>Line Length <span><span id="len-val-${src.id}">${src.length}</span>px</span></label>
                <input type="range" min="10" max="300" value="${src.length}">
            `;
            const lenSlider = lenGroup.querySelector('input');
            lenSlider.addEventListener('input', (e) => {
                src.length = parseInt(e.target.value);
                lenGroup.querySelector(`#len-val-${src.id}`).innerText = src.length;
            });
            card.appendChild(lenGroup);
        }

        emittersListEl.appendChild(card);
    });
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
            
            const half = src.length / 2;
            for (let t = -half; t <= half; t++) {
                const px = Math.round(src.x + t * cosA);
                const py = Math.round(src.y + t * sinA);
                if(px >= 0 && px < N && py >= 0 && py < N) {
                    solver.addDensity(px, py, globalDensity);
                    solver.addVelocity(px, py, vx, vy);
                }
            }
        }
    }
}

// Render overlay UI directly on the canvas
function drawOverlay() {
    ctx.lineWidth = 2;
    for (const src of sources) {
        if (src.type === 'point') {
            // Draw Circle
            ctx.beginPath();
            ctx.arc(src.x, src.y, 4, 0, Math.PI*2);
            ctx.fillStyle = '#1a73e8';
            ctx.fill();
            
            // Draw Direction Arrow
            const radDir = (src.dir * Math.PI) / 180;
            const ex = src.x + Math.cos(radDir) * 15;
            const ey = src.y + Math.sin(radDir) * 15;
            
            ctx.beginPath();
            ctx.moveTo(src.x, src.y);
            ctx.lineTo(ex, ey);
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();

        } else if (src.type === 'line') {
            const radAngle = (src.angle * Math.PI) / 180;
            const cosA = Math.cos(radAngle);
            const sinA = Math.sin(radAngle);
            const half = src.length / 2;
            
            const sx = src.x - half * cosA;
            const sy = src.y - half * sinA;
            const ex = src.x + half * cosA;
            const ey = src.y + half * sinA;

            // Draw Line
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(ex, ey);
            ctx.strokeStyle = '#1a73e8';
            ctx.lineWidth = 3;
            ctx.stroke();

            // Draw multiple direction arrows originating from the line
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgba(255,255,255,0.7)';
            const radDir = (src.dir * Math.PI) / 180;
            const dirX = Math.cos(radDir) * 15;
            const dirY = Math.sin(radDir) * 15;

            for (let t = -half; t <= half; t += 20) {
                const px = src.x + t * cosA;
                const py = src.y + t * sinA;
                ctx.beginPath();
                ctx.moveTo(px, py);
                ctx.lineTo(px + dirX, py + dirY);
                ctx.stroke();
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
    
    // Sliders
    document.getElementById('brush-size').addEventListener('input', (e) => {
        brushSize = parseInt(e.target.value);
        document.getElementById('brush-size-val').innerText = brushSize;
    });
    document.getElementById('shape-rot').addEventListener('input', (e) => {
        shapeRot = parseInt(e.target.value);
        document.getElementById('shape-rot-val').innerText = shapeRot;
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

    // Draw Fluid and Solid geometry to ImageData
    for (let i = 0; i < size; i++) {
        const d = densityArray[i];
        const isWall = obsArray[i];
        const pxIdx = i * 4;

        if (isWall) {
            // Material Gray Wall color
            data[pxIdx] = 95;
            data[pxIdx + 1] = 99;
            data[pxIdx + 2] = 104;
            data[pxIdx + 3] = 255;
        } else {
            // Light background (white/gray) with Cyan fluid
            // d maps to how cyan it gets. Background is #f8f9fa
            const dClamped = Math.min(1.0, d / 20.0);
            
            // Background color
            const r_bg = 248, g_bg = 249, b_bg = 250;
            // Fluid Color (Material Blue / Cyan)
            const r_fluid = 26, g_fluid = 115, b_fluid = 232;
            
            data[pxIdx] = r_bg + dClamped * (r_fluid - r_bg);       
            data[pxIdx + 1] = g_bg + dClamped * (g_fluid - g_bg);  
            data[pxIdx + 2] = b_bg + dClamped * (b_fluid - b_bg); 
            data[pxIdx + 3] = 255;                
        }
    }

    ctx.putImageData(imgData, 0, 0);
    
    // Draw UI Overlays (Emitters)
    drawOverlay();

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
    
    // Default setup
    activeTool = 'src-line';
    shapeRot = 90;
    placeSource(4, N/2);
    // Tweak properties
    sources[0].dir = 0;
    sources[0].length = 150;
    renderEmittersUI();
    
    brushSize = 15;
    shapeRot = -20;
    activeTool = 'rect';
    stampShape(70, 100);
    
    brushSize = 10;
    shapeRot = 0;
    activeTool = 'draw';
    
    initControls();
    console.log("AeroFlow Engine Loaded!");
    
    lastTime = performance.now();
    requestAnimationFrame(render);
});
