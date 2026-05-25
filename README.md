# AeroFlow AI: High-Performance C++ & WebAssembly Interactive Aerodynamics Wind Tunnel

A visually spectacular, physically authentic 2D aerodynamic wind tunnel simulator running at **60 FPS** natively in the browser. Powered by a high-performance fluid dynamics solver written in **modern C++20**, compiled to **WebAssembly (Wasm)**, and integrated with a **zero-copy HTML5 Canvas blitting pipeline** and dynamic telemetry analytics HUD.

👉 **[Interactive Live Vercel Deployment](https://simulator-phi-five.vercel.app/)**

```
 ┌──────────────── AeroFlow Laboratory Console (JS) ───────────────┐
 │ [ Drag: 0.045 Cd ]   [ Lift: 0.820 Cl ]   [ Reynolds: 124,000 ] │
 │  ┌───────────────────────────────────────────────────────────┐  │
 │  │        ≈ ≈ ≈ ≈ ≈ ≈ (Accelerated Violet Flow)              │  │
 │  │      ≈ ≈ █ ≈ ≈ ≈ (Low pressure / High lift)               │  │
 │  │    ≈ ≈ ≈ ≈ ≈ ≈ ≈  ◄──── Direct Float32Array Blit          │  │
 │  │      (Turbulent Orange Wake Eddy / High drag)             │  │
 │  └───────────────────────────────────────────────────────────┘  │
 └────────┬────────────────────────────────────────────────────────┘
          │ (Zero-Copy shared buffer over shared memory heap)
 ┌────────▼────────── C++ Fluid Physics Engine (Wasm) ─────────────┐
 │  • 2D Navier-Stokes Stable Fluids • Poisson Pressure Solver      │
 │  • Semi-Lagrangian Advection     • Boundary Integral Sums      │
 └─────────────────────────────────────────────────────────────────┘
```

---

## ⚡ Core Technical Features

This project showcases advanced computational physics, hardware-close memory optimizations, and premium UX engineering suitable for real-time simulation engines:

### 1. 2D Navier-Stokes Fluid Solver (Stable Fluids)
Solving partial differential equations for fluid dynamics in real time is computationally intensive. This engine implements Jos Stam’s **Stable Fluids** method:
*   **Viscous Diffusion:** Computes velocity and density diffusion across a $150 \times 100$ cell grid using Jacobi relaxation iterations.
*   **Divergence-Free Projection:** Solves a Poisson pressure equation to enforce mass conservation (incompressibility). Subtracting the pressure gradient from the velocities creates those beautiful, swirling turbulent vortices (eddies) behind shapes.
*   **Semi-Lagrangian Advection:** Linear backtracing of coordinates paired with bilinear interpolation to transport velocities and density smoke streamlines smoothly.

### 2. Zero-Copy WebAssembly Memory Pipeline
Transferring 15,000 grid nodes (pressure, velocities) and 8,000 particle coordinates from WebAssembly to JavaScript on every frame can easily create severe garbage collection bottlenecks.
*   **The Solution:** The C++ engine declares raw heap array pointers and returns them directly to JavaScript as `uintptr_t` memory addresses.
*   **Direct Heap Blitting:** JavaScript wraps the Wasm shared heap memory using flat `Float32Array` and `Uint8Array` views pointing directly to Emscripten's `Module.HEAPF32.buffer` and `Module.HEAPU8.buffer`. The Canvas renderer reads particle states and pressure grids directly from C++ memory blocks with **0% transfer overhead** and **0 bytes of memory allocations** in the rendering loop.

### 3. Dynamic Aerodynamic Pressure Integrals
Rather than just rendering aesthetic graphics, the C++ solver integrates physical forces live on screen:
*   **Drag Coefficient ($C_d$):** Integrates the pressure difference along the front and back faces of obstacles. Watch it plunge from $1.15$ (blunt block) to $0.04$ (a perfect teardrop airfoil).
*   **Lift Coefficient ($C_l$):** Sums pressure differences along the bottom and top boundaries. Demonstrates **Bernoulli's principle** live on screen—as you pitch a wing, the air above accelerates, the pressure drops, and positive Lift is generated.
*   **Formula 1 Downforce:** Prove how race cars generate downforce. Load the F1 Car profile and see it generate **negative lift ($C_l < 0$)** designed to press wheels onto the tarmac!

### 4. Angle of Attack Trigonometric Rotations
Airfoils are generated mathematically in continuous floating-point space. When you adjust the **Angle of Attack Slider ($-20^\circ$ to $+20^\circ$)**, the C++ code performs coordinate rotations on cell indices at runtime:
$$r_x = c_x + (x - c_x)\cos(\theta) - (y - c_y)\sin(\theta)$$
$$r_y = c_y + (x - c_x)\sin(\theta) + (y - c_y)\cos(\theta)$$
This allows the solver to calculate lift, drag, boundary layer separations, and **aerodynamic stalls** (where flow separates, lift collapses, and drag spikes) dynamically at any pitch angle.

### 5. Unified Touch & Mobile Responsiveness
*   **Pointer Events:** Employs standard HTML5 Pointer Events (`pointerdown`, `pointermove`, `pointerup`), unifying mouse clicks, stylus inputs, and mobile touches into a single robust pipeline.
*   **Mobile Gesture Lock (`touch-action: none`):** Locks default page scrolling and rubber-banding gestures in the CSS layer during active touch dragging, allowing immediate, fluid painting of obstacles on iOS and Android devices.

---

## 📁 Project Structure

```
simulator/
├── src/
│   ├── cpp/
│   │   ├── fluid_solver.h      # Navier-Stokes step calculations & boundary codes
│   │   ├── fluid_solver.cpp    # Stable Fluids advect, diffuse, and project
│   │   ├── simulation.h        # Coordinates particle system, presets, & integrals
│   │   ├── simulation.cpp      # Rotates airfoils and sums boundary pressures
│   │   └── bindings.cpp        # Emscripten Embind exports & memory ptr castings
│   └── web/
│       ├── public/
│       │   ├── wasm/
│       │   │   ├── fluid_sim.js    # Compiled C++ Wasm binary loading script
│       │   │   └── fluid_sim.wasm  # Compiled low-level Wasm bytecodes
│       │   └── app.js              # Pointer listeners, WebGL particle sweeps, & charts
│       ├── index.html          # Frosted glassmorphic dashboard console interface
│       └── style.css           # Neon cyberpunk visuals & responsive CSS grids
├── CMakeLists.txt              # Standard unified build configuration
├── package.json                # Vite dev shortcuts and emcc compiling script
└── README.md                   # Recruiter showcase documentation
```

---

## 🛠️ Local Development & Compiler Setup

### Prerequisites
You need [Node.js](https://nodejs.org/) installed to run Vite, and [Emscripten SDK](https://emscripten.org/) if you want to modify and compile the C++ physics core.

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/Saksham-Gupta-GH/simulator.git
    cd simulator
    ```
2.  **Install Vite Dev Server**:
    ```bash
    npm install
    ```
3.  **Run Development Server**:
    ```bash
    npm run dev
    ```
    Open your browser and visit `http://localhost:5173`.

### ⚙️ Re-compiling the C++ core to WebAssembly
To compile any modifications made to the C++ grid solver or telemetry integrals:
```bash
npm run compile
```
*Note: This targets Emscripten's compiler `emcc` with full `-O3` performance flags, exporting modules directly into `src/web/public/wasm/fluid_sim.js`.*

### 📦 Verify Production Static Bundle
To build Vite production targets to `/dist/`:
```bash
npm run build
```

---

## 🚀 Easy Vercel Deployment

This project operates as a static client with pre-compiled Wasm targets, making it **100% serverless**. You can host it on **Vercel** in seconds:

1.  Push the project to your GitHub repository: `https://github.com/Saksham-Gupta-GH/simulator`.
2.  Log in to [Vercel](https://vercel.com/) and click **Add New Project**.
3.  Import the repository `simulator`.
4.  Configure the build overrides:
    *   **Build Command:** `npm run build`
    *   **Output Directory:** `dist`
5.  Click **Deploy**! Vercel will host your beautiful aerodynamics playground instantly.

---

### 💻 Technologies Used
*   **Languages:** C++20, JavaScript (ES6+), HTML5 Canvas (Context 2D / WebGL), CSS3.
*   **Compilation Toolchain:** CMake, Emscripten (`emcc`).
*   **Dev Server / Bundler:** Vite.
*   **Hosting Platform:** Vercel / GitHub.
