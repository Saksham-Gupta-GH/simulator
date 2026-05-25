#include <emscripten/bind.h>
#include "fluid_solver.h"

using namespace emscripten;

EMSCRIPTEN_BINDINGS(fluid_module) {
    class_<FluidSolver>("FluidSolver")
        .constructor<int, float, float, float>()
        .function("step", &FluidSolver::step)
        .function("addDensity", &FluidSolver::addDensity)
        .function("addVelocity", &FluidSolver::addVelocity)
        .function("setObstacle", &FluidSolver::setObstacle)
        .function("clearObstacles", &FluidSolver::clearObstacles)
        .function("getDensityPtr", &FluidSolver::getDensityPtr)
        .function("getObstaclesPtr", &FluidSolver::getObstaclesPtr)
        .function("getSize", &FluidSolver::getSize)
        .function("getN", &FluidSolver::getN);
}
