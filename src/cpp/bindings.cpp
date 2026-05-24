#include <emscripten/bind.h>
#include "simulation.h"

using namespace emscripten;

EMSCRIPTEN_BINDINGS(self_driving_car_simulation_bindings) {
    class_<Simulation>("Simulation")
        .constructor<int>()
        
        // Simulation steps & controls
        .function("step", &Simulation::step)
        .function("evolveNextGeneration", &Simulation::evolveNextGeneration)
        .function("reset", &Simulation::reset)
        .function("triggerSuperMutation", &Simulation::triggerSuperMutation)
        
        // Shared heap pointer lookups (ZERO-COPY memory mapping)
        .function("getGridPtr", &Simulation::getGridPtr)
        .function("getCarCoordinatesPtr", &Simulation::getCarCoordinatesPtr)
        .function("getBestBrainWeightsPtr", &Simulation::getBestBrainWeightsPtr)
        .function("getBestBrainWeightsSize", &Simulation::getBestBrainWeightsSize)
        
        // Telemetry getters
        .property("generationCount", &Simulation::getGenerationCount)
        .property("populationSize", &Simulation::getPopulationSize)
        .property("activeCarsCount", &Simulation::getActiveCarsCount)
        .property("maxFitness", &Simulation::getMaxFitness)
        .property("bestCarIdx", &Simulation::bestCarIdx)
        
        // Custom environmental variables (sliders)
        .property("mutationRate", &Simulation::getMutationRate, &Simulation::setMutationRate)
        .property("mutationAmount", &Simulation::getMutationAmount, &Simulation::setMutationAmount)
        .property("startX", &Simulation::getStartX, &Simulation::setStartX)
        .property("startY", &Simulation::getStartY, &Simulation::setStartY)
        ;
}
