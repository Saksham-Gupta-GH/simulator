#!/bin/bash
emcc src/cpp/fluid_solver.cpp src/cpp/bindings.cpp -o src/web/public/wasm/fluid_sim.js -O3 -s WASM=1 -s ALLOW_MEMORY_GROWTH=1 -s MODULARIZE=1 -s EXPORT_NAME='createFluidSimModule' -s EXPORTED_RUNTIME_METHODS="['HEAPU8', 'HEAPF32', 'wasmMemory']" --bind
