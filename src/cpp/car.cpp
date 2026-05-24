#include "car.h"
#include <cmath>
#include <algorithm>

Car::Car(float posX, float posY, int carId)
    : x(posX), y(posY),
      angle(-1.57f),             // Default heading pointing upwards (race start)
      speed(0.0f),
      maxSpeed(3.2f),
      friction(0.04f),
      acceleration(0.18f),
      isDead(false),
      fitness(0.0f),
      stepsAlive(0),
      id(carId) {
    
    // Set relative sensor angles: Left-wide, Left-narrow, Center, Right-narrow, Right-wide
    sensorAngles = { -0.8f, -0.4f, 0.0f, 0.4f, 0.8f };
    sensorDistances.resize(5, 1.0f); // Default fully clear

    // Set standard network sizes: 5 Inputs, 6 Hidden, 2 Outputs (Gas/Brake, Steer)
    std::vector<int> nnSizes = { 5, 6, 2 };
    brain = std::make_unique<NeuralNetwork>(nnSizes);
}

Car::Car(const Car& other) {
    x = other.x;
    y = other.y;
    angle = other.angle;
    speed = other.speed;
    maxSpeed = other.maxSpeed;
    friction = other.friction;
    acceleration = other.acceleration;
    isDead = other.isDead;
    fitness = other.fitness;
    stepsAlive = other.stepsAlive;
    id = other.id;
    sensorAngles = other.sensorAngles;
    sensorDistances = other.sensorDistances;
    brain = std::make_unique<NeuralNetwork>(*other.brain);
}

Car& Car::operator=(const Car& other) {
    if (this != &other) {
        x = other.x;
        y = other.y;
        angle = other.angle;
        speed = other.speed;
        maxSpeed = other.maxSpeed;
        friction = other.friction;
        acceleration = other.acceleration;
        isDead = other.isDead;
        fitness = other.fitness;
        stepsAlive = other.stepsAlive;
        id = other.id;
        sensorAngles = other.sensorAngles;
        sensorDistances = other.sensorDistances;
        brain = std::make_unique<NeuralNetwork>(*other.brain);
    }
    return *this;
}

void Car::update(const std::vector<uint8_t>& grid, int gridWidth, int gridHeight, float cellSize) {
    if (isDead) return;

    // 1. Raycast sensors outwards to capture proximity to walls
    castSensors(grid, gridWidth, gridHeight, cellSize);

    // 2. Feed sensor values into neural network inputs
    std::vector<float> nnOutputs = brain->feedForward(sensorDistances);

    // 3. Process brain decisions into mechanical forces
    float gasVal = nnOutputs[0];   // Gas / Brake output
    float steerVal = nnOutputs[1]; // Steering output

    // Apply Acceleration / Braking
    if (gasVal > 0.0f) {
        speed += gasVal * acceleration;
    } else {
        speed += gasVal * friction * 2.5f; // Harder braking
    }

    // Apply Steering angle (cap turning rate relative to current speed to prevent spinout)
    float steerStrength = 0.055f;
    angle += steerVal * steerStrength;

    // Apply friction drag & clamp limits
    speed -= speed * friction;
    speed = std::clamp(speed, 0.0f, maxSpeed);

    // Move coordinates
    x += std::cos(angle) * speed;
    y += std::sin(angle) * speed;

    // 4. Validate physical boundaries (collision check on 4 bumpers)
    float rad = 6.5f; // Car bumper collision radius
    float checkPoints[4][2] = {
        { x + std::cos(angle) * rad, y + std::sin(angle) * rad }, // Front bumper
        { x - std::cos(angle) * rad, y - std::sin(angle) * rad }, // Rear bumper
        { x + std::cos(angle + 1.57f) * rad, y + std::sin(angle + 1.57f) * rad }, // Left side
        { x - std::cos(angle + 1.57f) * rad, y - std::sin(angle + 1.57f) * rad }  // Right side
    };

    for (int i = 0; i < 4; ++i) {
        int cx = static_cast<int>(checkPoints[i][0] / cellSize);
        int cy = static_cast<int>(checkPoints[i][1] / cellSize);

        if (cx < 0 || cx >= gridWidth || cy < 0 || cy >= gridHeight) {
            isDead = true;
            break;
        } else {
            int cellIdx = cy * gridWidth + cx;
            if (grid[cellIdx] == 1) { // Hit a painted wall cell
                isDead = true;
                break;
            }
        }
    }

    // 5. Calculate evolution fitness
    if (!isDead) {
        // Fitness scales by speed. Promotes moving forward fast!
        fitness += speed;
        stepsAlive++;
        
        // Timeout penalty: If the car just spins or gets stuck in a corner, terminate it
        if (stepsAlive > 60 && fitness < 15.0f) {
            isDead = true;
        }
    }
}

void Car::castSensors(const std::vector<uint8_t>& grid, int gridWidth, int gridHeight, float cellSize) {
    const float maxRayRange = 135.0f; // Max visual range of 135px
    const float stepSize = 4.0f;      // Precision raycasting increment steps
    const int numSteps = static_cast<int>(maxRayRange / stepSize);

    for (size_t k = 0; k < sensorAngles.size(); ++k) {
        float rayAngle = angle + sensorAngles[k];
        float dx = std::cos(rayAngle);
        float dy = std::sin(rayAngle);

        float hitDistanceNorm = 1.0f; // Default clear path

        for (int step = 1; step <= numSteps; ++step) {
            float checkX = x + dx * step * stepSize;
            float checkY = y + dy * step * stepSize;

            int cx = static_cast<int>(checkX / cellSize);
            int cy = static_cast<int>(checkY / cellSize);

            if (cx < 0 || cx >= gridWidth || cy < 0 || cy >= gridHeight) {
                // Out of viewport bounds is a hit
                hitDistanceNorm = (step * stepSize) / maxRayRange;
                break;
            } else {
                int cellIdx = cy * gridWidth + cx;
                if (grid[cellIdx] == 1) { // Found painted wall obstacle cell
                    hitDistanceNorm = (step * stepSize) / maxRayRange;
                    break;
                }
            }
        }

        sensorDistances[k] = hitDistanceNorm;
    }
}
