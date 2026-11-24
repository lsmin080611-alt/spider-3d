#pragma once
// Spider 3D — Procedural Non-Uniform Manhattan City Generator (Zero Heap Allocation)

#include "types.h"

void worldGatherNearby(float refX, float refZ, float simTime, NearbyWorld& out);
