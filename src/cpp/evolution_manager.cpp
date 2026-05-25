#include "evolution_manager.h"
#include <algorithm>

EvolutionManager::EvolutionManager(int popSize, float sX, float sY, float sAngle) 
    : startX(sX), startY(sY), startAngle(sAngle), populationSize(popSize) 
{
    generation = 1;
    maxFitnessAllTime = 0.0f;
    mutationRate = 0.1f;
    mutationAmount = 0.2f;

    for (int i = 0; i < populationSize; ++i) {
        cars.push_back(Car(startX, startY, startAngle));
    }
}

void EvolutionManager::setTrackBoundaries(const std::vector<float>& boundaries) {
    trackBoundaries = boundaries;
}

void EvolutionManager::update(float dt) {
    for (auto& car : cars) {
        car.update(trackBoundaries, dt);
    }

    // Populate flat array for JS rendering
    // Format per car: [x, y, angle, isDead, ray1, ray2, ray3, ray4, ray5] -> 9 floats per car
    carDataFlat.clear();
    for (const auto& car : cars) {
        carDataFlat.push_back(car.x);
        carDataFlat.push_back(car.y);
        carDataFlat.push_back(car.angle);
        carDataFlat.push_back(car.isDead ? 1.0f : 0.0f);
        
        for (const auto& ray : car.rays) {
            carDataFlat.push_back(ray.distance);
        }
    }
}

bool EvolutionManager::allDead() const {
    for (const auto& car : cars) {
        if (!car.isDead) return false;
    }
    return true;
}

void EvolutionManager::nextGeneration() {
    // Find best cars
    std::sort(cars.begin(), cars.end(), [](const Car& a, const Car& b) {
        return a.fitness > b.fitness;
    });

    if (cars[0].fitness > maxFitnessAllTime) {
        maxFitnessAllTime = cars[0].fitness;
    }

    std::vector<Car> nextGen;
    
    // Elitism: Keep the best 2 cars unchanged
    Car best1 = cars[0];
    Car best2 = cars[1];
    
    best1.x = startX; best1.y = startY; best1.angle = startAngle; best1.speed = 0; best1.isDead = false; best1.distanceTraveled = 0; best1.fitness = 0;
    best2.x = startX; best2.y = startY; best2.angle = startAngle; best2.speed = 0; best2.isDead = false; best2.distanceTraveled = 0; best2.fitness = 0;
    
    nextGen.push_back(best1);
    nextGen.push_back(best2);

    // Crossover & Mutate for the rest
    for (int i = 2; i < populationSize; ++i) {
        NeuralNetwork newBrain = cars[0].brain.crossover(cars[1].brain);
        newBrain.mutate(mutationRate, mutationAmount);
        
        Car newCar(startX, startY, startAngle);
        newCar.brain = newBrain;
        nextGen.push_back(newCar);
    }

    cars = nextGen;
    generation++;
}

uintptr_t EvolutionManager::getCarDataPtr() {
    return reinterpret_cast<uintptr_t>(carDataFlat.data());
}

int EvolutionManager::getCarDataSize() const {
    return carDataFlat.size();
}

int EvolutionManager::getAliveCount() const {
    int count = 0;
    for (const auto& car : cars) {
        if (!car.isDead) count++;
    }
    return count;
}

float EvolutionManager::getCurrentMaxFitness() const {
    float mx = 0;
    for (const auto& car : cars) {
        if (car.fitness > mx) mx = car.fitness;
    }
    return mx;
}

std::vector<float> EvolutionManager::getBestBrainWeights() const {
    std::vector<float> flatWeights;
    
    const Car* bestCar = &cars[0];
    for(const auto& car : cars) {
        if(car.fitness > bestCar->fitness) bestCar = &car;
    }
    
    // Serialize topology
    flatWeights.push_back(bestCar->brain.topology.size());
    for(int t : bestCar->brain.topology) {
        flatWeights.push_back(t);
    }
    
    // Serialize weights
    for(const auto& layer : bestCar->brain.weights) {
        for(const auto& neuron : layer) {
            for(float w : neuron) {
                flatWeights.push_back(w);
            }
        }
    }
    return flatWeights;
}
