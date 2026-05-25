#include <emscripten/bind.h>
#include "fluid_solver.h"

using namespace emscripten;

EMSCRIPTEN_BINDINGS(fluid_sim_module) {
    class_<FluidSolver>("FluidSolver")
        .constructor<int, float, float, float>()
        .function("step", &FluidSolver::step)
        .function("addDensity", &FluidSolver::addDensity)
        .function("addVelocity", &FluidSolver::addVelocity)
        .function("setObstacle", &FluidSolver::setObstacle)
        .function("clearObstacles", &FluidSolver::clearObstacles)
        .function("setViscosity", &FluidSolver::setViscosity)
        .function("setDiffusion", &FluidSolver::setDiffusion)
        
        .function("getDensityRPtr", &FluidSolver::getDensityRPtr, allow_raw_pointers())
        .function("getDensityGPtr", &FluidSolver::getDensityGPtr, allow_raw_pointers())
        .function("getDensityBPtr", &FluidSolver::getDensityBPtr, allow_raw_pointers())
        
        .function("getVxPtr", &FluidSolver::getVxPtr, allow_raw_pointers())
        .function("getVyPtr", &FluidSolver::getVyPtr, allow_raw_pointers())
        
        .function("getObstaclesPtr", &FluidSolver::getObstaclesPtr, allow_raw_pointers())
        .function("getObsRPtr", &FluidSolver::getObsRPtr, allow_raw_pointers())
        .function("getObsGPtr", &FluidSolver::getObsGPtr, allow_raw_pointers())
        .function("getObsBPtr", &FluidSolver::getObsBPtr, allow_raw_pointers())
        
        .function("getSize", &FluidSolver::getSize);
}
