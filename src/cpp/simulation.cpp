#include "simulation.h"
#include <algorithm>
#include <random>
#include <iostream>

Simulation::Simulation(int popSize)
    : populationSize(popSize),
      generationCount(1),
      gridWidth(80),
      gridHeight(60),
      cellSize(10.0f),
      startX(400.0f),
      startY(500.0f),
      mutationRate(0.08f),
      mutationAmount(0.20f),
      bestCarIdx(0) {
    
    gridData.resize(gridWidth * gridHeight, 0); // Initialize clean road
    carCoordinatesBuffer.resize(populationSize * 13, 0.0f);
    
    // Spawn initial population
    cars.reserve(populationSize);
    for (int i = 0; i < populationSize; ++i) {
        cars.emplace_back(startX, startY, i);
    }
}

void Simulation::step() {
    if (cars.empty()) return;

    bool allDead = true;
    float maxFitness = -1.0f;
    int currentBestIdx = 0;

    // 1. Move all cars, evaluate inputs, and check crashes
    for (int i = 0; i < populationSize; ++i) {
        auto& car = cars[i];
        
        car.update(gridData, gridWidth, gridHeight, cellSize);
        
        if (!car.isDead) {
            allDead = false;
        }

        // Track who is performing the best right now
        if (car.fitness > maxFitness) {
            maxFitness = car.fitness;
            currentBestIdx = i;
        }

        // 2. Pack data into the shared contiguous array buffer for zero-copy JS read
        int offset = i * 13;
        carCoordinatesBuffer[offset + 0] = car.x;
        carCoordinatesBuffer[offset + 1] = car.y;
        carCoordinatesBuffer[offset + 2] = car.angle;
        carCoordinatesBuffer[offset + 3] = car.speed;
        carCoordinatesBuffer[offset + 4] = car.isDead ? 1.0f : 0.0f;
        carCoordinatesBuffer[offset + 5] = static_cast<float>(car.id);
        
        for (int s = 0; s < 5; ++s) {
            carCoordinatesBuffer[offset + 6 + s] = car.sensorDistances[s];
        }
        
        carCoordinatesBuffer[offset + 11] = car.fitness;
        carCoordinatesBuffer[offset + 12] = static_cast<float>(car.stepsAlive);
    }

    // Always overlay the visual brain HUD with the best performing car
    bestCarIdx = currentBestIdx;
    bestBrainWeightsBuffer = cars[bestCarIdx].brain->getFlatWeights();

    // 3. Evolve if the entire population has crashed
    if (allDead) {
        evolveNextGeneration();
    }
}

void Simulation::evolveNextGeneration() {
    generationCount++;

    // 1. Elitism: Sort cars by their performance fitness descending
    std::sort(cars.begin(), cars.end(), [](const Car& a, const Car& b) {
        return a.fitness > b.fitness;
    });

    std::vector<Car> nextGeneration;
    nextGeneration.reserve(populationSize);

    // Keep the absolute top 2 best-performing cars (direct clones without mutation)
    // This is called Elitism and prevents loss of good strategies!
    for (int i = 0; i < 2; ++i) {
        Car clone(cars[i]);
        clone.x = startX;
        clone.y = startY;
        clone.angle = -1.57f;
        clone.speed = 0.0f;
        clone.isDead = false;
        clone.fitness = 0.0f;
        clone.stepsAlive = 0;
        nextGeneration.push_back(std::move(clone));
    }

    // 2. Breed remaining children using crossover & mutation from top 5 parents
    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_int_distribution<int> parentSelector(0, 4); // Select from top 5

    for (int i = 2; i < populationSize; ++i) {
        // Selection
        const auto& parentA = cars[parentSelector(gen)];
        const auto& parentB = cars[parentSelector(gen)];

        // Crossover child brain
        NeuralNetwork childBrain = NeuralNetwork::crossover(*parentA.brain, *parentB.brain);
        
        // Mutate child brain
        childBrain.mutate(mutationRate, mutationAmount);

        // Spawn child
        Car child(startX, startY, i);
        child.brain = std::make_unique<NeuralNetwork>(childBrain);
        nextGeneration.push_back(std::move(child));
    }

    // Replace old population
    cars = std::move(nextGeneration);
    bestCarIdx = 0;
}

void Simulation::reset() {
    generationCount = 1;
    bestCarIdx = 0;
    std::fill(gridData.begin(), gridData.end(), 0); // Wipe all wall obstacles
    
    // Wipe and reset all cars
    cars.clear();
    for (int i = 0; i < populationSize; ++i) {
        cars.emplace_back(startX, startY, i);
    }
}

void Simulation::triggerSuperMutation() {
    // Blast mutation parameters temporarily to break stagnation
    for (auto& car : cars) {
        if (car.id == cars[bestCarIdx].id) continue; // Keep the best car intact
        car.brain->mutate(0.85f, 0.40f); // Massive mutation blast!
    }
}

uintptr_t Simulation::getGridPtr() {
    if (gridData.empty()) return 0;
    return reinterpret_cast<uintptr_t>(&gridData[0]);
}

uintptr_t Simulation::getCarCoordinatesPtr() {
    if (carCoordinatesBuffer.empty()) return 0;
    return reinterpret_cast<uintptr_t>(&carCoordinatesBuffer[0]);
}

uintptr_t Simulation::getBestBrainWeightsPtr() {
    if (bestBrainWeightsBuffer.empty()) return 0;
    return reinterpret_cast<uintptr_t>(&bestBrainWeightsBuffer[0]);
}

int Simulation::getBestBrainWeightsSize() const {
    return static_cast<int>(bestBrainWeightsBuffer.size());
}

int Simulation::getActiveCarsCount() const {
    int active = 0;
    for (const auto& car : cars) {
        if (!car.isDead) active++;
    }
    return active;
}

float Simulation::getMaxFitness() const {
    float maxFit = 0.0f;
    for (const auto& car : cars) {
        maxFit = std::max(maxFit, car.fitness);
    }
    return maxFit;
}
