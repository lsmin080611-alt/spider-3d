#pragma once
// Spider 3D — 3D Vector Pendulum Web Swing, Building Collisions & Camera Dynamics

#include "types.h"

void physicsReset(GameState& gs);
void physicsSetPopup(GameState& gs, const char* text, uint16_t col, float dur = 1.15f);
void physicsSpawnSparks(GameState& gs, float x, float y, float z, uint16_t col, int count, float spread);
void physicsStep(GameState& gs, const InputState& in, const NearbyWorld& world, float dt);
