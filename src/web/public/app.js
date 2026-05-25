let moduleRef = null;
let evoManager = null;

// Track bounds
let trackLines = []; // flat array [x1, y1, x2, y2, x1, y1...]
let isDrawingWall = false;
let currentWallStart = null;
let activeTool = 'draw'; // 'draw' or 'erase'

// Engine state
let activeSpeedMultiplier = 1;
const dt = 0.5; // Physics timestep

// UI Elements
const canvas = document.getElementById('sim-canvas');
const ctx = canvas.getContext('2d');
const netCanvas = document.getElementById('network-canvas');
const netCtx = netCanvas.getContext('2d');

const genLabel = document.getElementById('stat-gen');
const aliveLabel = document.getElementById('stat-alive');
const fitnessLabel = document.getElementById('stat-fitness');

// Basic closed loop track for default
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

function initControls() {
    createDefaultTrack();

    document.getElementById('btn-kill-all').addEventListener('click', () => {
        if(evoManager) evoManager.nextGeneration();
    });

    document.getElementById('btn-reset-track').addEventListener('click', () => {
        trackLines = [];
        if(evoManager) evoManager.setTrackBoundaries(new Float32Array(0));
    });

    const drawBtn = document.getElementById('btn-draw-wall');
    const eraseBtn = document.getElementById('btn-draw-erase');

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

    document.querySelectorAll('.speed-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeSpeedMultiplier = parseInt(btn.getAttribute('data-speed'));
        });
    });

    // Mouse events for track drawing
    canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (canvas.height / rect.height);
        
        if (activeTool === 'draw') {
            isDrawingWall = true;
            currentWallStart = {x, y};
        } else if (activeTool === 'erase') {
            // Very simple eraser: remove lines near click
            const eraseRadius = 20;
            let newLines = [];
            for(let i=0; i<trackLines.length; i+=4) {
                const mx = (trackLines[i] + trackLines[i+2]) / 2;
                const my = (trackLines[i+1] + trackLines[i+3]) / 2;
                const dist = Math.sqrt((mx-x)*(mx-x) + (my-y)*(my-y));
                if (dist > eraseRadius) {
                    newLines.push(trackLines[i], trackLines[i+1], trackLines[i+2], trackLines[i+3]);
                }
            }
            trackLines = newLines;
            if(evoManager) evoManager.setTrackBoundaries(new Float32Array(trackLines));
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!isDrawingWall) return;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (canvas.height / rect.height);
        
        // Render preview (handled in draw loop by reading currentWallStart)
        currentWallStart.currentX = x;
        currentWallStart.currentY = y;
    });

    canvas.addEventListener('mouseup', (e) => {
        if (isDrawingWall && currentWallStart) {
            const rect = canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) * (canvas.width / rect.width);
            const y = (e.clientY - rect.top) * (canvas.height / rect.height);
            
            trackLines.push(currentWallStart.x, currentWallStart.y, x, y);
            if(evoManager) {
                // Float32Array conversion for C++
                const f32 = new Float32Array(trackLines);
                evoManager.setTrackBoundaries(f32);
            }
            
            isDrawingWall = false;
            currentWallStart = null;
        }
    });
}

function drawNetwork(weightsFlat) {
    netCtx.fillStyle = '#05020a';
    netCtx.fillRect(0, 0, netCanvas.width, netCanvas.height);
    
    if(!weightsFlat || weightsFlat.length < 3) return;
    
    let numLayers = weightsFlat[0];
    let topology = [];
    for(let i=0; i<numLayers; i++) topology.push(weightsFlat[1+i]);
    
    let ptr = 1 + numLayers;
    
    // Draw logic
    const paddingX = 40;
    const paddingY = 20;
    const spacingX = (netCanvas.width - 2 * paddingX) / (numLayers - 1);
    
    let nodePositions = []; // layer -> neuron -> {x, y}
    
    for (let l = 0; l < numLayers; l++) {
        let layerPos = [];
        const numNeurons = topology[l];
        const spacingY = numNeurons > 1 ? (netCanvas.height - 2 * paddingY) / (numNeurons - 1) : 0;
        const startY = numNeurons === 1 ? netCanvas.height / 2 : paddingY;
        
        for (let n = 0; n < numNeurons; n++) {
            const x = paddingX + l * spacingX;
            const y = startY + n * spacingY;
            layerPos.push({x, y});
            
            // Draw nodes
            netCtx.beginPath();
            netCtx.arc(x, y, 6, 0, Math.PI * 2);
            netCtx.fillStyle = l === 0 ? '#00ffff' : (l === numLayers - 1 ? '#ff00ff' : '#8a2be2');
            netCtx.fill();
            netCtx.closePath();
        }
        nodePositions.push(layerPos);
    }
    
    // We only have weights, so drawing accurate active lines requires full brain eval.
    // Let's just draw connecting lines to look cool.
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

            // Draw Track
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 4;
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
            ctx.shadowBlur = 0; // Turn off glow for cars for performance

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
                
                if (bestCarIdx === -1) bestCarIdx = i; // First alive car is visually "lead"
                
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(angle);
                
                // Draw Car Body
                ctx.fillStyle = i === 0 ? '#ff00ff' : '#8a2be2'; // Best car is pink
                ctx.fillRect(-15, -25, 30, 50);
                
                // Draw "Headlights"
                ctx.fillStyle = '#ffff00';
                ctx.fillRect(-12, -25, 6, 4);
                ctx.fillRect(6, -25, 6, 4);
                
                ctx.restore();
                
                // Draw Rays for Best Car
                if (i === 0) { // The elite car
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
                        
                        // Hit dot
                        ctx.fillStyle = '#ff00ff';
                        ctx.fillRect(ex-2, ey-2, 4, 4);
                    }
                }
            }

            // Update Telemetry
            genLabel.innerText = evoManager.generation;
            aliveLabel.innerText = evoManager.getAliveCount() + "/" + numCars;
            fitnessLabel.innerText = Math.round(evoManager.getCurrentMaxFitness());
            
            // Draw Brain
            if (numCars > 0) {
                // Convert std::vector to JS Array
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
    
    // Spawn 100 cars at position 150, 450 facing UP (angle 0)
    evoManager = new module.EvolutionManager(100, 150, 450, 0);
    
    initControls();
    
    // Set initial track
    const f32 = new Float32Array(trackLines);
    evoManager.setTrackBoundaries(f32);
    
    console.log("Neon Drive AI Loaded!");
    startSimulationLoop();
});
