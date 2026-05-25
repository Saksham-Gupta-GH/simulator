const ModuleInit = require('./src/web/public/wasm/fluid_sim.js');

ModuleInit().then(module => {
    console.log("HEAPU8:", typeof module.HEAPU8);
    console.log("HEAPF32:", typeof module.HEAPF32);
    console.log("wasmMemory:", typeof module.wasmMemory);
    console.log("Keys:", Object.keys(module));
});
