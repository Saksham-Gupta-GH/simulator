#pragma once

#include "car_physics.h"
#include <vector>
#include <memory>

class EvolutionManager {
private:
    float startX, startY, startAngle;
    float goalX, goalY;
    int populationSize;
    float mutationRate;
    float mutationAmount;
    
public:
    std::vector<Car> cars;
    std::vector<float> trackBoundaries; // x1, y1, x2, y2 format flat
    std::vector<float> carDataFlat; // Flat array for JS zero-copy (x, y, angle, isDead, 5 rays...)
    
    int generation;
    float maxFitnessAllTime;

    EvolutionManager(int popSize, float sX, float sY, float sAngle);

    void setStart(float x, float y);
    void setGoal(float x, float y);
    void setTrackBoundaries(const std::vector<float>& boundaries);
    void update(float dt);
    
    bool allDead() const;
    void nextGeneration();
    
    // JS bridging
    uintptr_t getCarDataPtr();
    int getCarDataSize() const;
    int getAliveCount() const;
    float getCurrentMaxFitness() const;
    
    // Get weights of the best car
    std::vector<float> getBestBrainWeights() const;
};
