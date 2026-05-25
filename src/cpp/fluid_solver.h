#ifndef FLUID_SOLVER_H
#define FLUID_SOLVER_H

#include <vector>

class FluidSolver {
public:
    FluidSolver(int w, int h);
    ~FluidSolver() = default;

    // Advance the simulation grid by timestep dt
    void step(float dt, float viscosity, float wind_speed);

    // Emitters and interaction
    void add_density(int x, int y, float amount);
    void add_velocity(int x, int y, float amount_u, float amount_v);
    
    // Obstacle setup
    void set_obstacle(int x, int y, bool is_blocked);
    void clear_obstacles();
    bool get_obstacle(int x, int y) const;

    // Getters for direct memory access
    int get_width() const { return width; }
    int get_height() const { return height; }
    const std::vector<float>& get_u() const { return u; }
    const std::vector<float>& get_v() const { return v; }
    const std::vector<float>& get_pressure() const { return p; }
    const std::vector<float>& get_density() const { return d; }

    // Direct raw float pointers (for WebAssembly bindings)
    float* get_u_ptr() { return u.data(); }
    float* get_v_ptr() { return v.data(); }
    float* get_pressure_ptr() { return p.data(); }
    float* get_density_ptr() { return d.data(); }
    uint8_t* get_obstacle_ptr() { return obstacles.data(); }

private:
    int width;
    int height;
    int size;

    // Core float grids
    std::vector<float> u;       // Horizontal velocity
    std::vector<float> v;       // Vertical velocity
    std::vector<float> u_prev;  // Prev horizontal velocity
    std::vector<float> v_prev;  // Prev vertical velocity

    std::vector<float> d;       // Fluid density (smoke dye)
    std::vector<float> d_prev;  // Prev density

    std::vector<float> p;       // Pressure grid (solved via Poisson)
    std::vector<float> div;     // Divergence grid (helper for pressure)

    // Obstacle grid mask (1 = obstacle, 0 = fluid)
    std::vector<uint8_t> obstacles;

    // Helper functions for Jos Stam Stable Fluids Solver
    void diffuse(int b, std::vector<float>& x, const std::vector<float>& x0, float diff, float dt);
    void advect(int b, std::vector<float>& d_dest, const std::vector<float>& d_src, const std::vector<float>& vel_u, const std::vector<float>& vel_v, float dt);
    void project(std::vector<float>& vel_u, std::vector<float>& vel_v, std::vector<float>& press, std::vector<float>& divergence);
    
    // Handles fluid grid borders and internal obstacle boundaries
    void set_bnd(int b, std::vector<float>& x);

    // Map 2D coordinate to 1D index
    inline int IX(int x, int y) const {
        if (x < 0) x = 0;
        if (x >= width) x = width - 1;
        if (y < 0) y = 0;
        if (y >= height) y = height - 1;
        return x + y * width;
    }
};

#endif // FLUID_SOLVER_H
