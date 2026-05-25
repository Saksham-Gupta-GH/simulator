const fs = require('fs');
const wasmContent = fs.readFileSync('./src/web/public/wasm/fluid_sim.js', 'utf8');

// We just load the WASM module without DOM
const ModuleInit = require('./src/web/public/wasm/fluid_sim.js');

ModuleInit().then(module => {
    console.log("Module loaded.");
    const sim = new module.Simulation(150, 100);
    console.log("UPtr:", sim.getUPtr());
    console.log("VPtr:", sim.getVPtr());
    console.log("PPtr:", sim.getPressurePtr());
    console.log("DPtr:", sim.getDensityPtr());
    console.log("ObsPtr:", sim.getObstaclePtr());
    console.log("PartPtr:", sim.getParticlesPtr());
}).catch(err => {
    console.error(err);
});
