#include <emscripten/bind.h>
#include "evolution_manager.h"

using namespace emscripten;

EMSCRIPTEN_BINDINGS(ai_driving_module) {
    // Register std::vector<float> to pass arrays between JS and C++
    register_vector<float>("VectorFloat");

    class_<EvolutionManager>("EvolutionManager")
        .constructor<int, float, float, float>()
        .function("setTrackBoundaries", &EvolutionManager::setTrackBoundaries)
        .function("update", &EvolutionManager::update)
        .function("allDead", &EvolutionManager::allDead)
        .function("nextGeneration", &EvolutionManager::nextGeneration)
        .function("getCarDataPtr", &EvolutionManager::getCarDataPtr)
        .function("getCarDataSize", &EvolutionManager::getCarDataSize)
        .function("getAliveCount", &EvolutionManager::getAliveCount)
        .function("getCurrentMaxFitness", &EvolutionManager::getCurrentMaxFitness)
        .function("getBestBrainWeights", &EvolutionManager::getBestBrainWeights)
        .property("generation", &EvolutionManager::generation)
        .property("maxFitnessAllTime", &EvolutionManager::maxFitnessAllTime);
}
