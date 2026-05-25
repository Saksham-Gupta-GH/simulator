#include "car_physics.h"
#include <cmath>
#include <algorithm>
#include <iostream>

const float PI = 3.1415926535f;

// Helper to check line segment intersection
bool lineIntersection(float x1, float y1, float x2, float y2, float x3, float y3, float x4, float y4, float& outX, float& outY) {
    float den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (den == 0) return false;

    float t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
    float u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den;

    if (t > 0 && t < 1 && u > 0 && u < 1) {
        outX = x1 + t * (x2 - x1);
        outY = y1 + t * (y2 - y1);
        return true;
    }
    return false;
}

Car::Car(float startX, float startY, float startAngle) 
    // Neural Network: 6 inputs (5 rays + 1 speed), 6 hidden neurons, 2 outputs (throttle, steering)
    : brain({6, 6, 2}) 
{
    x = startX;
    y = startY;
    angle = startAngle;
    speed = 0.0f;
    maxSpeed = 8.0f;
    acceleration = 0.4f;
    friction = 0.1f;
    turnSpeed = 0.08f;
    width = 30.0f;
    height = 50.0f;
    
    isDead = false;
    fitness = 0.0f;
    distanceTraveled = 0.0f;
    
    // 5 rays spread across the front
    for (int i = 0; i < 5; ++i) {
        rays.push_back({0, 0, 0, 0});
    }
}

void Car::update(const std::vector<float>& trackBoundaries, float dt) {
    if (isDead) return;

    // 1. Update Sensors (Rays)
    updateRays(trackBoundaries);

    // 2. Feed sensor data into Neural Network
    std::vector<float> inputs;
    for (const auto& ray : rays) {
        inputs.push_back(1.0f - (ray.distance / 200.0f)); // Normalize distance 0 to 1
    }
    inputs.push_back(speed / maxSpeed); // Normalize speed

    std::vector<float> outputs = brain.feedForward(inputs);
    
    // Output 0: Throttle (-1 to 1)
    // Output 1: Steering (-1 to 1)
    float throttle = outputs[0];
    float steering = outputs[1];

    // 3. Update Physics
    speed += throttle * acceleration;
    
    // Apply friction
    if (speed > 0) {
        speed -= friction;
        if (speed < 0) speed = 0;
    } else if (speed < 0) {
        speed += friction;
        if (speed > 0) speed = 0;
    }

    // Clamp speed
    if (speed > maxSpeed) speed = maxSpeed;
    if (speed < -maxSpeed / 2.0f) speed = -maxSpeed / 2.0f; // Slower reverse

    // Update angle based on steering (only turn if moving)
    if (speed != 0) {
        float flip = speed > 0 ? 1.0f : -1.0f;
        angle += steering * turnSpeed * flip;
    }

    // Update position
    float dx = std::sin(angle) * speed;
    float dy = -std::cos(angle) * speed;
    
    x += dx;
    y += dy;

    // Update fitness
    distanceTraveled += speed; // Simple fitness metric: total distance traveled
    fitness = distanceTraveled;

    // 4. Check Collisions
    checkCollisions(trackBoundaries);
}

void Car::updateRays(const std::vector<float>& trackBoundaries) {
    float rayLength = 200.0f;
    float raySpread = PI / 2.0f; // 90 degrees total spread
    float angleStep = raySpread / 4.0f;

    for (int i = 0; i < 5; ++i) {
        float rayAngle = angle - (raySpread / 2.0f) + (i * angleStep);
        rays[i].angle = rayAngle;
        
        float endX = x + std::sin(rayAngle) * rayLength;
        float endY = y - std::cos(rayAngle) * rayLength;
        
        rays[i].distance = rayLength; // Default to max distance
        
        // Check intersection with all track boundaries
        for (size_t j = 0; j < trackBoundaries.size(); j += 4) {
            float bx1 = trackBoundaries[j];
            float by1 = trackBoundaries[j+1];
            float bx2 = trackBoundaries[j+2];
            float by2 = trackBoundaries[j+3];
            
            float ix, iy;
            if (lineIntersection(x, y, endX, endY, bx1, by1, bx2, by2, ix, iy)) {
                float dist = std::sqrt((ix - x)*(ix - x) + (iy - y)*(iy - y));
                if (dist < rays[i].distance) {
                    rays[i].distance = dist;
                    rays[i].x = ix;
                    rays[i].y = iy;
                }
            }
        }
    }
}

void Car::checkCollisions(const std::vector<float>& trackBoundaries) {
    // Basic bounding box corners
    float cosA = std::cos(angle);
    float sinA = std::sin(angle);
    
    float hw = width / 2.0f;
    float hh = height / 2.0f;

    std::vector<std::pair<float, float>> corners = {
        {x + (-hw * cosA - -hh * sinA), y + (-hw * sinA + -hh * cosA)}, // Top-Left
        {x + ( hw * cosA - -hh * sinA), y + ( hw * sinA + -hh * cosA)}, // Top-Right
        {x + ( hw * cosA -  hh * sinA), y + ( hw * sinA +  hh * cosA)}, // Bottom-Right
        {x + (-hw * cosA -  hh * sinA), y + (-hw * sinA +  hh * cosA)}  // Bottom-Left
    };

    // Check if any edge of the car intersects with any track boundary
    for (size_t i = 0; i < 4; ++i) {
        float cx1 = corners[i].first;
        float cy1 = corners[i].second;
        float cx2 = corners[(i + 1) % 4].first;
        float cy2 = corners[(i + 1) % 4].second;

        for (size_t j = 0; j < trackBoundaries.size(); j += 4) {
            float bx1 = trackBoundaries[j];
            float by1 = trackBoundaries[j+1];
            float bx2 = trackBoundaries[j+2];
            float by2 = trackBoundaries[j+3];
            
            float ix, iy;
            if (lineIntersection(cx1, cy1, cx2, cy2, bx1, by1, bx2, by2, ix, iy)) {
                isDead = true;
                return;
            }
        }
    }
}

std::vector<float> Car::getRayData() const {
    std::vector<float> data;
    for (const auto& ray : rays) {
        data.push_back(ray.distance);
    }
    return data;
}
