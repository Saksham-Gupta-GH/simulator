const fs = require('fs');
const vm = require('vm');

const appJs = fs.readFileSync('src/web/public/app.js', 'utf8');

const createMockNode = () => {
    const node = {
        appendChild: () => {},
        addEventListener: () => {},
        innerHTML: '',
        innerText: '',
        style: {},
        classList: { add: () => {}, remove: () => {} }
    };
    return node;
};

const sandbox = {
    document: {
        createElement: (tag) => {
            const node = createMockNode();
            if (tag === 'canvas') {
                node.getContext = () => ({
                    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
                    putImageData: () => {},
                    drawImage: () => {},
                    beginPath: () => {},
                    arc: () => {},
                    fill: () => {},
                    stroke: () => {},
                    moveTo: () => {},
                    lineTo: () => {},
                    fillText: () => {},
                    measureText: () => ({ width: 10 }),
                    setLineDash: () => {},
                    clearRect: () => {},
                });
            }
            return node;
        },
        getElementById: (id) => {
            const node = createMockNode();
            node.getContext = () => ({
                createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
                putImageData: () => {},
                drawImage: () => {},
                beginPath: () => {},
                arc: () => {},
                fill: () => {},
                stroke: () => {},
                moveTo: () => {},
                lineTo: () => {},
                fillText: () => {},
                measureText: () => ({ width: 10 }),
                setLineDash: () => {},
                clearRect: () => {},
            });
            return node;
        }
    },
    window: {
        addEventListener: () => {}
    },
    performance: { now: () => 1000 },
    requestAnimationFrame: (cb) => { sandbox.queuedCb = cb; },
    Math: Math,
    parseInt: parseInt,
    Float32Array: Float32Array,
    Uint8Array: Uint8Array,
    Uint8ClampedArray: Uint8ClampedArray,
    console: console,
    createFluidSimModule: async () => {
        return {
            FluidSolver: class {
                constructor() {}
                getSize() { return 40000; }
                getDensityRPtr() { return 0; }
                getDensityGPtr() { return 40000*4; }
                getDensityBPtr() { return 80000*4; }
                getObstaclesPtr() { return 120000*4; }
                getObsRPtr() { return 120000*4 + 40000; }
                getObsGPtr() { return 120000*4 + 80000; }
                getObsBPtr() { return 120000*4 + 120000; }
                setObstacle() {}
                addDensity() {}
                step() {}
            },
            HEAPF32: new Float32Array(200000),
            HEAPU8: new Uint8Array(200000 * 4)
        };
    }
};

vm.createContext(sandbox);
vm.runInContext(appJs, sandbox);

setTimeout(async () => {
    console.log("Simulating first render frame...");
    if (sandbox.queuedCb) {
        try {
            sandbox.queuedCb();
            console.log("Render successful!");
        } catch (e) {
            console.error("RENDER ERROR:", e);
        }
    } else {
        console.log("No render queued.");
    }
}, 500);
