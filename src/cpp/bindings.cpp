#include <emscripten/bind.h>
#include "simulation.h"
#include <cstdint>

using namespace emscripten;

EMSCRIPTEN_BINDINGS(aerodynamics_simulation) {
    class_<Simulation>("Simulation")
        .constructor<int, int>()
        .function("update", &Simulation::update)
        .function("drawObstacleBrush", &Simulation::draw_obstacle_brush)
        .function("resetSimulation", &Simulation::reset_simulation)
        .function("clearAllObstacles", &Simulation::clear_all_obstacles)
        .function("loadPreset", &Simulation::load_preset)
        .function("setAngleOfAttack", &Simulation::set_angle_of_attack)
        
        .function("getParticlesPtr", &Simulation::get_particles_ptr)
        .function("getParticleCount", &Simulation::get_particle_count)
        .function("getUPtr", &Simulation::get_u_ptr)
        .function("getVPtr", &Simulation::get_v_ptr)
        .function("getPressurePtr", &Simulation::get_pressure_ptr)
        .function("getDensityPtr", &Simulation::get_density_ptr)
        .function("getObstaclePtr", &Simulation::get_obstacle_ptr)
        
        // Telemetry
        .function("getDragCoefficient", &Simulation::get_drag_coefficient)
        .function("getLiftCoefficient", &Simulation::get_lift_coefficient)
        .function("getReynoldsNumber", &Simulation::get_reynolds_number);
}
