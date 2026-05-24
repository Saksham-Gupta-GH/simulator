#ifndef SIMULATION_H
#define SIMULATION_H

#include <vector>
#include <cstdint>
#include "car.h"

/**
 * @brief Master Evolution Simulation Manager.
 * Orchestrates track memory, population steps, fitness sorting, and genetic breeding.
 */
class Simulation {
private:
    int populationSize;
    int generationCount;
    
    // Grid track dimensions (fixed 80 x 60 grid maps)
    int gridWidth;
    int gridHeight;
    float cellSize;
    std::vector<uint8_t> gridData;

    // Start coordinates for the generation cars
    float startX;
    float startY;

    // Genetic algorithm parameters
    float mutationRate;
    float mutationAmount;

    // Flat data buffers exposed to JS via zero-copy HEAP pointer maps
    std::vector<float> carCoordinatesBuffer; // Size: (popSize * 13)
    std::vector<float> bestBrainWeightsBuffer; // Array containing flat synapses data

public:
    std::vector<Car> cars;
    int bestCarIdx;

    /**
     * @brief Initialize population sizing and allocation.
     */
    Simulation(int popSize);

    /**
     * @brief Steps the physics simulation forward by 1 frame ticks.
     * Evaluates collisions and updates coordinate blit buffers.
     */
    void step();

    /**
     * @brief Instantly resets and triggers the next genetic generation cycle.
     */
    void evolveNextGeneration();

    /**
     * @brief Clear all active walls and reset generation count to 1.
     */
    void reset();

    /**
     * @brief Triggers manually a massive mutation blast on the entire population.
     */
    void triggerSuperMutation();

    // --- High-Performance WebAssembly Memory Interfacing ---
    
    /**
     * @brief Exposes the pointer to the flat track grid data.
     * Javascript can directly write painted walls into this pointer!
     */
    uintptr_t getGridPtr();

    /**
     * @brief Exposes the pointer to the contiguous flat coordinate floats buffer.
     * Buffer layout per car (13 floats total):
     * [0] x, [1] y, [2] angle, [3] speed, [4] isDead, [5] id, [6..10] sensors, [11] fitness, [12] stepsAlive
     */
    uintptr_t getCarCoordinatesPtr();

    /**
     * @brief Exposes flat pointer to the best brain's synapses weights.
     */
    uintptr_t getBestBrainWeightsPtr();
    int getBestBrainWeightsSize() const;

    // --- Settings and Telemetry Accessors ---
    int getGenerationCount() const { return generationCount; }
    int getPopulationSize() const { return populationSize; }
    int getActiveCarsCount() const;
    float getMaxFitness() const;

    float getMutationRate() const { return mutationRate; }
    void setMutationRate(float val) { mutationRate = val; }

    float getMutationAmount() const { return mutationAmount; }
    void setMutationAmount(float val) { mutationAmount = val; }

    float getStartX() const { return startX; }
    void setStartX(float val) { startX = val; }

    float getStartY() const { return startY; }
    void setStartY(float val) { startY = val; }
};

#endif // SIMULATION_H
