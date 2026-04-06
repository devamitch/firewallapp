cmake_minimum_required(VERSION 3.13)

# Define the library name here.
project(appmodules)

# This file includes all the necessary to let you build your React Native application
include(${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)

# Add the AIEngine C++ source code
# Path crawls back from jni → main → src → app → android → firewallapp root → shared
target_sources(${CMAKE_PROJECT_NAME} PRIVATE ../../../../../shared/AIEngine.cpp)

# Add the shared directory to the include path so CMake can find AIEngine.h
target_include_directories(${CMAKE_PROJECT_NAME} PUBLIC ../../../../../shared)
