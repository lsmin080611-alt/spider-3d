#pragma once
// Spider 3D — 320x170 RGB565 Single-Sprite 3D Renderer & Hardware Diagnostics HUD

#include "types.h"

bool rendererInit();
void rendererDrawFrame(const GameState& gs, const InputState& in, const NearbyWorld& world);
