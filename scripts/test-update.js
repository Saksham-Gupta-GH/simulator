const fs = require('fs');
const ModuleInit = require('./src/web/public/wasm/fluid_sim.js');

ModuleInit().then(module => {
    console.log("Module loaded. Starting update loop.");
    const sim = new module.Simulation(150, 100);
    
    try {
        for (let i = 0; i < 100; i++) {
            sim.update(0.05, 0.001, 1.8);
        }
        console.log("Update loop succeeded.");
    } catch(e) {
        console.error("Crash during update:", e);
    }
});
