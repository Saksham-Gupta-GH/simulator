#include "fluid_solver.h"

#define IX(x, y) ((x) + (y) * N)

FluidSolver::FluidSolver(int N, float diffusion, float viscosity, float dt)
    : N(N), dt(dt), diff(diffusion), visc(viscosity), windSpeed(50.0f), windDensity(100.0f) {
    
    size = N * N;
    iter = 16; // Solver iterations

    s.resize(size, 0.0f);
    density.resize(size, 0.0f);

    Vx.resize(size, 0.0f);
    Vy.resize(size, 0.0f);
    Vx0.resize(size, 0.0f);
    Vy0.resize(size, 0.0f);

    obstacles.resize(size, 0);
}

void FluidSolver::setViscosity(float v) { visc = v; }
void FluidSolver::setDiffusion(float d) { diff = d; }
void FluidSolver::setWindSpeed(float s) { windSpeed = s; }
void FluidSolver::setWindDensity(float d) { windDensity = d; }

void FluidSolver::addDensity(int x, int y, float amount) {
    if (x >= 0 && x < N && y >= 0 && y < N) {
        density[IX(x, y)] += amount;
    }
}

void FluidSolver::addVelocity(int x, int y, float amountX, float amountY) {
    if (x >= 0 && x < N && y >= 0 && y < N) {
        Vx[IX(x, y)] += amountX;
        Vy[IX(x, y)] += amountY;
    }
}

void FluidSolver::setObstacle(int x, int y, bool isSolid) {
    if (x >= 0 && x < N && y >= 0 && y < N) {
        obstacles[IX(x, y)] = isSolid ? 1 : 0;
        if (isSolid) {
            density[IX(x, y)] = 0;
            Vx[IX(x, y)] = 0;
            Vy[IX(x, y)] = 0;
        }
    }
}

void FluidSolver::clearObstacles() {
    std::fill(obstacles.begin(), obstacles.end(), 0);
}

void FluidSolver::step() {
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
    
    std::swap(s, density);
    diffuse(0, density, s, diff, dt);
    
    std::swap(s, density);
    advect(0, density, s, Vx, Vy, dt);

    // Decay density slowly so it doesn't just fill up the screen
    for(int i = 0; i < size; i++) {
        density[i] *= 0.995f; 
        if (obstacles[i]) density[i] = 0.0f; // Ensure no smoke inside walls
    }
}

void FluidSolver::set_bnd(int b, std::vector<float>& x) {
    for (int i = 1; i < N - 1; i++) {
        x[IX(i, 0)] = b == 2 ? -x[IX(i, 1)] : x[IX(i, 1)];
        x[IX(i, N - 1)] = b == 2 ? -x[IX(i, N - 2)] : x[IX(i, N - 2)];
        x[IX(0, i)] = b == 1 ? -x[IX(1, i)] : x[IX(1, i)];
        x[IX(N - 1, i)] = b == 1 ? -x[IX(N - 2, i)] : x[IX(N - 2, i)];
    }
    
    // Set obstacle boundaries (slip or no-slip condition)
    for (int j = 1; j < N - 1; j++) {
        for (int i = 1; i < N - 1; i++) {
            if (obstacles[IX(i, j)]) {
                x[IX(i, j)] = 0.0f; 
                // A true no-slip boundary would reverse the surrounding velocity,
                // but setting strictly 0 is stable for this visualizer.
            }
        }
    }

    x[IX(0, 0)] = 0.5f * (x[IX(1, 0)] + x[IX(0, 1)]);
    x[IX(0, N - 1)] = 0.5f * (x[IX(1, N - 1)] + x[IX(0, N - 2)]);
    x[IX(N - 1, 0)] = 0.5f * (x[IX(N - 2, 0)] + x[IX(N - 1, 1)]);
    x[IX(N - 1, N - 1)] = 0.5f * (x[IX(N - 2, N - 1)] + x[IX(N - 1, N - 2)]);
}

void FluidSolver::lin_solve(int b, std::vector<float>& x, std::vector<float>& x0, float a, float c) {
    float cRecip = 1.0f / c;
    for (int k = 0; k < iter; k++) {
        for (int j = 1; j < N - 1; j++) {
            for (int i = 1; i < N - 1; i++) {
                if (obstacles[IX(i, j)]) continue;
                x[IX(i, j)] =
                    (x0[IX(i, j)]
                        + a * (x[IX(i + 1, j)]
                            + x[IX(i - 1, j)]
                            + x[IX(i, j + 1)]
                            + x[IX(i, j - 1)]
                            )) * cRecip;
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
    float i0, i1, j0, j1;

    float dtx = dt * (N - 2);
    float dty = dt * (N - 2);

    float s0, s1, t0, t1;
    float tmp1, tmp2, x, y;

    float Nfloat = N;
    float ifloat, jfloat;
    int i, j;

    for (j = 1, jfloat = 1; j < N - 1; j++, jfloat++) {
        for (i = 1, ifloat = 1; i < N - 1; i++, ifloat++) {
            if (obstacles[IX(i, j)]) continue;

            tmp1 = dtx * u[IX(i, j)];
            tmp2 = dty * v[IX(i, j)];
            x = ifloat - tmp1;
            y = jfloat - tmp2;

            if (x < 0.5f) x = 0.5f;
            if (x > Nfloat + 0.5f) x = Nfloat + 0.5f;
            i0 = std::floor(x);
            i1 = i0 + 1.0f;
            if (y < 0.5f) y = 0.5f;
            if (y > Nfloat + 0.5f) y = Nfloat + 0.5f;
            j0 = std::floor(y);
            j1 = j0 + 1.0f;

            s1 = x - i0;
            s0 = 1.0f - s1;
            t1 = y - j0;
            t0 = 1.0f - t1;

            int i0i = static_cast<int>(i0);
            int i1i = static_cast<int>(i1);
            int j0i = static_cast<int>(j0);
            int j1i = static_cast<int>(j1);

            // Clamp bounds
            if (i0i < 0) i0i = 0; if (i0i >= N) i0i = N-1;
            if (i1i < 0) i1i = 0; if (i1i >= N) i1i = N-1;
            if (j0i < 0) j0i = 0; if (j0i >= N) j0i = N-1;
            if (j1i < 0) j1i = 0; if (j1i >= N) j1i = N-1;

            d[IX(i, j)] =
                s0 * (t0 * d0[IX(i0i, j0i)] + t1 * d0[IX(i0i, j1i)]) +
                s1 * (t0 * d0[IX(i1i, j0i)] + t1 * d0[IX(i1i, j1i)]);
        }
    }
    set_bnd(b, d);
}

void FluidSolver::project(std::vector<float>& u, std::vector<float>& v, std::vector<float>& p, std::vector<float>& div) {
    for (int j = 1; j < N - 1; j++) {
        for (int i = 1; i < N - 1; i++) {
            if (obstacles[IX(i, j)]) continue;
            div[IX(i, j)] = -0.5f * (
                u[IX(i + 1, j)] - u[IX(i - 1, j)] +
                v[IX(i, j + 1)] - v[IX(i, j - 1)]
                ) / N;
            p[IX(i, j)] = 0;
        }
    }
    set_bnd(0, div);
    set_bnd(0, p);
    lin_solve(0, p, div, 1, 4);

    for (int j = 1; j < N - 1; j++) {
        for (int i = 1; i < N - 1; i++) {
            if (obstacles[IX(i, j)]) continue;
            u[IX(i, j)] -= 0.5f * (p[IX(i + 1, j)] - p[IX(i - 1, j)]) * N;
            v[IX(i, j)] -= 0.5f * (p[IX(i, j + 1)] - p[IX(i, j - 1)]) * N;
        }
    }
    set_bnd(1, u);
    set_bnd(2, v);
}

uintptr_t FluidSolver::getDensityPtr() {
    return reinterpret_cast<uintptr_t>(density.data());
}

uintptr_t FluidSolver::getObstaclesPtr() {
    return reinterpret_cast<uintptr_t>(obstacles.data());
}

int FluidSolver::getSize() const {
    return size;
}

int FluidSolver::getN() const {
    return N;
}
