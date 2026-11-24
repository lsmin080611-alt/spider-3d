#include "world.h"
#include <math.h>
#include <stdlib.h>

namespace {

inline uint32_t hashAbs32(int32_t v) {
  // Match JS Math.abs((...) | 0) safely even for INT32_MIN
  return (v < 0) ? (uint32_t)(-(int64_t)v) : (uint32_t)v;
}

void appendBlock(int gx, int gz, float simTime, NearbyWorld& out) {
  const float cx = (float)gx * BLOCK_SIZE;
  const float cz = (float)gz * BLOCK_SIZE;

  const int32_t rawSeed = (int32_t)((gx * 73856093) ^ (gz * 19349663) ^ 19283746);
  const uint32_t blockSeed = hashAbs32(rawSeed);
  const bool isGrandAve = (gx == 0);
  const uint32_t zoneType = blockSeed % 6;

  auto pushBldg = [&](const Building& b) {
    if (out.buildingCount < MAX_NEARBY_BUILDINGS) {
      out.buildings[out.buildingCount++] = b;
    }
  };

  if (gx == 0 && gz == 0) {
    // Guaranteed twin tall towers right ahead for immediate first swing
    Building b1{};
    b1.bx = 82.0f; b1.bz = 55.0f; b1.bw = 48.0f; b1.bd = 48.0f; b1.bh = 380.0f;
    b1.palIdx = 0; b1.awningIdx = 1; b1.seed = 10293; b1.hasSpire = true; b1.hasPenthouse = true;
    pushBldg(b1);

    Building b2{};
    b2.bx = -82.0f; b2.bz = 110.0f; b2.bw = 48.0f; b2.bd = 48.0f; b2.bh = 365.0f;
    b2.palIdx = 3; b2.awningIdx = 2; b2.seed = 20481; b2.hasSpire = true; b2.hasPenthouse = false;
    pushBldg(b2);
  } else {
    float slotX[2];
    float slotZ[2];
    int slotCount = 0;

    if (isGrandAve) {
      const float sideShift = ((gz & 1) == 0) ? 1.0f : -1.0f;
      slotX[0] = 84.0f * sideShift;
      slotZ[0] = -25.0f * sideShift;
      slotCount = 1;
    } else if (zoneType == 0) {
      slotX[0] = 64.0f;
      slotZ[0] = -56.0f;
      slotCount = 1;
    } else if (zoneType == 1) {
      slotX[0] = -62.0f; slotZ[0] = -42.0f;
      slotX[1] =  58.0f; slotZ[1] =  44.0f;
      slotCount = 2;
    } else if (zoneType == 2) {
      slotX[0] = -54.0f; slotZ[0] =  26.0f;
      slotX[1] =  60.0f; slotZ[1] = -32.0f;
      slotCount = 2;
    } else {
      const float jx1 = (float)((blockSeed >> 4) % 24) - 12.0f;
      const float jz1 = (float)((blockSeed >> 7) % 24) - 12.0f;
      const float jx2 = (float)((blockSeed >> 10) % 24) - 12.0f;
      const float jz2 = (float)((blockSeed >> 13) % 24) - 12.0f;
      slotX[0] = -60.0f + jx1; slotZ[0] = -38.0f + jz1;
      slotX[1] =  60.0f + jx2; slotZ[1] =  38.0f + jz2;
      slotCount = 2;
    }

    for (int idx = 0; idx < slotCount; idx++) {
      const int32_t rawH = (int32_t)((gx * 73856093) ^ (gz * 19349663) ^ ((idx + 1) * 83492791));
      const uint32_t hSeed = hashAbs32(rawH);

      float bh;
      if (zoneType == 1)      bh = 285.0f + (float)(hSeed % 156);
      else if (zoneType == 2) bh =  85.0f + (float)(hSeed % 72);
      else if (isGrandAve)    bh = 210.0f + (float)(hSeed % 175);
      else                    bh = 145.0f + (float)(hSeed % 195);

      Building b{};
      b.bx = cx + slotX[idx];
      b.bz = cz + slotZ[idx];
      b.bw = 40.0f + (float)(hSeed % 18);
      b.bd = 40.0f + (float)((hSeed >> 3) % 18);
      b.bh = bh;
      b.palIdx = (uint8_t)(hSeed % 5);
      b.awningIdx = (uint8_t)((hSeed >> 5) & 3);
      b.seed = hSeed;
      b.hasSpire = ((hSeed % 3) == 0) || (zoneType == 1);
      b.hasPenthouse = ((hSeed & 1) == 0);
      pushBldg(b);
    }
  }

  // Two cloud layers (mid 215..330m & high 355..495m)
  const int32_t rawC = (int32_t)((gx * 19349663) ^ (gz * 83492791) ^ 55117);
  const uint32_t cSeed = hashAbs32(rawC);
  const float drift = fmodf(simTime * 3.8f, BLOCK_SIZE);

  if (out.cloudCount < MAX_NEARBY_CLOUDS) {
    float ox = fmodf((float)(cSeed % 170) - 85.0f + drift + BLOCK_SIZE, BLOCK_SIZE) - BLOCK_SIZE * 0.5f;
    Cloud cLow{};
    cLow.x = cx + ox;
    cLow.y = 215.0f + (float)(cSeed % 115);
    cLow.z = cz + (float)((cSeed >> 4) % 170) - 85.0f;
    cLow.scale = 0.78f + (float)((cSeed >> 8) % 35) * 0.012f;
    out.clouds[out.cloudCount++] = cLow;
  }
  if (out.cloudCount < MAX_NEARBY_CLOUDS) {
    float ox = fmodf((float)((cSeed >> 3) % 170) - 85.0f + drift * 1.3f + BLOCK_SIZE, BLOCK_SIZE) - BLOCK_SIZE * 0.5f;
    Cloud cHigh{};
    cHigh.x = cx + ox;
    cHigh.y = 355.0f + (float)((cSeed >> 5) % 140);
    cHigh.z = cz + (float)((cSeed >> 7) % 170) - 85.0f;
    cHigh.scale = 0.92f + (float)((cSeed >> 10) % 30) * 0.014f;
    out.clouds[out.cloudCount++] = cHigh;
  }
}

} // namespace

void worldGatherNearby(float refX, float refZ, float simTime, NearbyWorld& out) {
  out.buildingCount = 0;
  out.cloudCount = 0;
  out.centerGx = (int)roundf(refX / BLOCK_SIZE);
  out.centerGz = (int)roundf(refZ / BLOCK_SIZE);

  for (int dgx = -2; dgx <= 2; dgx++) {
    for (int dgz = -2; dgz <= 2; dgz++) {
      appendBlock(out.centerGx + dgx, out.centerGz + dgz, simTime, out);
    }
  }
}
