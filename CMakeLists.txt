cmake_minimum_required(VERSION 3.15)
project(FluidSimulation LANGUAGES CXX)

# Require clean, modern C++20 standard
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Source files
set(SOURCES
    src/cpp/fluid_solver.cpp
    src/cpp/simulation.cpp
    src/cpp/bindings.cpp
)

# Header files
set(HEADERS
    src/cpp/fluid_solver.h
    src/cpp/simulation.h
)

# Standard C++ static library target (enables standard native unit tests or desktop integrations)
add_library(fluid_engine STATIC ${SOURCES} ${HEADERS})

# Specialized WebAssembly compilation rules when run inside the Emscripten environment
if(EMSCRIPTEN)
    message(STATUS "Configuring build for WebAssembly using Emscripten")
    
    add_executable(fluid_sim_wasm ${SOURCES})
    
    # Configure output naming to match web integration requirements
    set_target_properties(fluid_sim_wasm PROPERTIES 
        OUTPUT_NAME "fluid_sim"
        SUFFIX ".js"
    )

    # Enable heavy compiler optimizations
    target_compile_options(fluid_sim_wasm PRIVATE -O3 -ffast-math)
    
    # Define Emscripten-specific linker flags for bindings, memory growth, and modularization
    target_link_options(fluid_sim_wasm PRIVATE
        --bind
        -O3
        -s WASM=1
        -s ALLOW_MEMORY_GROWTH=1
        -s MODULARIZE=1
        -s EXPORT_NAME="createFluidSimModule"
    )
endif()
