#ifndef SIMULATION_H
#define SIMULATION_H

#include "fluid_solver.h"
#include <vector>
#include <random>

#include <cstdint>

struct Particle {
    float x, y;
    float speed;
};

class Simulation {
public:
    Simulation(int w, int h);
    ~Simulation() = default;

    // Core execution loop
    void update(float dt, float viscosity, float wind_speed);
    
    // UI Brush controls
    void draw_obstacle_brush(int cx, int cy, int radius, bool draw);
    void reset_simulation();
    void clear_all_obstacles();

    // Preset shapes triggers
    void load_preset(int preset_id);
    void set_angle_of_attack(float angle_deg);

    // Getters for JavaScript zero-copy blitting
    uintptr_t get_particles_ptr() { return reinterpret_cast<uintptr_t>(flat_particles.data()); }
    int get_particle_count() const { return particles.size(); }

    uintptr_t get_u_ptr() { return reinterpret_cast<uintptr_t>(solver.get_u_ptr()); }
    uintptr_t get_v_ptr() { return reinterpret_cast<uintptr_t>(solver.get_v_ptr()); }
    uintptr_t get_pressure_ptr() { return reinterpret_cast<uintptr_t>(solver.get_pressure_ptr()); }
    uintptr_t get_density_ptr() { return reinterpret_cast<uintptr_t>(solver.get_density_ptr()); }
    uintptr_t get_obstacle_ptr() { return reinterpret_cast<uintptr_t>(solver.get_obstacle_ptr()); }

    // Telemetry getters
    float get_drag_coefficient() const { return drag_coeff; }
    float get_lift_coefficient() const { return lift_coeff; }
    float get_reynolds_number() const { return reynolds; }

private:
    FluidSolver solver;
    int width;
    int height;

    // Dynamic Smoke Particle System
    std::vector<Particle> particles;
    std::vector<float> flat_particles; // Flattened format [x1, y1, speed1, x2, y2, speed2, ...]
    
    std::mt19937 rng;
    std::uniform_real_distribution<float> dist_y;
    std::uniform_real_distribution<float> dist_x;

    // Shape preset settings
    int current_preset;
    float angle_of_attack_deg;

    // Telemetry registers
    float drag_coeff;
    float lift_coeff;
    float reynolds;

    // Helper functions
    void init_particles();
    void update_particles(float dt);
    
    // Calculates aerodynamic pressure boundary integrals
    void compute_aerodynamics(float wind_speed);

    // Coordinate rotation math helper
    void rotate_point(float x, float y, float cx, float cy, float angle_rad, float& rx, float& ry) const;

    // Shape outlines generator
    void build_preset_airfoil(float length, float camber_thickness, float chord_x, float chord_y, bool is_asymmetric);
    void build_preset_f1_car(float cx, float cy, float scale);
    void build_preset_bullet_vs_block(float cx, float cy, bool is_bullet);
};

#endif // SIMULATION_H
