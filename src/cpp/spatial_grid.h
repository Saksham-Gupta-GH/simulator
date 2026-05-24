#ifndef SPATIAL_GRID_H
#define SPATIAL_GRID_H

#include <vector>
#include <cmath>
#include <algorithm>

/**
 * @brief High-performance 2D Spatial Partitioning Grid.
 * Employs a zero-allocation linked-list-in-array chain hashing technique.
 * Extremely cache-friendly and fast, avoiding standard vector reallocation overhead
 * at 60 frames per second.
 */
class SpatialGrid {
private:
    int cols;
    int rows;
    float cellSize;
    int width;
    int height;

    // Head of the linked list for each cell: size = (cols * rows)
    std::vector<int> cellHeads;
    // Next pointer array linking particles: size = (number of particles)
    std::vector<int> particleNexts;

public:
    /**
     * @brief Initialize grid sizing based on interaction radius.
     */
    SpatialGrid(int w, int h, float interactionRadius) 
        : width(w), height(h), cellSize(interactionRadius) {
        cols = std::max(1, static_cast<int>(std::ceil(w / cellSize)));
        rows = std::max(1, static_cast<int>(std::ceil(h / cellSize)));
        cellHeads.resize(cols * rows, -1);
    }

    /**
     * @brief Re-bin all particles based on their current positions.
     * Runtime complexity is strictly O(N) where N is particle count.
     */
    template <typename ParticleVector>
    void update(const ParticleVector& particles) {
        int numParticles = static_cast<int>(particles.size());
        
        // Resize next pointers if particle count grew
        if (static_cast<int>(particleNexts.size()) < numParticles) {
            particleNexts.resize(numParticles, -1);
        }

        // Reset heads to -1 (empty cells) in a single quick memory block write
        std::fill(cellHeads.begin(), cellHeads.end(), -1);

        // Populate linked list chains
        for (int i = 0; i < numParticles; ++i) {
            const auto& p = particles[i];
            
            // Map 2D position to cell indices
            int cellX = std::clamp(static_cast<int>(p.x / cellSize), 0, cols - 1);
            int cellY = std::clamp(static_cast<int>(p.y / cellSize), 0, rows - 1);
            int cellIdx = cellY * cols + cellX;

            // Insert particle at head of cell chain
            particleNexts[i] = cellHeads[cellIdx];
            cellHeads[cellIdx] = i;
        }
    }

    /**
     * @brief Queries all neighboring particle indices inside standard 9-cell interaction zone.
     * Highly optimized inline neighbor retriever.
     */
    void getNeighborIndices(float x, float y, std::vector<int>& outNeighbors) const {
        outNeighbors.clear();

        int cellX = std::clamp(static_cast<int>(x / cellSize), 0, cols - 1);
        int cellY = std::clamp(static_cast<int>(y / cellSize), 0, rows - 1);

        // Scan the 3x3 cell neighborhood
        for (int dy = -1; dy <= 1; ++dy) {
            int ny = cellY + dy;
            if (ny < 0 || ny >= rows) continue;

            for (int dx = -1; dx <= 1; ++dx) {
                int nx = cellX + dx;
                if (nx < 0 || nx >= cols) continue;

                int cellIdx = ny * cols + nx;
                int currentParticleIdx = cellHeads[cellIdx];

                // Traverse the linked-list chain in the cell
                while (currentParticleIdx != -1) {
                    outNeighbors.push_back(currentParticleIdx);
                    currentParticleIdx = particleNexts[currentParticleIdx];
                }
            }
        }
    }

    // Accessors for metrics representation
    int getCols() const { return cols; }
    int getRows() const { return rows; }
    float getCellSize() const { return cellSize; }
};

#endif // SPATIAL_GRID_H
