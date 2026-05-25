# NEON DRIVE AI (C++ Neural Network Simulator)

Welcome to **Neon Drive AI**, a high-performance Artificial Intelligence simulator written in C++ and compiled to WebAssembly. 

This project simulates 100 autonomous cars simultaneously. Each car is equipped with 5 Lidar sensors (raycasts) and controlled by a custom-built Feedforward Neural Network. Through the process of neuroevolution (a Genetic Algorithm), the cars learn to navigate a race track over successive generations without any external human guidance.

## Features
- **Pure C++ Neural Network**: Built entirely from scratch using arrays and matrix multiplication without any third-party AI libraries (like TensorFlow or PyTorch).
- **Genetic Algorithm (NEAT-style)**: Simulates survival of the fittest. The best-performing cars breed and pass their mutated synaptic weights to the next generation.
- **Zero-Copy WebAssembly Bridge**: Passes physics and telemetry data directly from the C++ heap to the Javascript rendering engine at 60 FPS.
- **80s Retro Arcade Interface**: Immersive neon synthwave visuals, glowing scanlines, and a live "Brain Visualizer" that shows the neural network thinking in real-time.

## How to Play
1. **Spawn**: 100 cars will spawn at the start of the track. Initially, they are completely randomized and will crash immediately.
2. **Evolve**: Once all cars crash, the generation ends. The C++ engine crosses over the brains of the top 2 cars, mutates them, and spawns the next generation.
3. **Learn**: Watch as the AI learns to take corners perfectly over the course of 10-20 generations.
4. **Draw Tracks**: Use your mouse to draw custom walls and obstacles on the canvas to challenge the AI!

## Building Locally
The WebAssembly compilation requires Emscripten (`emcc`).
```bash
# 1. Install dependencies
npm install

# 2. Compile C++ to WebAssembly
npm run compile

# 3. Start the dev server
npm run dev
```

## Deployment
This repository is configured to auto-deploy to Vercel on every push to the `main` branch. The Vite build system automatically bundles the WebAssembly outputs for production.
