#pragma once

#include <vector>
#include <random>

class NeuralNetwork {
public:
    std::vector<int> topology;
    std::vector<std::vector<std::vector<float>>> weights; // layers -> neurons -> input_weights
    std::vector<std::vector<float>> biases;               // layers -> neurons

    NeuralNetwork(const std::vector<int>& topology);
    
    std::vector<float> feedForward(const std::vector<float>& inputs) const;
    void mutate(float mutationRate, float mutationAmount);
    NeuralNetwork crossover(const NeuralNetwork& other) const;
    
    // For initializing random weights
    static float randomFloat(float min, float max);
};
