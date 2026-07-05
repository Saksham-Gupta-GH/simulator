const ModuleInit = require('./src/web/public/wasm/fluid_sim.js');
ModuleInit().then(module => {
    const sim = new module.Simulation(150, 100);
    console.log("Exports:");
    for (let key in sim) {
        console.log(key);
    }
});
