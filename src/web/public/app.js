/* ==========================================================================
   NeuroDrive AI Simulator - Core Frontend Controller (JS/Wasm Interfacing)
   ========================================================================== */

let Module = null;
let sim = null;

// Core Simulation Canvas
const canvas = document.getElementById('sim-canvas');
const ctx = canvas.getContext('2d');

// Neural Network Visual Debugger Canvas
const netCanvas = document.getElementById('network-canvas');
const netCtx = netCanvas.getContext('2d');

// Grid Dimensions (fixed in C++)
const gridCols = 80;
const gridRows = 60;
const cellSize = 10; // 10px cells => 800x600 canvas

// Interactive brushes
let currentBrush = 'road'; // road (erase wall), wall, erase
let currentPreset = 'oval';
let mouseIsDown = false;
let simulationSpeed = 1;   // 1x, 2x, 5x, 10x steps per render frame

// Dynamic color configurations matching HSL themes
let colors = {
    cyan: '#06b6d4',
    blue: '#3b82f6',
    purple: '#a855f7',
    orange: '#f97316',
    wall: 'rgba(6, 182, 212, 0.15)',
    trackBg: '#090d16'
};

// --------------------------------------------------------------------------
// WebAssembly Hydration & Simulation Initialization
// --------------------------------------------------------------------------
createFluidSimModule().then(ModuleInstance => {
    Module = ModuleInstance;
    console.log("C++ AI Neural Physics Core Hydrated Successfully!");

    // Instantiate C++ Simulation class with a population of 30 self-driving cars
    sim = new Module.Simulation(30);

    // Initial starting positions (perfectly placed at center-bottom for oval start)
    sim.startX = 400;
    sim.startY = 500;
    
    // Bind all slider settings to Wasm memory
    syncSlidersToWasm();

    // Pre-load default racetrack
    loadMapPreset('oval');

    // Begin high-performance rendering loop
    requestAnimationFrame(renderLoop);
});

// Sync Web UI parameters directly to C++ classes
function syncSlidersToWasm() {
    if (!sim) return;
    
    const mutationRate = parseFloat(document.getElementById('param-mutation-rate').value);
    const mutationAmount = parseFloat(document.getElementById('param-mutation-amount').value);

    sim.mutationRate = mutationRate;
    sim.mutationAmount = mutationAmount;

    document.getElementById('val-mutation-rate').textContent = `${Math.round(mutationRate * 100)}%`;
    document.getElementById('val-mutation-amount').textContent = mutationAmount.toFixed(2);
}

// --------------------------------------------------------------------------
// Racetrack Presets (Grid Writers)
// --------------------------------------------------------------------------
function loadMapPreset(preset) {
    if (!sim) return;

    const gridPtr = sim.getGridPtr();
    // Direct memory HEAP view mapping C++ vector: 0% data copy overhead!
    const grid = new Uint8Array(Module.HEAPU8.buffer, gridPtr, gridCols * gridRows);
    grid.fill(0); // Wipe track

    // Outer bounding borders (always solid boundaries)
    for (let x = 0; x < gridCols; ++x) {
        grid[0 * gridCols + x] = 1;
        grid[(gridRows - 1) * gridCols + x] = 1;
    }
    for (let y = 0; y < gridRows; ++y) {
        grid[y * gridCols + 0] = 1;
        grid[y * gridCols + (gridCols - 1)] = 1;
    }

    if (preset === 'oval') {
        // --- Oval Grand Prix Circuit Preset ---
        sim.startX = 400; sim.startY = 500; // bottom center
        
        // Solid center pill-shaped barrier to force cars to drive in a loop
        for (let y = 16; y <= 44; ++y) {
            for (let x = 16; x <= 64; ++x) {
                const dx = x - 40;
                const dy = y - 30;
                // Oval mathematical formula mapping inner obstacle
                if ((dx * dx) / 440 + (dy * dy) / 120 <= 1.0) {
                    grid[y * gridCols + x] = 1;
                }
            }
        }
    } 
    else if (preset === 'hairpin') {
        // --- Double Hairpin Twist Preset ---
        sim.startX = 90; sim.startY = 120; // top left start
        
        // Horizontal barriers creating snake-like hairpin turns
        // Segment 1 (left to right)
        for (let x = 0; x < 62; ++x) {
            grid[18 * gridCols + x] = 1;
        }
        // Segment 2 (right to left)
        for (let x = 18; x < gridCols; ++x) {
            grid[36 * gridCols + x] = 1;
        }
    } 
    else if (preset === 'obstacle') {
        // --- AI Obstacle Maze Preset ---
        sim.startX = 400; sim.startY = 520;
        
        // Scattered rigid pillars/walls testing AI edge avoidance sensors
        const pillars = [
            {cx: 40, cy: 30, r: 8},  // Giant center pillar
            {cx: 20, cy: 15, r: 5},  // Top-left
            {cx: 60, cy: 15, r: 5},  // Top-right
            {cx: 20, cy: 45, r: 5},  // Bottom-left
            {cx: 60, cy: 45, r: 5},  // Bottom-right
            {cx: 40, cy: 10, r: 3},  // Center top
            {cx: 40, cy: 50, r: 3}   // Center bottom
        ];

        for (let p of pillars) {
            for (let y = p.cy - p.r; y <= p.cy + p.r; ++y) {
                for (let x = p.cx - p.r; x <= p.cx + p.r; ++x) {
                    const dx = x - p.cx;
                    const dy = y - p.cy;
                    if (dx*dx + dy*dy <= p.r * p.r) {
                        grid[y * gridCols + x] = 1;
                    }
                }
            }
        }
    }
    
    // Reboot simulation so all cars start at new starting coordinates
    sim.reset();
}

// --------------------------------------------------------------------------
// Core step & Render Frame loop (60 FPS)
// --------------------------------------------------------------------------
function renderLoop(timeNow) {
    if (!sim) return;

    // Perform multiple simulation ticks per frame to enable speed multipliers!
    for (let i = 0; i < simulationSpeed; ++i) {
        sim.step();
    }

    // Retrieve active telemetry data
    const gen = sim.generationCount;
    const popSize = sim.populationSize;
    const active = sim.activeCarsCount;
    const maxFit = sim.maxFitness;
    const bestCarIdx = sim.bestCarIdx;

    // Update telemetry badges
    document.getElementById('stat-gen').textContent = gen;
    document.getElementById('stat-alive').textContent = `${active} / ${popSize}`;
    document.getElementById('stat-fitness').textContent = maxFit.toFixed(1);

    // Map contiguous coordinate floats: 13 properties per car
    const ptr = sim.getCarCoordinatesPtr();
    const carData = new Float32Array(Module.HEAPF32.buffer, ptr, popSize * 13);

    // Map wall grid buffer
    const gridPtr = sim.getGridPtr();
    const gridData = new Uint8Array(Module.HEAPU8.buffer, gridPtr, gridCols * gridRows);

    // Render step
    drawRacetrack(gridData);
    drawSwarm(carData, popSize, bestCarIdx);

    // Render Brain
    drawNeuralNetwork(carData, bestCarIdx);

    requestAnimationFrame(renderLoop);
}

// --------------------------------------------------------------------------
// Canvas Drawing Routines (Tron Vector Aesthetic)
// --------------------------------------------------------------------------
function drawRacetrack(grid) {
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Obsidian grid guidelines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.007)';
    ctx.lineWidth = 1;
    for (let col = 0; col < gridCols; ++col) {
        ctx.beginPath();
        ctx.moveTo(col * cellSize, 0);
        ctx.lineTo(col * cellSize, canvas.height);
        ctx.stroke();
    }
    for (let row = 0; row < gridRows; ++row) {
        ctx.beginPath();
        ctx.moveTo(0, row * cellSize);
        ctx.lineTo(canvas.width, row * cellSize);
        ctx.stroke();
    }

    // Draw rigid obstacles (walls) with glowing borders
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.07)';
    ctx.lineWidth = 1;

    for (let y = 0; y < gridRows; ++y) {
        for (let x = 0; x < gridCols; ++x) {
            if (grid[y * gridCols + x] === 1) {
                // Fill cell box
                ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
                ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
            }
        }
    }
}

function drawSwarm(data, count, bestIdx) {
    for (let i = 0; i < count; ++i) {
        const offset = i * 13;
        const px = data[offset + 0];
        const py = data[offset + 1];
        const angle = data[offset + 2];
        const speed = data[offset + 3];
        const isDead = data[offset + 4] === 1.0;
        
        if (isDead) continue; // Skip rendering crashed cars for cleaner aesthetics

        const isLeader = (i === bestIdx);

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(angle);

        // Vector drawing sleek rocket-car glider shapes
        ctx.beginPath();
        ctx.moveTo(8, 0);       // Nose
        ctx.lineTo(-6, -4.5);   // Left tail wing
        ctx.lineTo(-4, 0);      // Engine nozzle
        ctx.lineTo(-6, 4.5);    // Right tail wing
        ctx.closePath();

        if (isLeader) {
            // Draw leader in glowing cyan with bright borders
            ctx.fillStyle = 'rgba(6, 182, 212, 0.9)';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#06b6d4';
        } else {
            // Swarm rendered in transparent neon purple ghosts
            ctx.fillStyle = 'rgba(168, 85, 247, 0.3)';
            ctx.strokeStyle = 'rgba(168, 85, 247, 0.6)';
            ctx.lineWidth = 1;
            ctx.shadowBlur = 0;
        }

        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // 4. Render Laser beams for the leading car! (High-end HUD feedback)
        if (isLeader) {
            ctx.lineWidth = 1;
            const sensorAngles = [ -0.8, -0.4, 0.0, 0.4, 0.8 ];
            const maxRayRange = 135.0;

            for (let s = 0; s < 5; ++s) {
                const sDist = data[offset + 6 + s]; // Proximity factor: 0.0 to 1.0
                const rayAngle = angle + sensorAngles[s];
                const endX = px + Math.cos(rayAngle) * sDist * maxRayRange;
                const endY = py + Math.sin(rayAngle) * sDist * maxRayRange;

                // Color fades to red when close to walls
                if (sDist < 0.3) {
                    ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)'; // red laser
                } else if (sDist < 0.6) {
                    ctx.strokeStyle = 'rgba(234, 179, 8, 0.3)';  // yellow laser
                } else {
                    ctx.strokeStyle = 'rgba(6, 182, 212, 0.15)';  // cyan faint
                }

                ctx.beginPath();
                ctx.moveTo(px, py);
                ctx.lineTo(endX, endY);
                ctx.stroke();

                // Faint target hit dot
                if (sDist < 0.98) {
                    ctx.fillStyle = ctx.strokeStyle;
                    ctx.beginPath();
                    ctx.arc(endX, endY, 2.5, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
    }
}

// --------------------------------------------------------------------------
// Real-time Neural Network Synapse Visualizer
// --------------------------------------------------------------------------
function drawNeuralNetwork(carData, bestIdx) {
    netCtx.clearRect(0, 0, netCanvas.width, netCanvas.height);

    if (bestIdx < 0) return;

    // Flat read best brain weights
    const weightsPtr = sim.getBestBrainWeightsPtr();
    const weightsSize = sim.getBestBrainWeightsSize();
    if (weightsSize === 0) return;

    const weights = new Float32Array(Module.HEAPF32.buffer, weightsPtr, weightsSize);

    // Node Layout dimensions
    // Layer 0: 5 Inputs, Layer 1: 6 Hidden, Layer 2: 2 Outputs
    const nodeX = [40, 200, 360];
    const nodeY = [
        [30, 75, 120, 165, 210],     // 5 inputs
        [20, 60, 100, 140, 180, 220], // 6 hidden nodes
        [75, 165]                     // 2 outputs (Steer, Gas)
    ];

    // Grab the best car's current active sensor distances and updates
    const offset = bestIdx * 13;
    const sensors = [];
    for (let s = 0; s < 5; ++s) {
        sensors.push(carData[offset + 6 + s]);
    }

    // 1. Draw Synapses (Lines) first so circles draw on top
    // Synapse Weights mapping indices:
    // Layer 0 Weights (Input i to Hidden j): weights[i * 6 + j] (0..29)
    // Layer 0 Biases: weights[30..35]
    // Layer 1 Weights (Hidden j to Output k): weights[36 + j * 2 + k] (36..47)
    // Layer 1 Biases: weights[48..49]

    netCtx.lineWidth = 1;

    // Layer 0 Synapses: Input -> Hidden
    for (let i = 0; i < 5; ++i) {
        for (let j = 0; j < 6; ++j) {
            const w = weights[i * 6 + j];
            const weightStrength = Math.abs(w);
            
            // Faint colored connections: Cyan for positive weights, Red for negative weights
            if (w > 0.0) {
                netCtx.strokeStyle = `rgba(6, 182, 212, ${weightStrength * 0.15})`;
            } else {
                netCtx.strokeStyle = `rgba(239, 68, 68, ${weightStrength * 0.12})`;
            }
            
            netCtx.lineWidth = weightStrength * 1.5;
            netCtx.beginPath();
            netCtx.moveTo(nodeX[0], nodeY[0][i]);
            netCtx.lineTo(nodeX[1], nodeY[1][j]);
            netCtx.stroke();
        }
    }

    // Layer 1 Synapses: Hidden -> Output
    for (let j = 0; j < 6; ++j) {
        for (let k = 0; k < 2; ++k) {
            const w = weights[36 + j * 2 + k];
            const weightStrength = Math.abs(w);

            if (w > 0.0) {
                netCtx.strokeStyle = `rgba(168, 85, 247, ${weightStrength * 0.18})`;
            } else {
                netCtx.strokeStyle = `rgba(239, 68, 68, ${weightStrength * 0.12})`;
            }

            netCtx.lineWidth = weightStrength * 1.5;
            netCtx.beginPath();
            netCtx.moveTo(nodeX[1], nodeY[1][j]);
            netCtx.lineTo(nodeX[2], nodeY[2][k]);
            netCtx.stroke();
        }
    }

    // 2. Draw Neuron Nodes (Circles)
    const nodeRadius = 9;

    // Draw Input Nodes (Sensors)
    for (let i = 0; i < 5; ++i) {
        const val = sensors[i]; // Proximity factor: 0.0 (wall close) to 1.0 (clear)
        netCtx.beginPath();
        netCtx.arc(nodeX[0], nodeY[0][i], nodeRadius, 0, Math.PI * 2);

        // Turn red/warning glow when wall is close!
        if (val < 0.4) {
            netCtx.fillStyle = 'rgba(239, 68, 68, 0.9)'; // warning close
            netCtx.strokeStyle = '#ffffff';
            netCtx.lineWidth = 1.5;
            netCtx.shadowBlur = 6;
            netCtx.shadowColor = 'rgba(239, 68, 68, 0.8)';
        } else {
            netCtx.fillStyle = '#0f172a';
            netCtx.strokeStyle = 'rgba(6, 182, 212, 0.6)';
            netCtx.lineWidth = 1;
            netCtx.shadowBlur = 0;
        }
        netCtx.fill();
        netCtx.stroke();
    }

    // Draw Hidden Nodes (simply filled/unfilled nodes)
    netCtx.shadowBlur = 0;
    netCtx.fillStyle = '#0f172a';
    netCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    netCtx.lineWidth = 1;
    for (let j = 0; j < 6; ++j) {
        netCtx.beginPath();
        netCtx.arc(nodeX[1], nodeY[1][j], nodeRadius, 0, Math.PI * 2);
        netCtx.fill();
        netCtx.stroke();
    }

    // Draw Output Nodes: Steering [0] and Gas [1]
    const currentAngle = carData[offset + 2];
    const currentSpeed = carData[offset + 3];

    // Node 0: Steering indicator
    netCtx.beginPath();
    netCtx.arc(nodeX[2], nodeY[2][0], nodeRadius, 0, Math.PI*2);
    netCtx.fillStyle = '#0f172a';
    netCtx.strokeStyle = 'rgba(168, 85, 247, 0.6)';
    netCtx.fill();
    netCtx.stroke();

    // Node 1: Speed / Gas indicator
    netCtx.beginPath();
    netCtx.arc(nodeX[2], nodeY[2][1], nodeRadius, 0, Math.PI*2);
    if (currentSpeed > 1.5) {
        netCtx.fillStyle = 'rgba(16, 185, 129, 0.7)'; // moving fast green
        netCtx.strokeStyle = '#ffffff';
    } else {
        netCtx.fillStyle = '#0f172a';
        netCtx.strokeStyle = 'rgba(168, 85, 247, 0.6)';
    }
    netCtx.fill();
    netCtx.stroke();
}

// --------------------------------------------------------------------------
// Interactive Track Painting & Canvas Mouse Listeners
// --------------------------------------------------------------------------
function getMouseGridPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    return {
        cx: Math.floor(mouseX / cellSize),
        cy: Math.floor(mouseY / cellSize)
    };
}

function handleDrawing(e) {
    if (!sim || !mouseIsDown) return;

    const pos = getMouseGridPos(e);
    if (pos.cx <= 0 || pos.cx >= gridCols - 1 || pos.cy <= 0 || pos.cy >= gridRows - 1) return;

    const gridPtr = sim.getGridPtr();
    const grid = new Uint8Array(Module.HEAPU8.buffer, gridPtr, gridCols * gridRows);

    // Paint a circular brush radius of 2 grid cells (20px width) for easier drawing!
    const brushRadius = currentBrush === 'wall' ? 1 : 1; // standard nice thickness

    for (let dy = -brushRadius; dy <= brushRadius; ++dy) {
        for (let dx = -brushRadius; dx <= brushRadius; ++dx) {
            const ny = pos.cy + dy;
            const nx = pos.cx + dx;
            if (nx <= 0 || nx >= gridCols - 1 || ny <= 0 || ny >= gridRows - 1) continue;

            const gridIdx = ny * gridCols + nx;
            if (currentBrush === 'wall') {
                grid[gridIdx] = 1; // Solid wall
            } else if (currentBrush === 'road') {
                grid[gridIdx] = 0; // Erase wall to create open road
            } else if (currentBrush === 'erase') {
                grid[gridIdx] = 0;
            }
        }
    }
}

canvas.addEventListener('mousedown', e => {
    mouseIsDown = true;
    handleDrawing(e);
});

window.addEventListener('mousemove', e => {
    handleDrawing(e);
});

window.addEventListener('mouseup', () => {
    mouseIsDown = false;
});

// Touch controls mapping
canvas.addEventListener('touchstart', e => {
    if (e.touches.length === 0) return;
    mouseIsDown = true;
    handleDrawing(e.touches[0]);
    e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchmove', e => {
    if (!mouseIsDown || e.touches.length === 0) return;
    handleDrawing(e.touches[0]);
    e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchend', () => {
    mouseIsDown = false;
});

// --------------------------------------------------------------------------
// UI Listeners & Telemetry Triggers
// --------------------------------------------------------------------------

// Switch brushes active classes
document.querySelectorAll('.brush-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.brush-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentBrush = btn.dataset.brush;
    });
});

// Switch map presets active classes
document.querySelectorAll('.map-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.map-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentPreset = btn.id.replace('map-', '');
        loadMapPreset(currentPreset);
    });
});

// Switch simulation speeds
document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        simulationSpeed = parseInt(btn.dataset.speed);
        
        let multiplierText = `${simulationSpeed}x Speed`;
        if (simulationSpeed === 1) multiplierText = '1x Normal';
        document.getElementById('val-speed').textContent = multiplierText;
    });
});

// Bind sliders
document.getElementById('param-mutation-rate').addEventListener('input', e => {
    syncSlidersToWasm();
});

document.getElementById('param-mutation-amount').addEventListener('input', e => {
    syncSlidersToWasm();
});

// Manual Evolve button
document.getElementById('btn-evolve').addEventListener('click', () => {
    if (sim) sim.evolveNextGeneration();
});

// Zap/Mutate button
document.getElementById('btn-shock').addEventListener('click', () => {
    if (sim) {
        sim.triggerSuperMutation();
        console.log("Super Mutation Shock Active!");
    }
});

// Clear track button
document.getElementById('btn-clear-track').addEventListener('click', () => {
    if (sim) {
        sim.reset();
        loadMapPreset('blank'); // Wipe completely
    }
});
