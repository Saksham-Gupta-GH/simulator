#ifndef CAR_H
#define CAR_H

#include <vector>
#include <memory>
#include "nn.h"

/**
 * @brief Represents a self-driving car agent.
 * Handles kinematic physics, raycast distance calculations, and neural net actions.
 */
class Car {
public:
    // Core physical coordinates
    float x, y;
    float angle; // Direction in radians (0 = right, PI/2 = down)
    
    // Kinematic settings
    float speed;
    float maxSpeed;
    float friction;
    float acceleration;
    
    // Telemetry flags
    bool isDead;
    float fitness; // Accumulated distance traveled (used by genetic algorithms)
    int stepsAlive;
    int id;

    // Raycast sensor angles relative to heading: Left-wide, Left-narrow, Center, Right-narrow, Right-wide
    std::vector<float> sensorAngles;
    std::vector<float> sensorDistances; // Normed distances (0.0 = hitting wall, 1.0 = clear)
    
    // Neural Network Brain instance
    std::unique_ptr<NeuralNetwork> brain;

    /**
     * @brief Constructor for initializing car physical properties and brain layout.
     */
    Car(float posX, float posY, int carId);

    /**
     * @brief Copy constructor for cloning parents into children brains.
     */
    Car(const Car& other);

    /**
     * @brief Copy assignment operator to enable sorting and swapping in standard vectors.
     */
    Car& operator=(const Car& other);

    /**
     * @brief Updates car physics, feeds sensors to brain, and moves coordinates.
     * @param grid Flat 2D vector representing the track grid
     * @param gridWidth Number of columns in the grid
     * @param gridHeight Number of rows in the grid
     * @param cellSize Size of each cell in pixels
     */
    void update(const std::vector<uint8_t>& grid, int gridWidth, int gridHeight, float cellSize);

private:
    /**
     * @brief Computes raycast intersections against the 2D grid wall map.
     */
    void castSensors(const std::vector<uint8_t>& grid, int gridWidth, int gridHeight, float cellSize);
};

#endif // CAR_H
