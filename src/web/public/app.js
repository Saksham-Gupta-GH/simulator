let moduleRef = null;
let solver = null;

// Config
let N = 200;
const iter = 16;
const dt = 0.1;
let diff = 0.0;
let visc = 0.0000001;
let globalDensity = 100.0;

// High-Res Rendering Engine
const canvas = document.getElementById('fluid-canvas');
const ctx = canvas.getContext('2d');
const DISPLAY_SIZE = 1000;
canvas.width = DISPLAY_SIZE;
canvas.height = DISPLAY_SIZE;

// Low-Res Physics Buffer (Fluid)
const offscreenCanvas = document.createElement('canvas');
offscreenCanvas.width = N;
offscreenCanvas.height = N;
const offCtx = offscreenCanvas.getContext('2d');
let imgData = offCtx.createImageData(N, N);

// Low-Res Physics Buffer (Obstacles)
const obsCanvas = document.createElement('canvas');
obsCanvas.width = N;
obsCanvas.height = N;
const obsCtx = obsCanvas.getContext('2d');
let obsImgData = obsCtx.createImageData(N, N);

const fpsCounter = document.getElementById('fps-counter');
const srcCountEl = document.getElementById('src-count');
const emittersListEl = document.getElementById('emitters-list');

// State
let isDrawing = false;
let simRunning = true;
let activeTool = 'draw'; 
let brushSize = 10;
let shapeRot = 0; 
let shapeColor = {r: 95, g: 99, b: 104}; // Default Material Gray
let lastTime = performance.now();
let lastMousePos = null;
let dragStartPos = null;

// Sources State
let sources = [];
let sourceIdCounter = 1;

// Utility: Hex to RGB
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : {r: 0, g: 0, b: 0};
}

// Utility: RGB to Hex
function rgbToHex(r, g, b) {
    return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1);
}

function getPhysicsPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = N / rect.width;
    const scaleY = N / rect.height;
    return {
        x: Math.floor((e.clientX - rect.left) * scaleX),
        y: Math.floor((e.clientY - rect.top) * scaleY)
    };
}

// ----------------------------------------------------
// Freehand Drawing (Brush)
// ----------------------------------------------------
function drawStroke(x0, y0, x1, y1) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.max(1, Math.floor(distance));
    
    for (let i = 0; i <= steps; i++) {
        const t = steps === 0 ? 0 : i / steps;
        const x = Math.round(x0 + dx * t);
        const y = Math.round(y0 + dy * t);
        stampBrush(x, y);
    }
}

function stampBrush(cx, cy) {
    if (!solver) return;
    const isSolid = activeTool !== 'erase';
    const half = brushSize;
    for (let i = -half; i <= half; i++) {
        for (let j = -half; j <= half; j++) {
            if (i*i + j*j <= half*half) {
                solver.setObstacle(cx + i, cy + j, isSolid, shapeColor.r, shapeColor.g, shapeColor.b);
            }
        }
    }
}

// ----------------------------------------------------
// MS-Paint Bounding Box Shapes
// ----------------------------------------------------
function stampShapeBounds(x0, y0, x1, y1) {
    if (!solver) return;
    
    const minX = Math.min(x0, x1);
    const maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1);
    const maxY = Math.max(y0, y1);
    
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const width = maxX - minX;
    const height = maxY - minY;
    
    const halfW = width / 2;
    const halfH = height / 2;
    const rad = (shapeRot * Math.PI) / 180;
    const cosA = Math.cos(-rad);
    const sinA = Math.sin(-rad);

    const boxR = Math.ceil(Math.max(halfW, halfH) * 1.5);

    if (activeTool === 'circle') {
        const r2 = Math.min(halfW, halfH) * Math.min(halfW, halfH);
        for (let i = -boxR; i <= boxR; i++) {
            for (let j = -boxR; j <= boxR; j++) {
                if (i*i + j*j <= r2) {
                    solver.setObstacle(Math.round(cx + i), Math.round(cy + j), true, shapeColor.r, shapeColor.g, shapeColor.b);
                }
            }
        }
    } 
    else if (activeTool === 'rect') {
        for (let i = -boxR; i <= boxR; i++) {
            for (let j = -boxR; j <= boxR; j++) {
                const rx = i * cosA - j * sinA;
                const ry = i * sinA + j * cosA;
                if (rx >= -halfW && rx <= halfW && ry >= -halfH && ry <= halfH) {
                    solver.setObstacle(Math.round(cx + i), Math.round(cy + j), true, shapeColor.r, shapeColor.g, shapeColor.b);
                }
            }
        }
    }
    else if (activeTool === 'tri') {
        const p1 = {x: 0, y: -halfH};
        const p2 = {x: halfW, y: halfH};
        const p3 = {x: -halfW, y: halfH};
        
        function sign(pt1, pt2, pt3) {
            return (pt1.x - pt3.x) * (pt2.y - pt3.y) - (pt2.x - pt3.x) * (pt1.y - pt3.y);
        }

        for (let i = -boxR; i <= boxR; i++) {
            for (let j = -boxR; j <= boxR; j++) {
                const rx = i * cosA - j * sinA;
                const ry = i * sinA + j * cosA;
                const pt = {x: rx, y: ry};
                const d1 = sign(pt, p1, p2);
                const d2 = sign(pt, p2, p3);
                const d3 = sign(pt, p3, p1);
                
                const has_neg = (d1 < 0) || (d2 < 0) || (d3 < 0);
                const has_pos = (d1 > 0) || (d2 > 0) || (d3 > 0);
                
                if (!(has_neg && has_pos)) {
                    solver.setObstacle(Math.round(cx + i), Math.round(cy + j), true, shapeColor.r, shapeColor.g, shapeColor.b);
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
            dir: shapeRot, 
            speed: 50,
            color: {r: 26, g: 115, b: 232} // Material Blue
        });
    } else if (activeTool === 'src-line') {
        sources.push({
            id: sourceIdCounter++,
            type: 'line',
            x: cx,
            y: cy,
            length: 100, 
            angle: shapeRot, 
            dir: shapeRot - 90, 
            speed: 50,
            color: {r: 26, g: 115, b: 232}
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
        const hexColor = rgbToHex(src.color.r, src.color.g, src.color.b);

        const header = document.createElement('div');
        header.className = 'emitter-header';
        
        const title = document.createElement('div');
        title.className = 'emitter-title';
        title.innerHTML = src.type === 'point' 
            ? `<i class="fa-solid fa-location-dot" style="color:${hexColor};"></i> Point Source #${src.id}`
            : `<i class="fa-solid fa-grip-lines-vertical" style="color:${hexColor};"></i> Line Source #${src.id}`;

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

        // Fluid Color Picker
        const colorGroup = document.createElement('div');
        colorGroup.className = 'slider-group';
        colorGroup.style.marginBottom = '8px';
        colorGroup.innerHTML = `
            <label>Fluid Color</label>
            <input type="color" value="${hexColor}" style="width: 100%; height: 28px; padding: 0; cursor: pointer;">
        `;
        const colorPicker = colorGroup.querySelector('input');
        colorPicker.addEventListener('input', (e) => {
            src.color = hexToRgb(e.target.value);
            // Re-render to update the icon color
            renderEmittersUI();
        });
        card.appendChild(colorGroup);

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

        // Line Orientation and Length Sliders
        if (src.type === 'line') {
            const angleGroup = document.createElement('div');
            angleGroup.className = 'slider-group';
            angleGroup.style.marginBottom = '8px';
            angleGroup.innerHTML = `
                <label>Line Orientation <span><span id="angle-val-${src.id}">${src.angle}</span>°</span></label>
                <input type="range" min="-180" max="180" value="${src.angle}">
            `;
            const angleSlider = angleGroup.querySelector('input');
            angleSlider.addEventListener('input', (e) => {
                src.angle = parseInt(e.target.value);
                angleGroup.querySelector(`#angle-val-${src.id}`).innerText = src.angle;
            });
            card.appendChild(angleGroup);

            const lenGroup = document.createElement('div');
            lenGroup.className = 'slider-group';
            lenGroup.style.marginBottom = '0';
            lenGroup.innerHTML = `
                <label>Line Length <span><span id="len-val-${src.id}">${src.length}</span>px</span></label>
                <input type="range" min="10" max="400" value="${src.length}">
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
        
        // Use globalDensity multiplier for intensity, but colored
        const amtR = (src.color.r / 255) * globalDensity;
        const amtG = (src.color.g / 255) * globalDensity;
        const amtB = (src.color.b / 255) * globalDensity;

        if (src.type === 'point') {
            if(src.x >=0 && src.x < N && src.y >= 0 && src.y < N) {
                solver.addDensity(src.x, src.y, amtR, amtG, amtB);
                solver.addVelocity(src.x, src.y, vx, vy);
            }
        } else if (src.type === 'line') {
            const radAngle = (src.angle * Math.PI) / 180;
            const cosA = Math.cos(radAngle);
            const sinA = Math.sin(radAngle);
            
            const half = src.length / 2;
            for (let t = -half; t <= half; t++) {
                const px = Math.round(src.x + t * cosA);
                const py = Math.round(src.y + t * sinA);
                if(px >= 0 && px < N && py >= 0 && py < N) {
                    solver.addDensity(px, py, amtR, amtG, amtB);
                    solver.addVelocity(px, py, vx, vy);
                }
            }
        }
    }
}

// ----------------------------------------------------
// HD Canvas Render Overlay
// ----------------------------------------------------
function drawOverlay() {
    const scale = DISPLAY_SIZE / N;

    ctx.lineWidth = 3;
    ctx.font = "bold 24px Roboto";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    // 2. Draw MS-Paint Wireframe if dragging a shape
    if (isDrawing && dragStartPos && lastMousePos && (activeTool === 'rect' || activeTool === 'tri' || activeTool === 'circle')) {
        const x0 = dragStartPos.x * scale;
        const y0 = dragStartPos.y * scale;
        const x1 = lastMousePos.x * scale;
        const y1 = lastMousePos.y * scale;
        
        const cx = (x0 + x1) / 2;
        const cy = (y0 + y1) / 2;
        const width = Math.abs(x1 - x0);
        const height = Math.abs(y1 - y0);
        
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((shapeRot * Math.PI) / 180);
        
        const wireColor = rgbToHex(shapeColor.r, shapeColor.g, shapeColor.b);
        ctx.strokeStyle = wireColor; 
        ctx.setLineDash([8, 8]);
        ctx.lineWidth = 4;
        
        if (activeTool === 'rect') {
            ctx.strokeRect(-width/2, -height/2, width, height);
        } else if (activeTool === 'circle') {
            ctx.beginPath();
            const r = Math.min(width/2, height/2);
            ctx.arc(0, 0, r, 0, Math.PI*2);
            ctx.stroke();
        } else if (activeTool === 'tri') {
            ctx.beginPath();
            ctx.moveTo(0, -height/2);
            ctx.lineTo(width/2, height/2);
            ctx.lineTo(-width/2, height/2);
            ctx.closePath();
            ctx.stroke();
        }
        
        ctx.restore();
    }

    // 3. Draw Emitters Overlays
    ctx.setLineDash([]);
    for (const src of sources) {
        const hx = src.x * scale;
        const hy = src.y * scale;
        const hexColor = rgbToHex(src.color.r, src.color.g, src.color.b);

        if (src.type === 'point') {
            ctx.beginPath();
            ctx.arc(hx, hy, 10, 0, Math.PI*2);
            ctx.fillStyle = hexColor;
            ctx.fill();
            
            ctx.fillStyle = hexColor;
            ctx.fillText(src.id, hx - 25, hy - 25);
            
            const radDir = (src.dir * Math.PI) / 180;
            const ex = hx + Math.cos(radDir) * 40;
            const ey = hy + Math.sin(radDir) * 40;
            
            ctx.beginPath();
            ctx.moveTo(hx, hy);
            ctx.lineTo(ex, ey);
            ctx.strokeStyle = '#202124';
            ctx.lineWidth = 4;
            ctx.stroke();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();

        } else if (src.type === 'line') {
            const radAngle = (src.angle * Math.PI) / 180;
            const cosA = Math.cos(radAngle);
            const sinA = Math.sin(radAngle);
            const halfHD = (src.length / 2) * scale;
            
            const sx = hx - halfHD * cosA;
            const sy = hy - halfHD * sinA;
            const ex = hx + halfHD * cosA;
            const ey = hy + halfHD * sinA;

            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(ex, ey);
            ctx.strokeStyle = hexColor;
            ctx.lineWidth = 6;
            ctx.stroke();

            ctx.fillStyle = hexColor;
            ctx.fillText(src.id, hx, hy - 30);

            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(255,255,255,0.8)';
            const radDir = (src.dir * Math.PI) / 180;
            const dirX = Math.cos(radDir) * 30;
            const dirY = Math.sin(radDir) * 30;

            for (let t = -halfHD; t <= halfHD; t += (20 * scale)) {
                const px = hx + t * cosA;
                const py = hy + t * sinA;
                ctx.beginPath();
                ctx.moveTo(px, py);
                ctx.lineTo(px + dirX, py + dirY);
                ctx.stroke();
            }
        }
    }
}

function initControls() {
    const playBtn = document.getElementById('btn-play-pause');
    const resSelect = document.getElementById('grid-res');
    
    playBtn.addEventListener('click', () => {
        simRunning = !simRunning;
        if (simRunning) {
            playBtn.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
            playBtn.classList.add('active');
        } else {
            playBtn.innerHTML = '<i class="fa-solid fa-play"></i> Play';
            playBtn.classList.remove('active');
        }
    });

    resSelect.addEventListener('change', (e) => {
        const newN = parseInt(e.target.value);
        if (solver) solver.delete(); 
        N = newN;
        document.getElementById('res-val').innerText = `${N}x${N}`;
        
        offscreenCanvas.width = N;
        offscreenCanvas.height = N;
        imgData = offCtx.createImageData(N, N);
        
        obsCanvas.width = N;
        obsCanvas.height = N;
        obsImgData = obsCtx.createImageData(N, N);
        
        solver = new moduleRef.FluidSolver(N, diff, visc, dt);
        sources = [];
        renderEmittersUI();
    });

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
    
    document.getElementById('shape-color').addEventListener('input', (e) => {
        shapeColor = hexToRgb(e.target.value);
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

    // Interaction Events
    canvas.addEventListener('mousedown', (e) => {
        const pos = getPhysicsPos(e);
        lastMousePos = pos;
        
        if (activeTool.startsWith('src-')) {
            placeSource(pos.x, pos.y);
        } else if (activeTool === 'rect' || activeTool === 'tri' || activeTool === 'circle') {
            isDrawing = true;
            dragStartPos = pos; 
        } else {
            isDrawing = true;
            stampBrush(pos.x, pos.y);
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!isDrawing) return;
        const pos = getPhysicsPos(e);
        
        if (activeTool === 'draw' || activeTool === 'erase') {
            drawStroke(lastMousePos.x, lastMousePos.y, pos.x, pos.y);
        } 
        lastMousePos = pos;
    });

    window.addEventListener('mouseup', () => {
        if (isDrawing && dragStartPos && lastMousePos && (activeTool === 'rect' || activeTool === 'tri' || activeTool === 'circle')) {
            stampShapeBounds(dragStartPos.x, dragStartPos.y, lastMousePos.x, lastMousePos.y);
        }
        isDrawing = false;
        lastMousePos = null;
        dragStartPos = null;
    });
    
    canvas.addEventListener('contextmenu', e => e.preventDefault());
}

function render() {
    if (!solver || !moduleRef) return;

    if (simRunning) {
        applySources();
        solver.step();
    }

    const HEAPF32 = moduleRef.HEAPF32;
    const HEAPU8 = moduleRef.HEAPU8;

    const densityRPtr = solver.getDensityRPtr();
    const densityGPtr = solver.getDensityGPtr();
    const densityBPtr = solver.getDensityBPtr();
    const obsPtr = solver.getObstaclesPtr();
    const size = solver.getSize();

    const densityR = new Float32Array(HEAPF32.buffer, densityRPtr, size);
    const densityG = new Float32Array(HEAPF32.buffer, densityGPtr, size);
    const densityB = new Float32Array(HEAPF32.buffer, densityBPtr, size);
    const obsArray = new Uint8Array(HEAPU8.buffer, obsPtr, size);
    const obsR = new Uint8Array(HEAPU8.buffer, solver.getObsRPtr(), size);
    const obsG = new Uint8Array(HEAPU8.buffer, solver.getObsGPtr(), size);
    const obsB = new Uint8Array(HEAPU8.buffer, solver.getObsBPtr(), size);

    const data = imgData.data;
    const obsData = obsImgData.data;

    // Render ONLY fluid into low-res offscreen buffer
    // Render Obstacles into separate low-res buffer
    const r_bg = 248, g_bg = 249, b_bg = 250;
    
    for (let i = 0; i < size; i++) {
        const isWall = obsArray[i];
        const pxIdx = i * 4;

        if (isWall) {
            // Draw transparent where walls are
            data[pxIdx] = r_bg;
            data[pxIdx + 1] = g_bg;
            data[pxIdx + 2] = b_bg;
            data[pxIdx + 3] = 255;
            
            // Draw wall on obsData
            obsData[pxIdx] = obsR[i];
            obsData[pxIdx + 1] = obsG[i];
            obsData[pxIdx + 2] = obsB[i];
            obsData[pxIdx + 3] = 255;
        } else {
            obsData[pxIdx + 3] = 0; // transparent
            
            const dr = densityR[i];
            const dg = densityG[i];
            const db = densityB[i];
            
            // Normalize fluid amount
            const amtR = Math.min(1.0, dr / 20.0);
            const amtG = Math.min(1.0, dg / 20.0);
            const amtB = Math.min(1.0, db / 20.0);
            
            const totalDensity = Math.min(1.0, (dr + dg + db) / 20.0);
            
            if (totalDensity > 0.001) {
                // Calculate average color weighted by density
                const sum = dr + dg + db;
                const r_fluid = (dr / sum) * 255;
                const g_fluid = (dg / sum) * 255;
                const b_fluid = (db / sum) * 255;
                
                data[pxIdx] = r_bg + totalDensity * (r_fluid - r_bg);       
                data[pxIdx + 1] = g_bg + totalDensity * (g_fluid - g_bg);  
                data[pxIdx + 2] = b_bg + totalDensity * (b_fluid - b_bg); 
                data[pxIdx + 3] = 255;  
            } else {
                data[pxIdx] = r_bg;
                data[pxIdx + 1] = g_bg;
                data[pxIdx + 2] = b_bg;
                data[pxIdx + 3] = 255;
            }
        }
    }

    offCtx.putImageData(imgData, 0, 0);
    obsCtx.putImageData(obsImgData, 0, 0);

    // Draw the low-res physics buffer onto the high-res display canvas smoothly
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(offscreenCanvas, 0, 0, DISPLAY_SIZE, DISPLAY_SIZE);
    
    // Draw the obstacles sharply!
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(obsCanvas, 0, 0, DISPLAY_SIZE, DISPLAY_SIZE);
    
    // Draw crisp HD UI overlay
    drawOverlay();

    const now = performance.now();
    const frameTime = now - lastTime;
    lastTime = now;
    if (simRunning) fpsCounter.innerText = Math.round(1000 / frameTime);

    requestAnimationFrame(render);
}

createFluidSimModule({
    locateFile: (path) => path.endsWith('.wasm') ? 'wasm/' + path : path
}).then((module) => {
    moduleRef = module;
    
    solver = new module.FluidSolver(N, diff, visc, dt);
    
    // Default setup: Wind tunnel flowing from left to right
    activeTool = 'src-line';
    shapeRot = 90; // vertical line
    placeSource(2, N/2);
    sources[0].dir = 0; // horizontal flow
    sources[0].length = N * 0.8; 
    sources[0].speed = 60;
    renderEmittersUI();
    
    // Solid square obstacle in the middle
    shapeRot = 0;
    activeTool = 'rect';
    shapeColor = {r: 95, g: 99, b: 104};
    stampShapeBounds(N/2 - 20, N/2 - 20, N/2 + 20, N/2 + 20);
    
    brushSize = 10;
    shapeRot = 0;
    activeTool = 'draw';
    
    initControls();
    console.log("AeroFlow HD RGB Engine Loaded!");
    
    lastTime = performance.now();
    requestAnimationFrame(render);
});
