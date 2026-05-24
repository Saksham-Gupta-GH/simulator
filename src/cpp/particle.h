#ifndef PARTICLE_H
#define PARTICLE_H

/**
 * @brief Represents the physical materials available in the sandbox.
 */
enum ParticleType {
    TYPE_FLUID = 0,    // Cohesive liquid with double-density relaxation
    TYPE_SAND = 1,     // Granular, high-friction particles that pile up
    TYPE_BOUNDARY = 2  // Static solid particles that form obstacles
};

/**
 * @brief Core Particle structure optimized for memory cache locality.
 * Struct of Arrays (SoA) is often preferred, but a compact Array of Structs (AoS)
 * fits perfectly here and is highly readable. Memory padding is minimized.
 */
struct Particle {
    float x, y;             // Current 2D position
    float prevX, prevY;     // Previous position (used for Verlet integration)
    float vx, vy;           // Calculated velocity
    float density;          // Local fluid density (computed each frame)
    float nearDensity;      // Near density (used for surface-tension / near-pressure)
    float pressure;         // Fluid pressure force
    float nearPressure;     // Near fluid pressure force
    float type;             // Particle material type (as float for flat JS array alignment)
    float id;               // Unique particle identifier (as float for alignment)

    /**
     * @brief Constructor for instant particle initialization.
     */
    Particle(float posX, float posY, float velX, float velY, float pType, float pId)
        : x(posX), y(posY),
          prevX(posX - velX * 0.016f), prevY(posY - velY * 0.016f), // Seed Verlet state
          vx(velX), vy(velY),
          density(0.0f), nearDensity(0.0f),
          pressure(0.0f), nearPressure(0.0f),
          type(pType), id(pId) {}
};

#endif // PARTICLE_H
