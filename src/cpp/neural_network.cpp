#include "neural_network.h"
#include <cmath>

float NeuralNetwork::randomFloat(float min, float max) {
    static std::random_device rd;
    static std::mt19937 gen(rd());
    std::uniform_real_distribution<float> dis(min, max);
    return dis(gen);
}

// ReLU Activation Function
float relu(float x) {
    return x > 0 ? x : 0;
}

// Tanh Activation Function (useful for steering which needs -1 to 1)
float tanh_act(float x) {
    return std::tanh(x);
}

NeuralNetwork::NeuralNetwork(const std::vector<int>& topology) : topology(topology) {
    for (size_t i = 1; i < topology.size(); ++i) {
        int numNeurons = topology[i];
        int numInputs = topology[i - 1];
        
        std::vector<std::vector<float>> layerWeights;
        std::vector<float> layerBiases;
        
        for (int j = 0; j < numNeurons; ++j) {
            std::vector<float> neuronWeights;
            for (int k = 0; k < numInputs; ++k) {
                neuronWeights.push_back(randomFloat(-1.0f, 1.0f));
            }
            layerWeights.push_back(neuronWeights);
            layerBiases.push_back(randomFloat(-1.0f, 1.0f));
        }
        
        weights.push_back(layerWeights);
        biases.push_back(layerBiases);
    }
}

std::vector<float> NeuralNetwork::feedForward(const std::vector<float>& inputs) const {
    std::vector<float> currentOutputs = inputs;

    for (size_t i = 0; i < weights.size(); ++i) {
        std::vector<float> nextOutputs;
        for (size_t j = 0; j < weights[i].size(); ++j) {
            float sum = biases[i][j];
            for (size_t k = 0; k < weights[i][j].size(); ++k) {
                sum += currentOutputs[k] * weights[i][j][k];
            }
            
            // Output layer uses Tanh for -1 to 1 range (steering/throttle)
            // Hidden layers use ReLU
            if (i == weights.size() - 1) {
                nextOutputs.push_back(tanh_act(sum));
            } else {
                nextOutputs.push_back(relu(sum));
            }
        }
        currentOutputs = nextOutputs;
    }

    return currentOutputs;
}

void NeuralNetwork::mutate(float mutationRate, float mutationAmount) {
    for (size_t i = 0; i < weights.size(); ++i) {
        for (size_t j = 0; j < weights[i].size(); ++j) {
            for (size_t k = 0; k < weights[i][j].size(); ++k) {
                if (randomFloat(0.0f, 1.0f) < mutationRate) {
                    weights[i][j][k] += randomFloat(-mutationAmount, mutationAmount);
                }
            }
            if (randomFloat(0.0f, 1.0f) < mutationRate) {
                biases[i][j] += randomFloat(-mutationAmount, mutationAmount);
            }
        }
    }
}

NeuralNetwork NeuralNetwork::crossover(const NeuralNetwork& other) const {
    NeuralNetwork child(topology);
    
    for (size_t i = 0; i < weights.size(); ++i) {
        for (size_t j = 0; j < weights[i].size(); ++j) {
            for (size_t k = 0; k < weights[i][j].size(); ++k) {
                if (randomFloat(0.0f, 1.0f) < 0.5f) {
                    child.weights[i][j][k] = this->weights[i][j][k];
                } else {
                    child.weights[i][j][k] = other.weights[i][j][k];
                }
            }
            if (randomFloat(0.0f, 1.0f) < 0.5f) {
                child.biases[i][j] = this->biases[i][j];
            } else {
                child.biases[i][j] = other.biases[i][j];
            }
        }
    }
    
    return child;
}
