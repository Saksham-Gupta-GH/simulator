#pragma once

#include "neural_network.h"
#include <vector>

struct Ray {
    float x, y;
    float angle;
    float distance; // Distance to wall
};

class Car {
public:
    float x, y;
    float angle;
    float speed;
    float maxSpeed;
    float acceleration;
    float friction;
    float turnSpeed;
    float width, height;
    
    bool isDead;
    float fitness;
    float distanceTraveled;
    
    std::vector<Ray> rays;
    NeuralNetwork brain;

    Car(float startX, float startY, float startAngle);

    void update(const std::vector<float>& trackBoundaries, float dt);
    void updateRays(const std::vector<float>& trackBoundaries);
    void checkCollisions(const std::vector<float>& trackBoundaries);
    
    // Returns flattened array of sensor distances for JS rendering
    std::vector<float> getRayData() const;
};
