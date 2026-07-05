#include "fluid_solver.h"

#define IX(x, y) ((x) + (y) * N)

FluidSolver::FluidSolver(int N, float diffusion, float viscosity, float dt)
    : N(N), dt(dt), diff(diffusion), visc(viscosity), vort_strength(0.4f) {
    
    size = N * N;
    iter = 20;
    
    densityR.resize(size, 0.0f);
    densityG.resize(size, 0.0f);
    densityB.resize(size, 0.0f);

    densityR0.resize(size, 0.0f);
    densityG0.resize(size, 0.0f);
    densityB0.resize(size, 0.0f);
    
    Vx.resize(size, 0.0f);
    Vy.resize(size, 0.0f);
    Vx0.resize(size, 0.0f);
    Vy0.resize(size, 0.0f);
    
    obstacles.resize(size, 0);
    obsR.resize(size, 0);
    obsG.resize(size, 0);
    obsB.resize(size, 0);
}

void FluidSolver::addDensity(int x, int y, float r, float g, float b) {
    if (x >= 0 && x < N && y >= 0 && y < N) {
        int index = IX(x, y);
        densityR[index] += r;
        densityG[index] += g;
        densityB[index] += b;
    }
}

void FluidSolver::addVelocity(int x, int y, float amountX, float amountY) {
    if (x >= 0 && x < N && y >= 0 && y < N) {
        int index = IX(x, y);
        Vx[index] += amountX;
        Vy[index] += amountY;
    }
}

void FluidSolver::setObstacle(int x, int y, bool isSolid, uint8_t r, uint8_t g, uint8_t b) {
    if (x >= 0 && x < N && y >= 0 && y < N) {
        int idx = IX(x, y);
        obstacles[idx] = isSolid ? 1 : 0;
        obsR[idx] = r;
        obsG[idx] = g;
        obsB[idx] = b;
        if (isSolid) {
            Vx[idx] = 0;
            Vy[idx] = 0;
            densityR[idx] = 0;
            densityG[idx] = 0;
            densityB[idx] = 0;
        }
    }
}

void FluidSolver::clearObstacles() {
    std::fill(obstacles.begin(), obstacles.end(), 0);
    std::fill(obsR.begin(), obsR.end(), 0);
    std::fill(obsG.begin(), obsG.end(), 0);
    std::fill(obsB.begin(), obsB.end(), 0);
}

void FluidSolver::set_bnd(int b, std::vector<float>& x) {
    for (int i = 1; i < N - 1; i++) {
        x[IX(i, 0)] = (obstacles[IX(i, 0)] || b == 2) ? -x[IX(i, 1)] : x[IX(i, 1)];
        x[IX(i, N - 1)] = (obstacles[IX(i, N - 1)] || b == 2) ? -x[IX(i, N - 2)] : x[IX(i, N - 2)];
        x[IX(0, i)] = (obstacles[IX(0, i)] || b == 1) ? -x[IX(1, i)] : x[IX(1, i)];
        x[IX(N - 1, i)] = (obstacles[IX(N - 1, i)] || b == 1) ? -x[IX(N - 2, i)] : x[IX(N - 2, i)];
    }
    
    x[IX(0, 0)] = 0.5f * (x[IX(1, 0)] + x[IX(0, 1)]);
    x[IX(0, N - 1)] = 0.5f * (x[IX(1, N - 1)] + x[IX(0, N - 2)]);
    x[IX(N - 1, 0)] = 0.5f * (x[IX(N - 2, 0)] + x[IX(N - 1, 1)]);
    x[IX(N - 1, N - 1)] = 0.5f * (x[IX(N - 2, N - 1)] + x[IX(N - 1, N - 2)]);

    for (int j = 1; j < N - 1; j++) {
        for (int i = 1; i < N - 1; i++) {
            if (obstacles[IX(i, j)]) {
                x[IX(i, j)] = 0;
            }
        }
    }
}

void FluidSolver::lin_solve(int b, std::vector<float>& x, std::vector<float>& x0, float a, float c) {
    float cRecip = 1.0f / c;
    for (int k = 0; k < iter; k++) {
        // Red pass
        for (int j = 1; j < N - 1; j++) {
            int start_i = (j % 2 == 0) ? 2 : 1;
            for (int i = start_i; i < N - 1; i += 2) {
                if (!obstacles[IX(i, j)]) {
                    x[IX(i, j)] = (x0[IX(i, j)] + a * (x[IX(i + 1, j)] + x[IX(i - 1, j)] + x[IX(i, j + 1)] + x[IX(i, j - 1)])) * cRecip;
                }
            }
        }
        // Black pass
        for (int j = 1; j < N - 1; j++) {
            int start_i = (j % 2 == 0) ? 1 : 2;
            for (int i = start_i; i < N - 1; i += 2) {
                if (!obstacles[IX(i, j)]) {
                    x[IX(i, j)] = (x0[IX(i, j)] + a * (x[IX(i + 1, j)] + x[IX(i - 1, j)] + x[IX(i, j + 1)] + x[IX(i, j - 1)])) * cRecip;
                }
            }
        }
        set_bnd(b, x);
    }
}

void FluidSolver::diffuse(int b, std::vector<float>& x, std::vector<float>& x0, float diff, float dt) {
    float a = dt * diff * (N - 2) * (N - 2);
    lin_solve(b, x, x0, a, 1 + 4 * a);
}

void FluidSolver::advect(int b, std::vector<float>& d, std::vector<float>& d0, std::vector<float>& u, std::vector<float>& v, float dt) {
    float dt0 = dt * (N - 2);
    for (int j = 1; j < N - 1; j++) {
        for (int i = 1; i < N - 1; i++) {
            if (obstacles[IX(i, j)]) {
                d[IX(i, j)] = 0;
                continue;
            }
            
            float x = i - dt0 * u[IX(i, j)];
            float y = j - dt0 * v[IX(i, j)];
            
            if (x < 0.5f) x = 0.5f;
            if (x > N + 0.5f) x = N + 0.5f;
            int i0 = (int)x;
            int i1 = i0 + 1;
            
            if (y < 0.5f) y = 0.5f;
            if (y > N + 0.5f) y = N + 0.5f;
            int j0 = (int)y;
            int j1 = j0 + 1;
            
            float s1 = x - i0;
            float s0 = 1.0f - s1;
            float t1 = y - j0;
            float t0 = 1.0f - t1;
            
            d[IX(i, j)] =
                s0 * (t0 * d0[IX(i0, j0)] + t1 * d0[IX(i0, j1)]) +
                s1 * (t0 * d0[IX(i1, j0)] + t1 * d0[IX(i1, j1)]);
        }
    }
    set_bnd(b, d);
}

void FluidSolver::project(std::vector<float>& u, std::vector<float>& v, std::vector<float>& p, std::vector<float>& div) {
    float h = 1.0f / N;
    for (int j = 1; j < N - 1; j++) {
        for (int i = 1; i < N - 1; i++) {
            if (!obstacles[IX(i, j)]) {
                float uRight = obstacles[IX(i + 1, j)] ? 0 : u[IX(i + 1, j)];
                float uLeft  = obstacles[IX(i - 1, j)] ? 0 : u[IX(i - 1, j)];
                float vUp    = obstacles[IX(i, j + 1)] ? 0 : v[IX(i, j + 1)];
                float vDown  = obstacles[IX(i, j - 1)] ? 0 : v[IX(i, j - 1)];
                
                div[IX(i, j)] = -0.5f * h * (uRight - uLeft + vUp - vDown);
                p[IX(i, j)] = 0;
            } else {
                div[IX(i, j)] = 0;
                p[IX(i, j)] = 0;
            }
        }
    }
    set_bnd(0, div);
    set_bnd(0, p);
    
    lin_solve(0, p, div, 1, 4);
    
    for (int j = 1; j < N - 1; j++) {
        for (int i = 1; i < N - 1; i++) {
            if (!obstacles[IX(i, j)]) {
                float pRight = obstacles[IX(i + 1, j)] ? p[IX(i, j)] : p[IX(i + 1, j)];
                float pLeft  = obstacles[IX(i - 1, j)] ? p[IX(i, j)] : p[IX(i - 1, j)];
                float pUp    = obstacles[IX(i, j + 1)] ? p[IX(i, j)] : p[IX(i, j + 1)];
                float pDown  = obstacles[IX(i, j - 1)] ? p[IX(i, j)] : p[IX(i, j - 1)];
                
                u[IX(i, j)] -= 0.5f * (pRight - pLeft) / h;
                v[IX(i, j)] -= 0.5f * (pUp - pDown) / h;
            }
        }
    }
    set_bnd(1, u);
    set_bnd(2, v);
}

void FluidSolver::step() {
    // Vorticity confinement for realistic swirls
    std::vector<float> curl(size, 0.0f);
    for (int j = 1; j < N - 1; j++) {
        for (int i = 1; i < N - 1; i++) {
            curl[IX(i, j)] = (Vy[IX(i + 1, j)] - Vy[IX(i - 1, j)]) - (Vx[IX(i, j + 1)] - Vx[IX(i, j - 1)]);
        }
    }
    for (int j = 2; j < N - 2; j++) {
        for (int i = 2; i < N - 2; i++) {
            float dx = std::abs(curl[IX(i, j - 1)]) - std::abs(curl[IX(i, j + 1)]);
            float dy = std::abs(curl[IX(i + 1, j)]) - std::abs(curl[IX(i - 1, j)]);
            float len = std::sqrt(dx * dx + dy * dy) + 1e-5f;
            dx = 0.5f * dx / len;
            dy = 0.5f * dy / len;
            Vx[IX(i, j)] += dx * curl[IX(i, j)] * vort_strength;
            Vy[IX(i, j)] += dy * curl[IX(i, j)] * vort_strength;
        }
    }

    std::swap(Vx0, Vx);
    std::swap(Vy0, Vy);
    diffuse(1, Vx, Vx0, visc, dt);
    diffuse(2, Vy, Vy0, visc, dt);
    
    project(Vx, Vy, Vx0, Vy0);
    
    std::swap(Vx0, Vx);
    std::swap(Vy0, Vy);
    advect(1, Vx, Vx0, Vx0, Vy0, dt);
    advect(2, Vy, Vy0, Vx0, Vy0, dt);
    
    project(Vx, Vy, Vx0, Vy0);
    
    // Advect Red
    std::swap(densityR0, densityR);
    diffuse(0, densityR, densityR0, diff, dt);
    std::swap(densityR0, densityR);
    advect(0, densityR, densityR0, Vx, Vy, dt);

    // Advect Green
    std::swap(densityG0, densityG);
    diffuse(0, densityG, densityG0, diff, dt);
    std::swap(densityG0, densityG);
    advect(0, densityG, densityG0, Vx, Vy, dt);

    // Advect Blue
    std::swap(densityB0, densityB);
    diffuse(0, densityB, densityB0, diff, dt);
    std::swap(densityB0, densityB);
    advect(0, densityB, densityB0, Vx, Vy, dt);

    // Slight decay to prevent screen filling
    for(int i = 0; i < size; i++) {
        densityR[i] *= 0.99f;
        densityG[i] *= 0.99f;
        densityB[i] *= 0.99f;
    }
}
