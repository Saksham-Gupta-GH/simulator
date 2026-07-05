# AeroFlow Engine

A high-performance, real-time Computational Fluid Dynamics (CFD) Sandbox built with a C++ Navier-Stokes solver and compiled to WebAssembly (WASM) for the browser.


🌍 **Live Demo:** [https://simulator-phi-five.vercel.app](https://simulator-phi-five.vercel.app)

## Features

- **C++ WebAssembly Physics Engine:** High-performance grid-based fluid simulation based on Jos Stam's Stable Fluids.
- **RGB Fluid Dynamics:** Full multi-channel advection and diffusion for colored smoke mixing.
- **Vorticity Confinement:** Simulates realistic, highly detailed turbulence and smoke swirls.
- **Interactive Wind Tunnel:** Draw freehand walls, drop solid primitive shapes (rectangles, triangles, circles), and rotate them dynamically.
- **Multiple Emitter Types:** Place point emitters or line emitters with customizable directions, sizes, speeds, and colors.
- **Decoupled HD Rendering:** Physics runs on a highly optimized low-resolution simulation grid while shapes and UI render on a sharp HD canvas overlay.
- **Telemetry & Controls:** Change grid resolution, smoke density, viscosity, and monitor frame rates in real-time.

## Technology Stack

- **Core Physics:** C++17 (Navier-Stokes Solver, Gauss-Seidel Relaxation, MacCormack-style advection).
- **WebAssembly Compilation:** Emscripten.
- **Frontend App:** Vanilla JavaScript, HTML5 Canvas API, CSS3.
- **Build Tooling:** Vite.

## Local Development

Ensure you have Node.js and the Emscripten SDK (`emcc`) installed on your system.

```bash
# Install dependencies
npm install

# Compile the C++ WASM module (requires Emscripten)
./test-compile.sh

# Run the local Vite dev server
npm run dev
```

The application will be served at `http://localhost:5173`.

## Architecture Highlights

The physics solver operates on a 1D flat array mapping to a 2D grid. The `step()` function computes the fluid dynamics in the following order:
1. **Velocity Diffusion & Advection:** Viscosity solver and advection of velocity fields.
2. **Pressure Projection (Neumann Boundaries):** Enforces mass conservation and handles solid internal obstacles cleanly to prevent velocity divergence.
3. **Vorticity Confinement:** Recalculates curl to preserve energetic swirls.
4. **RGB Density Advection:** Injects and advects fluid densities across three independent color channels.
