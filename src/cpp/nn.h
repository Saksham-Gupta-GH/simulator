#ifndef NN_H
#define NN_H

#include <vector>
#include <random>

/**
 * @brief Represents a single dense (fully-connected) neural network layer.
 * Flat array vectors are used instead of matrices for cache speed and easier Wasm mapping.
 */
struct Layer {
    int numInputs;
    int numOutputs;
    std::vector<float> weights; // Flat array of size (numInputs * numOutputs)
    std::vector<float> biases;  // Array of size (numOutputs)

    /**
     * @brief Constructor that initializes weights and biases with random values.
     */
    Layer(int inputs, int outputs);

    /**
     * @brief Computes layer outputs using forward propagation and a TanH/Sigmoid activation function.
     */
    std::vector<float> feedForward(const std::vector<float>& inputs);
};

/**
 * @brief Complete Multi-Layer Feedforward Neural Network (Car Brain).
 */
class NeuralNetwork {
public:
    std::vector<Layer> layers;

    /**
     * @brief Constructor that initializes layers based on sizes.
     * Standard layout: 5 inputs -> 6 hidden nodes -> 2 outputs.
     */
    NeuralNetwork(const std::vector<int>& layerSizes);

    /**
     * @brief Copy constructor for easy genetic cloning.
     */
    NeuralNetwork(const NeuralNetwork& other);

    /**
     * @brief Executes full network forward propagation, returning output control decisions.
     */
    std::vector<float> feedForward(const std::vector<float>& inputs);

    /**
     * @brief Mutates network weights and biases using a standard Gaussian distribution.
     * @param rate Chance of mutation (0.0 to 1.0)
     * @param amount Maximum alteration magnitude (wiggle amount)
     */
    void mutate(float rate, float amount);

    /**
     * @brief Combines weights from two parent networks (Crossover) to breed a child.
     */
    static NeuralNetwork crossover(const NeuralNetwork& parentA, const NeuralNetwork& parentB);

    /**
     * @brief Flattens all weights and biases into a single contiguous array.
     * Extremely useful for rendering synapses in the JS frontend via a single pointer!
     */
    std::vector<float> getFlatWeights() const;
};

#endif // NN_H
