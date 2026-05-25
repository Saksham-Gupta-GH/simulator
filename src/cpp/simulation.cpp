#include "simulation.h"
#include <cmath>
#include <algorithm>
#include <iostream>

Simulation::Simulation(int w, int h)
    : solver(w, h), width(w), height(h), current_preset(0), angle_of_attack_deg(0.0f),
      drag_coeff(0.0f), lift_coeff(0.0f), reynolds(0.0f) {
    
    // Seed randomness
    std::random_device rd;
    rng.seed(rd());
    dist_y = std::uniform_real_distribution<float>(1.0f, h - 2.0f);
    dist_x = std::uniform_real_distribution<float>(1.0f, w - 2.0f);

    init_particles();
}

void Simulation::update(float dt, float viscosity, float wind_speed) {
    // 1. Advance fluid velocity and pressure solver
    solver.step(dt, viscosity, wind_speed);

    // 2. Advect flowing smoke particles along velocity grid
    update_particles(dt);

    // 3. Compute dynamic aerodynamic coefficients (Drag & Lift forces)
    compute_aerodynamics(wind_speed);

    // 4. Calculate dynamic Reynolds Number
    reynolds = (wind_speed * 12.0f * width) / (viscosity * 40.0f + 0.02f);
}

void Simulation::init_particles() {
    int particle_count = 8000;
    particles.resize(particle_count);
    flat_particles.resize(particle_count * 3, 0.0f);

    for (int i = 0; i < particle_count; ++i) {
        particles[i].x = dist_x(rng);
        particles[i].y = dist_y(rng);
        particles[i].speed = 0.0f;
    }
}

void Simulation::update_particles(float dt) {
    const float* u_grid = solver.get_u_ptr();
    const float* v_grid = solver.get_v_ptr();
    uint8_t* obs = solver.get_obstacle_ptr();

    for (size_t i = 0; i < particles.size(); ++i) {
        float px = particles[i].x;
        float py = particles[i].y;

        // Perform fast bilinear interpolation to get current velocities
        int i0 = static_cast<int>(px);
        int j0 = static_cast<int>(py);

        // Respawn if drifted off-screen or out of bounds
        if (i0 < 0 || i0 >= width - 1 || j0 < 0 || j0 >= height - 1) {
            particles[i].x = 1.0f;
            particles[i].y = dist_y(rng);
            particles[i].speed = 0.0f;
            continue;
        }

        float s1 = px - i0;
        float s0 = 1.0f - s1;
        float t1 = py - j0;
        float t0 = 1.0f - t1;

        // Velocity lookups
        float u_val = s0 * (t0 * u_grid[i0 + j0 * width] + t1 * u_grid[i0 + (j0 + 1) * width]) +
                      s1 * (t0 * u_grid[(i0 + 1) + j0 * width] + t1 * u_grid[(i0 + 1) + (j0 + 1) * width]);

        float v_val = s0 * (t0 * v_grid[i0 + j0 * width] + t1 * v_grid[i0 + (j0 + 1) * width]) +
                      s1 * (t0 * v_grid[(i0 + 1) + j0 * width] + t1 * v_grid[(i0 + 1) + (j0 + 1) * width]);

        // Translate velocities to canvas displacement
        particles[i].x += u_val * dt * 110.0f;
        particles[i].y += v_val * dt * 110.0f;
        
        // Speed magnitude for velocity-based coloring
        particles[i].speed = std::sqrt(u_val * u_val + v_val * v_val);

        // Respawn particles that hit obstacles
        int curr_idx = static_cast<int>(particles[i].x) + static_cast<int>(particles[i].y) * width;
        if (curr_idx >= 0 && curr_idx < width * height && obs[curr_idx] == 1) {
            particles[i].x = 1.0f;
            particles[i].y = dist_y(rng);
            particles[i].speed = 0.0f;
        }

        // Pack back into the flat WebAssembly sharing buffer
        flat_particles[i * 3] = particles[i].x;
        flat_particles[i * 3 + 1] = particles[i].y;
        flat_particles[i * 3 + 2] = particles[i].speed;
    }
}

// summing pressure boundary integrals to calculate Drag & Lift
void Simulation::compute_aerodynamics(float wind_speed) {
    float total_drag = 0.0f;
    float total_lift = 0.0f;
    int boundary_cells = 0;

    const float* pressure = solver.get_pressure_ptr();
    const uint8_t* obs = solver.get_obstacle_ptr();

    for (int y = 1; y < height - 1; ++y) {
        for (int x = 1; x < width - 1; ++x) {
            int idx = x + y * width;
            if (obs[idx] == 1) {
                // Check if this obstacle cell shares a boundary face with a fluid cell
                bool is_boundary = false;
                
                // Left neighbor (fluid pushing right -> drag)
                if (obs[idx - 1] == 0) {
                    total_drag += pressure[idx - 1];
                    is_boundary = true;
                }
                // Right neighbor (fluid pushing left -> negative drag)
                if (obs[idx + 1] == 0) {
                    total_drag -= pressure[idx + 1];
                    is_boundary = true;
                }
                // Top neighbor (fluid pushing down -> negative lift / downforce)
                if (obs[idx - width] == 0) {
                    total_lift -= pressure[idx - width];
                    is_boundary = true;
                }
                // Bottom neighbor (fluid pushing up -> positive lift)
                if (obs[idx + width] == 0) {
                    total_lift += pressure[idx + width];
                    is_boundary = true;
                }

                if (is_boundary) {
                    boundary_cells++;
                }
            }
        }
    }

    // Exponential Moving Average to prevent visual jitter on telemetry dials
    float dynamic_scale = 0.035f / (wind_speed * wind_speed + 0.1f);
    if (boundary_cells > 0) {
        float raw_drag = total_drag * dynamic_scale;
        float raw_lift = total_lift * dynamic_scale;
        
        // Add minimal noise thresholding to keep blank sandboxes at pure zero
        if (std::abs(raw_drag) < 0.005f) raw_drag = 0.0f;
        if (std::abs(raw_lift) < 0.005f) raw_lift = 0.0f;

        drag_coeff = drag_coeff * 0.90f + raw_drag * 0.10f;
        lift_coeff = lift_coeff * 0.90f + raw_lift * 0.10f;
    } else {
        drag_coeff = drag_coeff * 0.90f;
        lift_coeff = lift_coeff * 0.90f;
    }
}

// Dynamic rotate coordinates around a pivot center
void Simulation::rotate_point(float x, float y, float cx, float cy, float angle_rad, float& rx, float& ry) const {
    float dx = x - cx;
    float dy = y - cy;
    rx = cx + dx * std::cos(angle_rad) - dy * std::sin(angle_rad);
    ry = cy + dx * std::sin(angle_rad) + dy * std::cos(angle_rad);
}

void Simulation::draw_obstacle_brush(int cx, int cy, int radius, bool draw) {
    for (int y = cy - radius; y <= cy + radius; ++y) {
        for (int x = cx - radius; x <= cx + radius; ++x) {
            if (x >= 1 && x < width - 1 && y >= 1 && y < height - 1) {
                float dist = std::sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
                if (dist <= radius) {
                    solver.set_obstacle(x, y, draw);
                }
            }
        }
    }
}

void Simulation::reset_simulation() {
    solver.clear_obstacles();
    init_particles();
    drag_coeff = 0.0f;
    lift_coeff = 0.0f;
    current_preset = 0;
}

void Simulation::clear_all_obstacles() {
    solver.clear_obstacles();
    drag_coeff = 0.0f;
    lift_coeff = 0.0f;
    current_preset = 0;
}

void Simulation::set_angle_of_attack(float angle_deg) {
    if (angle_deg != angle_of_attack_deg) {
        angle_of_attack_deg = angle_deg;
        if (current_preset != 0) {
            // Re-trigger the active preset shape loader to repaint with the new angle!
            load_preset(current_preset);
        }
    }
}

void Simulation::load_preset(int preset_id) {
    current_preset = preset_id;
    solver.clear_obstacles();

    float cx = width / 2.0f;
    float cy = height / 2.0f;

    switch (preset_id) {
        case 1: // NACA 0012 Symmetrical Airfoil
            build_preset_airfoil(36.0f, 0.12f, cx - 18.0f, cy, false);
            break;
        case 2: // Boeing Cambered Airplane Wing
            build_preset_airfoil(36.0f, 0.14f, cx - 18.0f, cy, true);
            break;
        case 3: // Formula 1 Race Car downforce profile
            build_preset_f1_car(cx, cy, 1.0f);
            break;
        case 4: // Symmetrical bullet profile vs block
            build_preset_bullet_vs_block(cx, cy, true);
            break;
        case 5: // Simple blunt block
            build_preset_bullet_vs_block(cx, cy, false);
            break;
        default:
            break;
    }
}

// Generate wing geometry mathematically in continuous space, rotating it by angle of attack!
void Simulation::build_preset_airfoil(float length, float camber_thickness, float chord_x, float chord_y, bool is_asymmetric) {
    float angle_rad = angle_of_attack_deg * M_PI / 180.0f;
    float center_x = chord_x + length / 2.0f;
    float center_y = chord_y;

    for (int y = 0; y < height; ++y) {
        for (int x = 0; x < width; ++x) {
            // 1. Rotate the grid cell coordinates backward around the wing pivot
            float rx, ry;
            rotate_point(x, y, center_x, center_y, -angle_rad, rx, ry);

            // 2. Check if (rx, ry) is within length bounds
            float t = (rx - chord_x) / length;
            if (t >= 0.0f && t <= 1.0f) {
                // NACA standard thickness envelope equation
                float thickness = 5.0f * camber_thickness * (
                    0.2969f * std::sqrt(t) - 
                    0.1260f * t - 
                    0.3516f * t * t + 
                    0.2843f * t * t * t - 
                    0.1015f * t * t * t * t
                ) * length;

                // Camber line height (if asymmetric, generating upward camber)
                float camber = 0.0f;
                if (is_asymmetric) {
                    // Boeing-style camber chord line: parabolic distribution
                    camber = 0.08f * length * t * (1.0f - t);
                }

                float top_boundary = chord_y - thickness + camber;
                float bottom_boundary = chord_y + thickness + camber;

                if (ry >= top_boundary && ry <= bottom_boundary) {
                    solver.set_obstacle(x, y, true);
                }
            }
        }
    }
}

void Simulation::build_preset_f1_car(float cx, float cy, float scale) {
    float angle_rad = angle_of_attack_deg * M_PI / 180.0f;

    for (int y = 0; y < height; ++y) {
        for (int x = 0; x < width; ++x) {
            float rx, ry;
            rotate_point(x, y, cx, cy, -angle_rad, rx, ry);

            // Relative positioning for an F1 car shell
            float dx = (rx - cx) / scale;
            float dy = (ry - cy) / scale;

            bool is_inside = false;

            // Simplified race car profile: chassis, rear wing, wheels
            // Main fuselage
            if (dx >= -22.0f && dx <= 22.0f && dy >= 0.0f && dy <= 5.0f) {
                is_inside = true;
            }
            // Nose cone slant
            if (dx >= 0.0f && dx <= 20.0f && dy >= -dx * 0.18f && dy <= 5.0f) {
                is_inside = true;
            }
            // Rear spoiler profile (angled to generate downforce / negative lift!)
            if (dx >= -20.0f && dx <= -16.0f && dy >= -5.0f && dy <= 0.0f) {
                // Angled plane
                float spoiler_height = -2.0f - (dx + 20.0f) * 0.7f;
                if (dy >= spoiler_height) {
                    is_inside = true;
                }
            }
            // Front wing spoiler
            if (dx >= 18.0f && dx <= 24.0f && dy >= 3.0f && dy <= 5.0f) {
                is_inside = true;
            }
            // Wheels
            float rear_wheel_dist = std::sqrt((dx + 12.0f) * (dx + 12.0f) + (dy - 4.0f) * (dy - 4.0f));
            float front_wheel_dist = std::sqrt((dx - 12.0f) * (dx - 12.0f) + (dy - 4.0f) * (dy - 4.0f));
            if (rear_wheel_dist <= 4.5f || front_wheel_dist <= 4.0f) {
                is_inside = true;
            }

            if (is_inside) {
                solver.set_obstacle(x, y, true);
            }
        }
    }
}

void Simulation::build_preset_bullet_vs_block(float cx, float cy, bool is_bullet) {
    float angle_rad = angle_of_attack_deg * M_PI / 180.0f;
    float length = 32.0f;
    float thickness = 14.0f;

    for (int y = 0; y < height; ++y) {
        for (int x = 0; x < width; ++x) {
            float rx, ry;
            rotate_point(x, y, cx, cy, -angle_rad, rx, ry);

            float dx = rx - cx;
            float dy = ry - cy;

            if (is_bullet) {
                // Bullet: Rounded dome in front, flat rectangular back
                if (dx >= -length/2.0f && dx <= 0.0f && std::abs(dy) <= thickness/2.0f) {
                    solver.set_obstacle(x, y, true);
                }
                else if (dx > 0.0f && dx <= length/2.0f) {
                    // Parabolic dome nose
                    float nose_thick = (thickness / 2.0f) * (1.0f - (dx * dx) / (length * length / 4.0f));
                    if (std::abs(dy) <= nose_thick) {
                        solver.set_obstacle(x, y, true);
                    }
                }
            } else {
                // Plain flat rectangular block
                if (std::abs(dx) <= length/2.0f && std::abs(dy) <= thickness/2.0f) {
                    solver.set_obstacle(x, y, true);
                }
            }
        }
    }
}
