// ==========================================================================
// AeroFlow AI - Wind Tunnel JavaScript Integration Layer (Zero-Copy WebAssembly)
// ==========================================================================

let sim = null;
let moduleRef = null;

// Grid configuration matching C++ backend constants
const gridWidth = 150;
const gridHeight = 100;
const gridSize = gridWidth * gridHeight;
const cellScale = 6; // Scale grid up to fit the 900x600 canvas

// UI active status registers
let activeBrush = 'barrier'; // 'barrier', 'emitter', 'erase'
let activeVis = 'smoke';      // 'smoke', 'pressure', 'vector'
let activeSpeedMultiplier = 1;
let activePreset = 0;

// Mouse drawing states
let isDrawing = false;
let brushRadius = 2;

// Real-time efficiency chart history arrays
const ldHistory = [];
const maxHistoryLength = 150;

// Initialize Emscripten WebAssembly core loader
createFluidSimModule({
    locateFile: (path) => path.endsWith('.wasm') ? 'wasm/' + path : path
}).then((module) => {
    moduleRef = module;
    
    // Allocate the unified Simulation engine in C++ heap
    sim = new module.Simulation(gridWidth, gridHeight);
    
    console.log("AeroFlow AI C++ WebAssembly Physics Engine loaded successfully!");
    
    // Initialize user controls, presets, and start the render loops
    initControls();
    startSimulationLoop();
});

// Setup DOM UI selectors and interaction triggers
function initControls() {
    // 1. Brush buttons
    const brushButtons = document.querySelectorAll('.brush-btn[data-brush]');
    brushButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            brushButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeBrush = btn.getAttribute('data-brush');
        });
    });

    // 2. Vis Layer buttons
    const visButtons = document.querySelectorAll('.brush-btn[data-vis]');
    visButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            visButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeVis = btn.getAttribute('data-vis');
        });
    });

    // 3. Preset selectors
    const presetButtons = document.querySelectorAll('.map-btn');
    const aoaContainer = document.getElementById('aoa-container');
    const aoaSlider = document.getElementById('param-aoa');
    const aoaValueLabel = document.getElementById('val-aoa');

    presetButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            presetButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            activePreset = parseInt(btn.getAttribute('data-preset'));
            sim.loadPreset(activePreset);
            
            // Show/Hide Angle of Attack tuning panel based on loaded shapes
            if (activePreset !== 0) {
                aoaContainer.style.display = 'block';
                // Reset angle slider when switching presets
                aoaSlider.value = 0;
                aoaValueLabel.innerText = '0°';
                sim.setAngleOfAttack(0);
            } else {
                aoaContainer.style.display = 'none';
            }

            // Flush telemetry graphs
            ldHistory.length = 0;
        });
    });

    // 4. Angle of Attack Slider
    aoaSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        aoaValueLabel.innerText = (val > 0 ? '+' : '') + val + '°';
        sim.setAngleOfAttack(val);
    });

    // 5. Physics Step Multiplier (Speed)
    const speedButtons = document.querySelectorAll('.speed-btn');
    const speedValLabel = document.getElementById('val-speed');
    speedButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            speedButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeSpeedMultiplier = parseInt(btn.getAttribute('data-speed'));
            speedValLabel.innerText = activeSpeedMultiplier + 'x Hyperspeed';
        });
    });

    // 6. Wind Speed Slider
    const windSlider = document.getElementById('param-wind-speed');
    const windLabel = document.getElementById('val-wind-speed');
    windSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        windLabel.innerText = val.toFixed(1) + ' m/s';
    });

    // 7. Viscosity Slider
    const viscositySlider = document.getElementById('param-viscosity');
    const viscosityLabel = document.getElementById('val-viscosity');
    viscositySlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        viscosityLabel.innerText = val.toFixed(4);
    });

    // 8. Trigger Buttons
    document.getElementById('btn-clear-barriers').addEventListener('click', () => {
        sim.clearAllObstacles();
        presetButtons.forEach(b => b.classList.remove('active'));
        document.getElementById('preset-blank').classList.add('active');
        aoaContainer.style.display = 'none';
        activePreset = 0;
        ldHistory.length = 0;
    });

    document.getElementById('btn-reset-fluid').addEventListener('click', () => {
        sim.resetSimulation();
        presetButtons.forEach(b => b.classList.remove('active'));
        document.getElementById('preset-blank').classList.add('active');
        aoaContainer.style.display = 'none';
        activePreset = 0;
        ldHistory.length = 0;
    });

    // 9. Canvas drawing events setup
    const canvas = document.getElementById('sim-canvas');
    canvas.addEventListener('mousedown', (e) => {
        isDrawing = true;
        handleDraw(e);
    });
    
    canvas.addEventListener('mousemove', (e) => {
        if (isDrawing) {
            handleDraw(e);
        }
    });

    window.addEventListener('mouseup', () => {
        isDrawing = false;
    });

    // Support mobile touch gestures
    canvas.addEventListener('touchstart', (e) => {
        isDrawing = true;
        handleDraw(e.touches[0]);
        e.preventDefault();
    });
    
    canvas.addEventListener('touchmove', (e) => {
        if (isDrawing) {
            handleDraw(e.touches[0]);
            e.preventDefault();
        }
    });

    canvas.addEventListener('touchend', () => {
        isDrawing = false;
    });
}

// Coordinates brush coordinates translation onto C++ simulation grid
function handleDraw(e) {
    const canvas = document.getElementById('sim-canvas');
    const rect = canvas.getBoundingClientRect();
    
    // Calculate click coordinates relative to screen dimensions
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;
    
    // Scale down coordinates to fit 150x100 physics coordinates
    const gridX = Math.floor(clickX / cellScale);
    const gridY = Math.floor(clickY / cellScale);

    if (gridX >= 0 && gridX < gridWidth && gridY >= 0 && gridY < gridHeight) {
        if (activeBrush === 'barrier') {
            sim.drawObstacleBrush(gridX, gridY, brushRadius, true);
        } else if (activeBrush === 'erase') {
            sim.drawObstacleBrush(gridX, gridY, brushRadius, false);
        } else if (activeBrush === 'emitter') {
            // Click to inject custom density dyes (drawn in high columns)
            for (let intOffset = -2; intOffset <= 2; intOffset++) {
                const cy = gridY + intOffset;
                if (cy >= 0 && cy < gridHeight) {
                    // We interact with density fields by drawing them directly
                    // To do this, JS triggers density adds via solver pointer
                    const densityPtr = sim.getDensityPtr();
                    const HEAPF32 = moduleRef.HEAPF32;
                    const idx = gridX + cy * gridWidth;
                    HEAPF32[densityPtr / 4 + idx] = 4.0; // feed intense smoke dye
                }
            }
        }
    }
}

// Main physics execution and graphic rendering loops
function startSimulationLoop() {
    const canvas = document.getElementById('sim-canvas');
    const ctx = canvas.getContext('2d');
    
    const chartCanvas = document.getElementById('network-canvas');
    const chartCtx = chartCanvas.getContext('2d');

    // Setup an offscreen buffer for lightning-fast pressure heatmap renders
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = gridWidth;
    offscreenCanvas.height = gridHeight;
    const offscreenCtx = offscreenCanvas.getContext('2d');
    const offscreenImgData = offscreenCtx.createImageData(gridWidth, gridHeight);

    // Active DOM telemetry references
    const dragLabel = document.getElementById('stat-drag');
    const liftLabel = document.getElementById('stat-lift');
    const reynoldsLabel = document.getElementById('stat-reynolds');

    const dt = 0.05; // Timestep step

    function frame() {
        // Read current slider states to feed into C++ steps
        const windSpeed = parseFloat(document.getElementById('param-wind-speed').value);
        const viscosity = parseFloat(document.getElementById('param-viscosity').value);

        // 1. Advance C++ physics simulation by active speed multiplier
        for (let s = 0; s < activeSpeedMultiplier; ++s) {
            sim.update(dt, viscosity, windSpeed);
        }

        // 2. Perform zero-copy pointer wraps
        const HEAPU8 = moduleRef.HEAPU8;
        const HEAPF32 = moduleRef.HEAPF32;

        const uPtr = sim.getUPtr();
        const vPtr = sim.getVPtr();
        const pPtr = sim.getPressurePtr();
        const dPtr = sim.getDensityPtr();
        const obsPtr = sim.getObstaclePtr();
        const partPtr = sim.getParticlesPtr();
        const partCount = sim.getParticleCount();

        // Directly reference subarrays on WebAssembly memory heap without copying data!
        const obstacles = new Uint8Array(HEAPU8.buffer, obsPtr, gridSize);
        const pressures = new Float32Array(HEAPF32.buffer, pPtr, gridSize);
        const densities = new Float32Array(HEAPF32.buffer, dPtr, gridSize);
        const velocitiesU = new Float32Array(HEAPF32.buffer, uPtr, gridSize);
        const velocitiesV = new Float32Array(HEAPF32.buffer, vPtr, gridSize);
        const particles = new Float32Array(HEAPF32.buffer, partPtr, partCount * 3);

        // 3. Clear canvas and draw visualizations
        ctx.fillStyle = '#080b11';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Render backgrounds layers depending on active vis selection
        if (activeVis === 'pressure') {
            // PRESSURE HEATMAP: Scale pressure values to glowing color arrays
            const data = offscreenImgData.data;
            for (let i = 0; i < gridSize; ++i) {
                if (obstacles[i] === 1) {
                    // Obstacles rendered as dark charcoal
                    data[i * 4] = 13;     // R
                    data[i * 4 + 1] = 17; // G
                    data[i * 4 + 2] = 25; // B
                    data[i * 4 + 3] = 255;
                    continue;
                }
                
                // Normalizing pressures around baseline
                const pVal = pressures[i] * 12.0; 
                
                let r = 0, g = 0, b = 0;
                if (pVal > 0) {
                    // High pressure -> glowing orange/red
                    r = Math.min(255, Math.floor(pVal * 190 + 20));
                    g = Math.min(255, Math.floor(pVal * 60));
                    b = Math.min(255, Math.floor(pVal * 10));
                } else {
                    // Low pressure (vacuum suction) -> deep indigo/violet
                    const nVal = Math.abs(pVal);
                    r = Math.min(255, Math.floor(nVal * 60));
                    g = Math.min(255, Math.floor(nVal * 30));
                    b = Math.min(255, Math.floor(nVal * 220 + 40));
                }

                // Add faint baseline ambient cyan to normal channels
                data[i * 4] = Math.max(r, 6);
                data[i * 4 + 1] = Math.max(g, 15);
                data[i * 4 + 2] = Math.max(b, 25);
                data[i * 4 + 3] = 255;
            }
            
            // Push offscreen pixel buffer onto offscreen canvas
            offscreenCtx.putImageData(offscreenImgData, 0, 0);
            
            // Scale the offscreen canvas up onto the 900x600 canvas using GPU bilinear interpolation
            ctx.imageSmoothingEnabled = true;
            ctx.drawImage(offscreenCanvas, 0, 0, canvas.width, canvas.height);
            
        } else if (activeVis === 'vector') {
            // VELOCITY VECTORS: Draw simple velocity direction arrows
            ctx.strokeStyle = 'rgba(6, 182, 212, 0.22)';
            ctx.lineWidth = 1;
            
            const stride = 5; // Draw vectors at every 5th cell to prevent visual overcrowding
            for (let y = 2; y < gridHeight - 2; y += stride) {
                for (let x = 2; x < gridWidth - 2; x += stride) {
                    const idx = x + y * gridWidth;
                    if (obstacles[idx] === 1) continue;

                    const uVal = velocitiesU[idx] * 8.0;
                    const vVal = velocitiesV[idx] * 8.0;
                    const speed = Math.sqrt(uVal * uVal + vVal * vVal);

                    const startX = x * cellScale + cellScale / 2;
                    const startY = y * cellScale + cellScale / 2;

                    ctx.beginPath();
                    ctx.moveTo(startX, startY);
                    ctx.lineTo(startX + uVal * cellScale, startY + vVal * cellScale);
                    ctx.stroke();
                }
            }
        }

        // Render flowing smoke streamlines (Particles)
        if (activeVis === 'smoke') {
            // Draw 8,000 glowing vector smoke particles
            for (let i = 0; i < partCount; ++i) {
                const px = particles[i * 3] * cellScale;
                const py = particles[i * 3 + 1] * cellScale;
                const speed = particles[i * 3 + 2] * 2.8;

                // Colorize streamlines dynamically based on speed (Bernoulli coloring!)
                let color = 'rgba(6, 182, 212, 0.42)'; // cyan default (standard speed)
                if (speed > 4.5) {
                    color = 'rgba(168, 85, 247, 0.65)'; // Violet/Purple (accelerated flow / lift)
                } else if (speed < 0.6) {
                    color = 'rgba(249, 115, 22, 0.40)'; // Amber/Orange (wake turbulence stagnation)
                }

                ctx.fillStyle = color;
                ctx.fillRect(px, py, 1.5, 1.5);
            }
        } else {
            // Draw faint smoke streamlines on top of pressure or vector modes to preserve reference flow
            ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
            for (let i = 0; i < partCount; i += 2) {
                const px = particles[i * 3] * cellScale;
                const py = particles[i * 3 + 1] * cellScale;
                ctx.fillRect(px, py, 1.0, 1.0);
            }
        }

        // 4. Paint rigid solid obstacles on top (Paint barriers)
        ctx.fillStyle = '#0d1119';
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 1.5;

        for (let y = 1; y < gridHeight - 1; ++y) {
            for (let x = 1; x < gridWidth - 1; ++x) {
                const idx = x + y * gridWidth;
                if (obstacles[idx] === 1) {
                    const startX = x * cellScale;
                    const startY = y * cellScale;
                    
                    ctx.fillRect(startX, startY, cellScale, cellScale);
                    
                    // Draw outer border outlines for neighboring fluid faces
                    if (obstacles[idx - 1] === 0 || obstacles[idx + 1] === 0 || 
                        obstacles[idx - gridWidth] === 0 || obstacles[idx + gridWidth] === 0) {
                        ctx.strokeRect(startX, startY, cellScale, cellScale);
                    }
                }
            }
        }

        // 5. Update Telemetry displays
        const dragVal = sim.getDragCoefficient();
        const liftVal = sim.getLiftCoefficient();
        const reynoldsVal = Math.round(sim.getReynoldsNumber());

        dragLabel.innerText = dragVal.toFixed(3);
        liftLabel.innerText = liftVal.toFixed(3);
        reynoldsLabel.innerText = reynoldsVal.toLocaleString();

        // Style telemetry labels based on active aero states (F1 downforce warning)
        if (liftVal < -0.05) {
            liftLabel.className = "stat-val text-orange";
            liftLabel.innerText = liftVal.toFixed(3) + " DF"; // Downforce
        } else if (liftVal > 0.05) {
            liftLabel.className = "stat-val text-cyan";
        } else {
            liftLabel.className = "stat-val";
        }

        // Calculate and push active Lift-to-Drag ratio to history array
        const ldRatio = (Math.abs(dragVal) > 0.002) ? (liftVal / dragVal) : 0.0;
        ldHistory.push(ldRatio);
        if (ldHistory.length > maxHistoryLength) {
            ldHistory.shift();
        }

        // 6. Render real-time Efficiency Line Chart
        renderEfficiencyChart(chartCtx, chartCanvas);

        requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
}

// Draw the beautiful scrolling line graph
function renderEfficiencyChart(ctx, canvas) {
    ctx.fillStyle = '#04070d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid references lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    
    // Baseline zero line
    const zeroY = canvas.height / 2;
    ctx.beginPath();
    ctx.moveTo(0, zeroY);
    ctx.lineTo(canvas.width, zeroY);
    ctx.stroke();

    // High efficiency positive baseline line
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.06)';
    ctx.beginPath();
    ctx.moveTo(0, zeroY - 40);
    ctx.lineTo(canvas.width, zeroY - 40);
    ctx.moveTo(0, zeroY + 40);
    ctx.lineTo(canvas.width, zeroY + 40);
    ctx.stroke();

    if (ldHistory.length < 2) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px "Share Tech Mono"';
        ctx.fillText("WAITING FOR COMPONENT TELEMETRY...", canvas.width / 2 - 100, zeroY + 4);
        return;
    }

    // Draw historical line plot
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.85)'; // Emerald line
    ctx.lineWidth = 2;
    ctx.beginPath();

    const stepX = canvas.width / (maxHistoryLength - 1);
    
    // Find absolute max in history to scale graph cleanly
    let maxVal = 0.5;
    for (let i = 0; i < ldHistory.length; ++i) {
        maxVal = Math.max(maxVal, Math.abs(ldHistory[i]));
    }
    
    // Smooth scaling envelope
    const scaleY = (canvas.height / 2 - 12) / maxVal;

    for (let i = 0; i < ldHistory.length; ++i) {
        const x = i * stepX;
        const y = zeroY - ldHistory[i] * scaleY;
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.stroke();

    // Render current L/D value label on graph
    const latestVal = ldHistory[ldHistory.length - 1];
    ctx.fillStyle = latestVal >= 0.01 ? '#10b981' : (latestVal <= -0.01 ? '#f97316' : '#94a3b8');
    ctx.font = 'bold 12px "Share Tech Mono"';
    ctx.fillText("L/D RATIO: " + (latestVal >= 0 ? '+' : '') + latestVal.toFixed(2), 15, 20);
}
