let moduleRef = null;
let evoManager = null;

// Track bounds
let trackLines = []; // flat array [x1, y1, x2, y2, x1, y1...]
let isDrawingWall = false;
let currentWallStart = null;
let activeTool = 'draw'; // 'draw', 'erase', 'start', 'goal'

// Engine state
let activeSpeedMultiplier = 1;
const dt = 0.5; // Physics timestep

// Start and Goal coordinates
let startPos = { x: 150, y: 450 };
let goalPos = { x: 650, y: 150 };

// Camera System (Zoom and Pan)
let camera = { x: 0, y: 0, zoom: 1 };
let isPanning = false;
let panStart = null;

// UI Elements
const canvas = document.getElementById('sim-canvas');
const ctx = canvas.getContext('2d');
const netCanvas = document.getElementById('network-canvas');
const netCtx = netCanvas.getContext('2d');

const genLabel = document.getElementById('stat-gen');
const aliveLabel = document.getElementById('stat-alive');
const fitnessLabel = document.getElementById('stat-fitness');

function createDefaultTrack() {
    trackLines = [
        100, 100, 700, 100,
        700, 100, 700, 500,
        700, 500, 100, 500,
        100, 500, 100, 100,
        
        200, 200, 600, 200,
        600, 200, 600, 400,
        600, 400, 200, 400,
        200, 400, 200, 200
    ];
}

function updateTrackInCpp() {
    if (!evoManager || !moduleRef) return;
    const vec = new moduleRef.VectorFloat();
    for (let i = 0; i < trackLines.length; i++) {
        vec.push_back(trackLines[i]);
    }
    evoManager.setTrackBoundaries(vec);
    vec.delete();
}

function screenToWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const screenX = (clientX - rect.left) * (canvas.width / rect.width);
    const screenY = (clientY - rect.top) * (canvas.height / rect.height);
    
    // Reverse the camera transform
    const worldX = (screenX - canvas.width/2) / camera.zoom + camera.x;
    const worldY = (screenY - canvas.height/2) / camera.zoom + camera.y;
    return { x: worldX, y: worldY };
}

function initControls() {
    createDefaultTrack();

    document.getElementById('btn-kill-all').addEventListener('click', () => {
        if(evoManager) evoManager.nextGeneration();
    });

    document.getElementById('btn-reset-track').addEventListener('click', () => {
        trackLines = [];
        updateTrackInCpp();
    });

    const drawBtn = document.getElementById('btn-draw-wall');
    const eraseBtn = document.getElementById('btn-draw-erase');
    const startBtn = document.getElementById('btn-set-start');
    const goalBtn = document.getElementById('btn-set-goal');
    
    const toolBtns = [drawBtn, eraseBtn, startBtn, goalBtn];
    const setTool = (toolName, activeBtn) => {
        activeTool = toolName;
        toolBtns.forEach(btn => btn.classList.remove('active'));
        activeBtn.classList.add('active');
    };

    drawBtn.addEventListener('click', () => setTool('draw', drawBtn));
    eraseBtn.addEventListener('click', () => setTool('erase', eraseBtn));
    startBtn.addEventListener('click', () => setTool('start', startBtn));
    goalBtn.addEventListener('click', () => setTool('goal', goalBtn));

    document.querySelectorAll('.speed-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeSpeedMultiplier = parseInt(btn.getAttribute('data-speed'));
        });
    });

    // Panning with middle click or spacebar
    canvas.addEventListener('mousedown', (e) => {
        if (e.button === 1 || e.shiftKey) { // Middle click or shift+click to pan
            isPanning = true;
            panStart = { x: e.clientX, y: e.clientY };
            return;
        }

        const worldPos = screenToWorld(e.clientX, e.clientY);
        
        if (activeTool === 'draw') {
            isDrawingWall = true;
            currentWallStart = worldPos;
        } else if (activeTool === 'erase') {
            const eraseRadius = 20 / camera.zoom;
            let newLines = [];
            for(let i=0; i<trackLines.length; i+=4) {
                const mx = (trackLines[i] + trackLines[i+2]) / 2;
                const my = (trackLines[i+1] + trackLines[i+3]) / 2;
                const dist = Math.sqrt((mx-worldPos.x)**2 + (my-worldPos.y)**2);
                if (dist > eraseRadius) {
                    newLines.push(trackLines[i], trackLines[i+1], trackLines[i+2], trackLines[i+3]);
                }
            }
            trackLines = newLines;
            updateTrackInCpp();
        } else if (activeTool === 'start') {
            startPos = worldPos;
            if(evoManager) evoManager.setStart(startPos.x, startPos.y);
        } else if (activeTool === 'goal') {
            goalPos = worldPos;
            if(evoManager) evoManager.setGoal(goalPos.x, goalPos.y);
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (isPanning) {
            const dx = e.clientX - panStart.x;
            const dy = e.clientY - panStart.y;
            camera.x -= dx / camera.zoom;
            camera.y -= dy / camera.zoom;
            panStart = { x: e.clientX, y: e.clientY };
            return;
        }

        if (!isDrawingWall) return;
        const worldPos = screenToWorld(e.clientX, e.clientY);
        currentWallStart.currentX = worldPos.x;
        currentWallStart.currentY = worldPos.y;
    });

    canvas.addEventListener('mouseup', (e) => {
        if (isPanning) {
            isPanning = false;
            return;
        }
        if (isDrawingWall && currentWallStart) {
            const worldPos = screenToWorld(e.clientX, e.clientY);
            trackLines.push(currentWallStart.x, currentWallStart.y, worldPos.x, worldPos.y);
            updateTrackInCpp();
            isDrawingWall = false;
            currentWallStart = null;
        }
    });
    
    // Zooming
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomIntensity = 0.1;
        const wheel = e.deltaY < 0 ? 1 : -1;
        
        // Zoom towards mouse
        const rect = canvas.getBoundingClientRect();
        const screenX = (e.clientX - rect.left) * (canvas.width / rect.width);
        const screenY = (e.clientY - rect.top) * (canvas.height / rect.height);
        
        const worldX = (screenX - canvas.width/2) / camera.zoom + camera.x;
        const worldY = (screenY - canvas.height/2) / camera.zoom + camera.y;

        const zoomFactor = Math.exp(wheel * zoomIntensity);
        camera.zoom *= zoomFactor;
        
        // Clamp zoom
        if(camera.zoom < 0.1) camera.zoom = 0.1;
        if(camera.zoom > 10) camera.zoom = 10;
        
        camera.x = worldX - (screenX - canvas.width/2) / camera.zoom;
        camera.y = worldY - (screenY - canvas.height/2) / camera.zoom;
    });
    
    // Prevent context menu
    canvas.addEventListener('contextmenu', e => e.preventDefault());
}

function drawNetwork(weightsFlat) {
    netCtx.fillStyle = '#05020a';
    netCtx.fillRect(0, 0, netCanvas.width, netCanvas.height);
    
    if(!weightsFlat || weightsFlat.length < 3) return;
    
    let numLayers = weightsFlat[0];
    let topology = [];
    for(let i=0; i<numLayers; i++) topology.push(weightsFlat[1+i]);
    
    const paddingX = 40;
    const paddingY = 20;
    const spacingX = (netCanvas.width - 2 * paddingX) / (numLayers - 1);
    
    let nodePositions = []; 
    
    for (let l = 0; l < numLayers; l++) {
        let layerPos = [];
        const numNeurons = topology[l];
        const spacingY = numNeurons > 1 ? (netCanvas.height - 2 * paddingY) / (numNeurons - 1) : 0;
        const startY = numNeurons === 1 ? netCanvas.height / 2 : paddingY;
        
        for (let n = 0; n < numNeurons; n++) {
            const x = paddingX + l * spacingX;
            const y = startY + n * spacingY;
            layerPos.push({x, y});
            
            netCtx.beginPath();
            netCtx.arc(x, y, 6, 0, Math.PI * 2);
            netCtx.fillStyle = l === 0 ? '#00ffff' : (l === numLayers - 1 ? '#ff00ff' : '#8a2be2');
            netCtx.fill();
            netCtx.closePath();
        }
        nodePositions.push(layerPos);
    }
    
    netCtx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    netCtx.lineWidth = 1;
    for (let l = 1; l < numLayers; l++) {
        for (let n = 0; n < topology[l]; n++) {
            for (let prevN = 0; prevN < topology[l-1]; prevN++) {
                netCtx.beginPath();
                netCtx.moveTo(nodePositions[l-1][prevN].x, nodePositions[l-1][prevN].y);
                netCtx.lineTo(nodePositions[l][n].x, nodePositions[l][n].y);
                netCtx.stroke();
            }
        }
    }
}

function startSimulationLoop() {
    // Initial camera position centered on default track
    camera.x = 400;
    camera.y = 300;
    camera.zoom = 0.8;

    function frame() {
        try {
            if (!evoManager) { requestAnimationFrame(frame); return; }

            for (let s = 0; s < activeSpeedMultiplier; ++s) {
                evoManager.update(dt);
            }

            if (evoManager.allDead()) {
                evoManager.nextGeneration();
            }

            ctx.fillStyle = '#05020a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.save();
            // Apply Camera Transform
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.scale(camera.zoom, camera.zoom);
            ctx.translate(-camera.x, -camera.y);

            // Draw Track
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#00ffff';
            for (let i = 0; i < trackLines.length; i += 4) {
                ctx.beginPath();
                ctx.moveTo(trackLines[i], trackLines[i+1]);
                ctx.lineTo(trackLines[i+2], trackLines[i+3]);
                ctx.stroke();
            }
            
            // Draw current drawing wall
            if (isDrawingWall && currentWallStart && currentWallStart.currentX) {
                ctx.strokeStyle = '#ff00ff';
                ctx.shadowColor = '#ff00ff';
                ctx.beginPath();
                ctx.moveTo(currentWallStart.x, currentWallStart.y);
                ctx.lineTo(currentWallStart.currentX, currentWallStart.currentY);
                ctx.stroke();
            }
            ctx.shadowBlur = 0; 
            
            // Draw Start Point
            ctx.fillStyle = '#ff00ff';
            ctx.shadowColor = '#ff00ff';
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.arc(startPos.x, startPos.y, 10, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw Goal Point
            ctx.fillStyle = '#ffff00';
            ctx.shadowColor = '#ffff00';
            ctx.shadowBlur = 25;
            ctx.beginPath();
            // Draw a star shape for the goal
            const starRot = Math.PI / 2 * 3;
            let sx = goalPos.x;
            let sy = goalPos.y;
            let step = Math.PI / 5;
            ctx.moveTo(goalPos.x, goalPos.y - 15);
            for(let i=0; i<5; i++){
                sx = goalPos.x + Math.cos(starRot + i * step * 2) * 15;
                sy = goalPos.y + Math.sin(starRot + i * step * 2) * 15;
                ctx.lineTo(sx, sy);
                sx = goalPos.x + Math.cos(starRot + i * step * 2 + step) * 7;
                sy = goalPos.y + Math.sin(starRot + i * step * 2 + step) * 7;
                ctx.lineTo(sx, sy);
            }
            ctx.lineTo(goalPos.x, goalPos.y - 15);
            ctx.closePath();
            ctx.fill();
            
            ctx.shadowBlur = 0;

            // Read Car Data
            const ptr = evoManager.getCarDataPtr();
            const size = evoManager.getCarDataSize();
            const HEAPF32 = moduleRef.HEAPF32;
            const carData = new Float32Array(HEAPF32.buffer, ptr, size);
            
            const numCars = size / 9; // 9 floats per car
            let bestCarIdx = -1;
            
            // Draw Cars
            for (let i = 0; i < numCars; ++i) {
                const idx = i * 9;
                const x = carData[idx];
                const y = carData[idx+1];
                const angle = carData[idx+2];
                const isDead = carData[idx+3] > 0.5;
                
                if (isDead) {
                    ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
                    ctx.fillRect(x - 2, y - 2, 4, 4);
                    continue;
                }
                
                if (bestCarIdx === -1) bestCarIdx = i; // First alive car
                
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(angle);
                
                // Draw Car Body
                ctx.fillStyle = i === 0 ? '#ff00ff' : '#8a2be2'; 
                ctx.fillRect(-15, -25, 30, 50);
                
                // Draw "Headlights"
                ctx.fillStyle = '#ffff00';
                ctx.fillRect(-12, -25, 6, 4);
                ctx.fillRect(6, -25, 6, 4);
                
                ctx.restore();
                
                // Draw Rays for Best Car
                if (i === 0) { 
                    ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)';
                    ctx.lineWidth = 1;
                    const raySpread = Math.PI / 2;
                    const angleStep = raySpread / 4;
                    for (let r = 0; r < 5; ++r) {
                        const dist = carData[idx + 4 + r];
                        const rAngle = angle - (raySpread/2) + (r * angleStep);
                        const ex = x + Math.sin(rAngle) * dist;
                        const ey = y - Math.cos(rAngle) * dist;
                        
                        ctx.beginPath();
                        ctx.moveTo(x, y);
                        ctx.lineTo(ex, ey);
                        ctx.stroke();
                        
                        ctx.fillStyle = '#ff00ff';
                        ctx.fillRect(ex-2, ey-2, 4, 4);
                    }
                }
            }

            ctx.restore(); // Restore camera transform

            // Update Telemetry
            genLabel.innerText = evoManager.generation;
            aliveLabel.innerText = evoManager.getAliveCount() + "/" + numCars;
            fitnessLabel.innerText = Math.round(evoManager.getCurrentMaxFitness());
            
            // Draw Brain
            if (numCars > 0) {
                const brainVec = evoManager.getBestBrainWeights();
                const brainArr = [];
                for(let i=0; i<brainVec.size(); i++) {
                    brainArr.push(brainVec.get(i));
                }
                brainVec.delete();
                drawNetwork(brainArr);
            }

            requestAnimationFrame(frame);
        } catch (e) {
            console.error(e);
            ctx.fillStyle = 'red';
            ctx.font = '20px monospace';
            ctx.fillText("CRASH: " + e.message, 20, 40);
        }
    }
    requestAnimationFrame(frame);
}

// Load WebAssembly
createFluidSimModule({
    locateFile: (path) => path.endsWith('.wasm') ? 'wasm/' + path : path
}).then((module) => {
    moduleRef = module;
    
    evoManager = new module.EvolutionManager(100, startPos.x, startPos.y, 0);
    evoManager.setGoal(goalPos.x, goalPos.y);
    
    initControls();
    updateTrackInCpp();
    
    console.log("Neon Drive AI Loaded!");
    startSimulationLoop();
});
