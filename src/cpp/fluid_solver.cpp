#include "fluid_solver.h"
#include <algorithm>
#include <cmath>
#include <cstring>

FluidSolver::FluidSolver(int w, int h)
    : width(w), height(h), size(w * h) {
    u.resize(size, 0.0f);
    v.resize(size, 0.0f);
    u_prev.resize(size, 0.0f);
    v_prev.resize(size, 0.0f);

    d.resize(size, 0.0f);
    d_prev.resize(size, 0.0f);

    p.resize(size, 0.0f);
    div.resize(size, 0.0f);

    obstacles.resize(size, 0);
}

void FluidSolver::step(float dt, float viscosity, float wind_speed) {
    // 1. Maintain inlet wind speeds and continuous smoke at the left border
    for (int y = 0; y < height; ++y) {
        // Enforce inlet wind speed at left boundaries
        for (int x = 0; x < 3; ++x) {
            int idx = IX(x, y);
            if (obstacles[idx] == 0) {
                u[idx] = wind_speed;
                v[idx] = 0.0f;
                
                // Inject density stream lines at discrete intervals along Y (to form clean lines)
                if (y % 6 == 0) {
                    d[idx] = 2.0f;
                }
            }
        }
    }

    // 2. Velocity solvers
    // Viscous diffusion
    diffuse(1, u_prev, u, viscosity, dt);
    diffuse(2, v_prev, v, viscosity, dt);

    // Enforce incompressibility (divergence-free flow)
    project(u_prev, v_prev, p, div);

    // Self-advection
    advect(1, u, u_prev, u_prev, v_prev, dt);
    advect(2, v, v_prev, u_prev, v_prev, dt);

    // Re-enforce incompressibility for stability
    project(u, v, p, div);

    // 3. Density (smoke dye) solvers
    diffuse(0, d_prev, d, 0.00001f, dt);
    advect(0, d, d_prev, u, v, dt);

    // Fade density slightly over time to keep screen clean
    for (int i = 0; i < size; ++i) {
        d[i] *= 0.995f;
    }
}

void FluidSolver::add_density(int x, int y, float amount) {
    int idx = IX(x, y);
    if (obstacles[idx] == 0) {
        d[idx] = std::min(d[idx] + amount, 5.0f);
    }
}

void FluidSolver::add_velocity(int x, int y, float amount_u, float amount_v) {
    int idx = IX(x, y);
    if (obstacles[idx] == 0) {
        u[idx] += amount_u;
        v[idx] += amount_v;
    }
}

void FluidSolver::set_obstacle(int x, int y, bool is_blocked) {
    int idx = IX(x, y);
    obstacles[idx] = is_blocked ? 1 : 0;
    if (is_blocked) {
        u[idx] = 0.0f;
        v[idx] = 0.0f;
        d[idx] = 0.0f;
        p[idx] = 0.0f;
    }
}

void FluidSolver::clear_obstacles() {
    std::fill(obstacles.begin(), obstacles.end(), 0);
}

bool FluidSolver::get_obstacle(int x, int y) const {
    return obstacles[IX(x, y)] == 1;
}

// Viscous Diffusion Solver (Jacobi Relaxation)
void FluidSolver::diffuse(int b, std::vector<float>& x, const std::vector<float>& x0, float diff, float dt) {
    // a is a scaling coefficient representing physical diffusion speed
    float a = dt * diff * (width - 2) * (height - 2);
    float c = 1.0f + 4.0f * a;

    // 20 iterations of Jacobi relaxation for convergence stability
    for (int k = 0; k < 20; ++k) {
        for (int j = 1; j < height - 1; ++j) {
            for (int i = 1; i < width - 1; ++i) {
                int idx = IX(i, j);
                if (obstacles[idx] == 1) continue;

                x[idx] = (x0[idx] + a * (x[IX(i - 1, j)] + x[IX(i + 1, j)] +
                                         x[IX(i, j - 1)] + x[IX(i, j + 1)])) / c;
            }
        }
        set_bnd(b, x);
    }
}

// Semi-Lagrangian Advection Solver (Linear Backtracing)
void FluidSolver::advect(int b, std::vector<float>& d_dest, const std::vector<float>& d_src, const std::vector<float>& vel_u, const std::vector<float>& vel_v, float dt) {
    float dt0_x = dt * (width - 2);
    float dt0_y = dt * (height - 2);

    for (int y = 1; y < height - 1; ++y) {
        for (int x = 1; x < width - 1; ++x) {
            int idx = IX(x, y);
            if (obstacles[idx] == 1) {
                d_dest[idx] = 0.0f;
                continue;
            }

            // Backtrace current particle index to find past coordinates (px, py)
            float px = x - dt0_x * vel_u[idx];
            float py = y - dt0_y * vel_v[idx];

            // Enforce screen clamp boundaries
            if (px < 0.5f) px = 0.5f;
            if (px > width - 1.5f) px = width - 1.5f;
            if (py < 0.5f) py = 0.5f;
            if (py > height - 1.5f) py = height - 1.5f;

            // Perform bilinear interpolation of surrounding cells
            int i0 = static_cast<int>(px);
            int i1 = i0 + 1;
            int j0 = static_cast<int>(py);
            int j1 = j0 + 1;

            float s1 = px - i0;
            float s0 = 1.0f - s1;
            float t1 = py - j0;
            float t0 = 1.0f - t1;

            d_dest[idx] = s0 * (t0 * d_src[IX(i0, j0)] + t1 * d_src[IX(i0, j1)]) +
                          s1 * (t0 * d_src[IX(i1, j0)] + t1 * d_src[IX(i1, j1)]);
        }
    }
    set_bnd(b, d_dest);
}

// Incompressibility Projection (Mass Conservation Poisson Solver)
void FluidSolver::project(std::vector<float>& vel_u, std::vector<float>& vel_v, std::vector<float>& press, std::vector<float>& divergence) {
    // 1. Calculate divergence of the velocity field
    float h = 1.0f / std::max(width, height);
    for (int y = 1; y < height - 1; ++y) {
        for (int x = 1; x < width - 1; ++x) {
            int idx = IX(x, y);
            if (obstacles[idx] == 1) {
                divergence[idx] = 0.0f;
                press[idx] = 0.0f;
                continue;
            }
            divergence[idx] = -0.5f * h * (vel_u[IX(x + 1, y)] - vel_u[IX(x - 1, y)] +
                                           vel_v[IX(x, y + 1)] - vel_v[IX(x, y - 1)]);
            press[idx] = 0.0f;
        }
    }
    set_bnd(0, divergence);
    set_bnd(0, press);

    // 2. Solve Poisson pressure equation using Jacobi Relaxation
    for (int k = 0; k < 20; ++k) {
        for (int y = 1; y < height - 1; ++y) {
            for (int x = 1; x < width - 1; ++x) {
                int idx = IX(x, y);
                if (obstacles[idx] == 1) continue;

                press[idx] = (divergence[idx] + press[IX(x - 1, y)] + press[IX(x + 1, y)] +
                              press[IX(x, y - 1)] + press[IX(x, y + 1)]) / 4.0f;
            }
        }
        set_bnd(0, press);
    }

    // 3. Subtract pressure gradient from velocities to make them divergence-free
    for (int y = 1; y < height - 1; ++y) {
        for (int x = 1; x < width - 1; ++x) {
            int idx = IX(x, y);
            if (obstacles[idx] == 1) continue;

            vel_u[idx] -= 0.5f * (press[IX(x + 1, y)] - press[IX(x - 1, y)]) / h;
            vel_v[idx] -= 0.5f * (press[IX(x, y + 1)] - press[IX(x, y - 1)]) / h;
        }
    }
    set_bnd(1, vel_u);
    set_bnd(2, vel_v);
}

// Grid Edges and Internal Obstacles Boundary Conditions
void FluidSolver::set_bnd(int b, std::vector<float>& x) {
    // 1. Enforce Screen Boundary Edges
    for (int i = 1; i < width - 1; ++i) {
        // Top edge: reflect vertical flow
        x[IX(i, 0)] = (b == 2) ? -x[IX(i, 1)] : x[IX(i, 1)];
        // Bottom edge: reflect vertical flow
        x[IX(i, height - 1)] = (b == 2) ? -x[IX(i, height - 2)] : x[IX(i, height - 2)];
    }

    for (int j = 1; j < height - 1; ++j) {
        // Left edge: inlet (handled dynamically in step, slip for other variables)
        x[IX(0, j)] = (b == 1) ? x[IX(1, j)] : x[IX(1, j)];
        // Right edge: open outlet boundary
        x[IX(width - 1, j)] = (b == 1) ? x[IX(width - 2, j)] : x[IX(width - 2, j)];
    }

    // Corner resolution
    x[IX(0, 0)] = 0.5f * (x[IX(1, 0)] + x[IX(0, 1)]);
    x[IX(0, height - 1)] = 0.5f * (x[IX(1, height - 1)] + x[IX(0, height - 2)]);
    x[IX(width - 0, 0)] = 0.5f * (x[IX(width - 2, 0)] + x[IX(width - 1, 1)]);
    x[IX(width - 1, height - 1)] = 0.5f * (x[IX(width - 2, height - 1)] + x[IX(width - 1, height - 2)]);

    // 2. Enforce Internal Obstacle Boundaries
    // We copy values from neighboring active fluid cells to boundary walls to represent slip limits.
    for (int j = 1; j < height - 1; ++j) {
        for (int i = 1; i < width - 1; ++i) {
            int idx = IX(i, j);
            if (obstacles[idx] == 1) {
                // If it is horizontal velocity (b == 1) or vertical velocity (b == 2), force zero speed inside obstacles
                if (b == 1) {
                    // Check neighboring cells to see if they are fluid, reflect or zero-slip
                    float neighbor_sum = 0.0f;
                    float count = 0.0f;
                    if (obstacles[IX(i - 1, j)] == 0) { neighbor_sum += -x[IX(i - 1, j)]; count += 1.0f; }
                    if (obstacles[IX(i + 1, j)] == 0) { neighbor_sum += -x[IX(i + 1, j)]; count += 1.0f; }
                    x[idx] = (count > 0.0f) ? (neighbor_sum / count) : 0.0f;
                }
                else if (b == 2) {
                    float neighbor_sum = 0.0f;
                    float count = 0.0f;
                    if (obstacles[IX(i, j - 1)] == 0) { neighbor_sum += -x[IX(i, j - 1)]; count += 1.0f; }
                    if (obstacles[IX(i, j + 1)] == 0) { neighbor_sum += -x[IX(i, j + 1)]; count += 1.0f; }
                    x[idx] = (count > 0.0f) ? (neighbor_sum / count) : 0.0f;
                }
                else {
                    // For pressure (b == 0) or density (b == 0), copy neighbor value to block bleeding
                    int fluid_count = 0;
                    float accum = 0.0f;
                    if (obstacles[IX(i - 1, j)] == 0) { accum += x[IX(i - 1, j)]; fluid_count++; }
                    if (obstacles[IX(i + 1, j)] == 0) { accum += x[IX(i + 1, j)]; fluid_count++; }
                    if (obstacles[IX(i, j - 1)] == 0) { accum += x[IX(i, j - 1)]; fluid_count++; }
                    if (obstacles[IX(i, j + 1)] == 0) { accum += x[IX(i, j + 1)]; fluid_count++; }

                    x[idx] = (fluid_count > 0) ? (accum / fluid_count) : 0.0f;
                }
            }
        }
    }
}
