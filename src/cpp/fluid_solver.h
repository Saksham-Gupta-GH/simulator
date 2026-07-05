#pragma once

#include <vector>
#include <cmath>
#include <cstdint>

class FluidSolver {
private:
    int N;
    int size;
    int iter;

    float dt;
    float diff;
    float visc;
    float vort_strength;

    std::vector<float> densityR;
    std::vector<float> densityG;
    std::vector<float> densityB;

    std::vector<float> densityR0;
    std::vector<float> densityG0;
    std::vector<float> densityB0;

    std::vector<float> Vx;
    std::vector<float> Vy;

    std::vector<float> Vx0;
    std::vector<float> Vy0;

    // Solid Obstacles
    std::vector<uint8_t> obstacles;
    std::vector<uint8_t> obsR;
    std::vector<uint8_t> obsG;
    std::vector<uint8_t> obsB;

    void set_bnd(int b, std::vector<float>& x);
    void lin_solve(int b, std::vector<float>& x, std::vector<float>& x0, float a, float c);
    void diffuse(int b, std::vector<float>& x, std::vector<float>& x0, float diff, float dt);
    void advect(int b, std::vector<float>& d, std::vector<float>& d0, std::vector<float>& u, std::vector<float>& v, float dt);
    void project(std::vector<float>& u, std::vector<float>& v, std::vector<float>& p, std::vector<float>& div);

public:
    FluidSolver(int N, float diffusion, float viscosity, float dt);
    ~FluidSolver() = default;

    void step();
    void addDensity(int x, int y, float r, float g, float b);
    void addVelocity(int x, int y, float amountX, float amountY);
    void setObstacle(int x, int y, bool isSolid, uint8_t r, uint8_t g, uint8_t b);
    void clearObstacles();

    void setViscosity(float v) { visc = v; }
    void setDiffusion(float d) { diff = d; }
    void setVorticity(float v) { vort_strength = v; }

    uintptr_t getDensityRPtr() { return reinterpret_cast<uintptr_t>(densityR.data()); }
    uintptr_t getDensityGPtr() { return reinterpret_cast<uintptr_t>(densityG.data()); }
    uintptr_t getDensityBPtr() { return reinterpret_cast<uintptr_t>(densityB.data()); }
    
    uintptr_t getVxPtr() { return reinterpret_cast<uintptr_t>(Vx.data()); }
    uintptr_t getVyPtr() { return reinterpret_cast<uintptr_t>(Vy.data()); }
    
    uintptr_t getObstaclesPtr() { return reinterpret_cast<uintptr_t>(obstacles.data()); }
    uintptr_t getObsRPtr() { return reinterpret_cast<uintptr_t>(obsR.data()); }
    uintptr_t getObsGPtr() { return reinterpret_cast<uintptr_t>(obsG.data()); }
    uintptr_t getObsBPtr() { return reinterpret_cast<uintptr_t>(obsB.data()); }
    
    int getSize() const { return size; }
};
