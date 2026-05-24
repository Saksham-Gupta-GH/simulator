#include "nn.h"
#include <cmath>
#include <random>
#include <algorithm>

// --- Layer Implementation ---

Layer::Layer(int inputs, int outputs) 
    : numInputs(inputs), numOutputs(outputs) {
    weights.resize(inputs * outputs);
    biases.resize(outputs);

    // Initialize with random numbers between -1.0 and 1.0
    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_real_distribution<float> dist(-1.0f, 1.0f);

    for (auto& w : weights) {
        w = dist(gen);
    }
    for (auto& b : biases) {
        b = dist(gen);
    }
}

std::vector<float> Layer::feedForward(const std::vector<float>& inputs) {
    std::vector<float> outputs(numOutputs, 0.0f);

    for (int j = 0; j < numOutputs; ++j) {
        float sum = biases[j];
        for (int i = 0; i < numInputs; ++i) {
            sum += inputs[i] * weights[i * numOutputs + j];
        }
        // TanH activation function maps outputs to [-1.0, 1.0]
        outputs[j] = std::tanh(sum);
    }

    return outputs;
}

// --- Neural Network Implementation ---

NeuralNetwork::NeuralNetwork(const std::vector<int>& layerSizes) {
    for (size_t i = 0; i < layerSizes.size() - 1; ++i) {
        layers.emplace_back(layerSizes[i], layerSizes[i + 1]);
    }
}

NeuralNetwork::NeuralNetwork(const NeuralNetwork& other) {
    layers = other.layers;
}

std::vector<float> NeuralNetwork::feedForward(const std::vector<float>& inputs) {
    std::vector<float> currentOutputs = inputs;
    for (auto& layer : layers) {
        currentOutputs = layer.feedForward(currentOutputs);
    }
    return currentOutputs;
}

void NeuralNetwork::mutate(float rate, float amount) {
    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_real_distribution<float> chanceDist(0.0f, 1.0f);
    std::normal_distribution<float> normalDist(0.0f, 1.0f); // Gaussian noise

    for (auto& layer : layers) {
        for (auto& w : layer.weights) {
            if (chanceDist(gen) < rate) {
                w += normalDist(gen) * amount;
                w = std::clamp(w, -1.0f, 1.0f); // Keep values stable
            }
        }
        for (auto& b : layer.biases) {
            if (chanceDist(gen) < rate) {
                b += normalDist(gen) * amount;
                b = std::clamp(b, -1.0f, 1.0f);
            }
        }
    }
}

NeuralNetwork NeuralNetwork::crossover(const NeuralNetwork& parentA, const NeuralNetwork& parentB) {
    // Clone parentA structure
    NeuralNetwork child(parentA);

    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_real_distribution<float> dist(0.0f, 1.0f);

    for (size_t l = 0; l < child.layers.size(); ++l) {
        auto& childLayer = child.layers[l];
        const auto& parentBLayer = parentB.layers[l];

        // Uniform Crossover: 50% chance to copy from parent B
        for (size_t wIdx = 0; wIdx < childLayer.weights.size(); ++wIdx) {
            if (dist(gen) < 0.5f) {
                childLayer.weights[wIdx] = parentBLayer.weights[wIdx];
            }
        }
        for (size_t bIdx = 0; bIdx < childLayer.biases.size(); ++bIdx) {
            if (dist(gen) < 0.5f) {
                childLayer.biases[bIdx] = parentBLayer.biases[bIdx];
            }
        }
    }

    return child;
}

std::vector<float> NeuralNetwork::getFlatWeights() const {
    std::vector<float> flat;
    for (const auto& layer : layers) {
        flat.insert(flat.end(), layer.weights.begin(), layer.weights.end());
        flat.insert(flat.end(), layer.biases.begin(), layer.biases.end());
    }
    return flat;
}
