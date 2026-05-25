#pragma once

#include <vector>
#include <cmath>

class FluidSolver {
private:
    int N;
    int size;
    int iter;

    float dt;
    float diff;
    float visc;
    float windSpeed;
    float windDensity;

    std::vector<float> s;
    std::vector<float> density;

    std::vector<float> Vx;
    std::vector<float> Vy;
    std::vector<float> Vx0;
    std::vector<float> Vy0;

    std::vector<uint8_t> obstacles; // 1 = solid, 0 = fluid

    void set_bnd(int b, std::vector<float>& x);
    void lin_solve(int b, std::vector<float>& x, std::vector<float>& x0, float a, float c);
    void diffuse(int b, std::vector<float>& x, std::vector<float>& x0, float diff, float dt);
    void advect(int b, std::vector<float>& d, std::vector<float>& d0, std::vector<float>& u, std::vector<float>& v, float dt);
    void project(std::vector<float>& u, std::vector<float>& v, std::vector<float>& p, std::vector<float>& div);

public:
    FluidSolver(int N, float diffusion, float viscosity, float dt);

    void setViscosity(float v);
    void setDiffusion(float d);
    void setWindSpeed(float s);
    void setWindDensity(float d);

    void step();
    void addDensity(int x, int y, float amount);
    void addVelocity(int x, int y, float amountX, float amountY);
    void setObstacle(int x, int y, bool isSolid);
    void clearObstacles();

    uintptr_t getDensityPtr();
    uintptr_t getObstaclesPtr();
    int getSize() const;
    int getN() const;
};
