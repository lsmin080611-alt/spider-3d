#include "physics.h"
#include "audio_hw.h"
#include <math.h>
#include <string.h>
#include <stdlib.h>

namespace {

constexpr float PI_F     = 3.14159265f;
constexpr float TWO_PI_F = 6.28318530f;

uint32_t rngState = 2463534242u;
inline float rand01() {
  uint32_t x = rngState;
  x ^= x << 13;
  x ^= x >> 17;
  x ^= x << 5;
  rngState = x;
  return (float)(x & 0xFFFFu) / 65535.0f;
}

inline float clampf(float v, float lo, float hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

inline float wrapAngleDiff(float target, float current) {
  float d = fmodf(target - current + PI_F, TWO_PI_F);
  if (d < 0.0f) d += TWO_PI_F;
  return d - PI_F;
}

inline float hypot2f(float a, float b) {
  return sqrtf(a * a + b * b);
}

inline float hypot3f(float a, float b, float c) {
  return sqrtf(a * a + b * b + c * c);
}

struct AnchorResult {
  bool  found;
  float wx, wy, wz;
  int   side;
};

AnchorResult findWallAnchor(const GameState& gs, float turnInput, float fwdInput, const NearbyWorld& world) {
  AnchorResult best{};
  best.found = false;
  float minScore = 9999.0f;

  const float cosY = cosf(gs.camYaw);
  const float sinY = sinf(gs.camYaw);
  const float horizSpd = hypot2f(gs.vx, gs.vz);
  const bool hasTurnIntent = fabsf(turnInput) >= 0.18f;
  const int preferSide = !hasTurnIntent ? -gs.lastAnchorSide : (turnInput < 0.0f ? -1 : 1);
  const float lowAltFactor = (gs.py < 55.0f) ? clampf((55.0f - gs.py) / 55.0f, 0.0f, 1.0f) : 0.0f;

  for (int i = 0; i < world.buildingCount; i++) {
    const Building& b = world.buildings[i];
    const float dx = b.bx - gs.px;
    const float dz = b.bz - gs.pz;
    const float localX = dx * cosY - dz * sinY;
    const float localZ = dx * sinY + dz * cosY;

    if (localZ > 28.0f && localZ < 280.0f && fabsf(localX) > 6.0f && fabsf(localX) < 205.0f) {
      const float altBias = (fwdInput < -0.3f) ? 68.0f : 95.0f;
      const float targetWallY = fminf(b.bh - 6.0f, fmaxf(gs.py + altBias, 130.0f));
      if (targetWallY <= gs.py + 8.0f) continue;

      const float wx = b.bx - (dx >= 0.0f ? b.bw * 0.5f : -b.bw * 0.5f);
      const float wz = b.bz - (dz >= 0.0f ? b.bd * 0.5f : -b.bd * 0.5f);
      const float cornerLocalX = (wx - gs.px) * cosY - (wz - gs.pz) * sinY;
      const int side = (cornerLocalX >= 0.0f) ? 1 : -1;

      const float idealZ = (95.0f - 28.0f * lowAltFactor) + horizSpd * (0.45f - 0.17f * lowAltFactor);
      float sc = fabsf(localZ - idealZ) + fabsf(fabsf(localX) - 56.0f) * 0.48f;

      if (lowAltFactor > 0.0f) {
        const float dyAnchor = targetWallY - gs.py;
        const float horizDist = hypot2f(wx - gs.px, wz - gs.pz);
        const float steepness = dyAnchor / fmaxf(20.0f, horizDist);
        sc -= fminf(55.0f, steepness * 36.0f) * lowAltFactor;
        if (horizDist > dyAnchor * 1.45f) {
          sc += fminf(60.0f, (horizDist - dyAnchor * 1.45f) * 0.55f) * lowAltFactor;
        }
      }
      if (side == preferSide) {
        sc -= hasTurnIntent ? 75.0f : 35.0f;
      }

      if (sc < minScore) {
        minScore = sc;
        best.found = true;
        best.wx = wx;
        best.wy = targetWallY;
        best.wz = wz;
        best.side = side;
      }
    }
  }
  return best;
}

bool startWebSwing(GameState& gs, const InputState& in, const NearbyWorld& world, bool fromGroundLaunch) {
  const AnchorResult target = findWallAnchor(gs, in.turn, in.fwd, world);
  if (!target.found) return false;

  gs.isGliding = false;
  gs.ax = target.wx;
  gs.ay = target.wy;
  gs.az = target.wz;
  gs.anchorSide = target.side;
  gs.lastAnchorSide = gs.anchorSide;
  gs.ropeLen = hypot3f(gs.px - gs.ax, gs.py - gs.ay, gs.pz - gs.az);

  const float sinY = sinf(gs.camYaw);
  const float cosY = cosf(gs.camYaw);

  if (fromGroundLaunch) {
    gs.groundLaunchTimer = 0.65f;
    const float hSpd = hypot2f(gs.vx, gs.vz);
    if (hSpd < 34.0f) {
      gs.vx = sinY * 34.0f;
      gs.vz = cosY * 34.0f;
    }
    gs.vy = fmaxf(gs.vy, 24.0f);
    physicsSetPopup(gs, "WEB ZIP LAUNCH!", COL_NEON_CYAN, 1.0f);
  }

  if (gs.diveCharge >= 0.22f) {
    const float lowBonus = (gs.py < 45.0f) ? (1.0f + (45.0f - gs.py) / 45.0f * 0.30f) : 1.0f;
    const float softBoostCap = BASE_SWING_MAX_SPD + 16.0f;
    const float curSpd = hypot3f(gs.vx, gs.vy, gs.vz);
    const float rawBoost = (10.0f + gs.diveCharge * 10.0f) * lowBonus;
    const float boost = (curSpd < softBoostCap) ? fminf(rawBoost, softBoostCap - curSpd) : 0.0f;
    gs.vx += sinY * boost;
    gs.vz += cosY * boost;
    gs.shakeMag = fmaxf(gs.shakeMag, 2.4f);
    physicsSpawnSparks(gs, gs.px, gs.py, gs.pz, COL_NEON_CYAN, 10, 30.0f);
    physicsSetPopup(gs, "DIVE BOOST!", COL_NEON_CYAN, 1.1f);
    gs.diveCharge = 0.0f;
    gs.isDiving = false;
  }

  gs.peakYBeforeSwing = fmaxf(gs.py, 115.0f);
  gs.swingMinY = gs.py;
  gs.isSwinging = true;
  gs.swingTimer = 0.0f;
  gs.passedBottom = false;
  gs.inPerfectWindow = false;
  gs.perfectGraceTimer = 0.0f;
  gs.swingWebShootTimer = 0.05f;
  gs.isRopeTaut = false;
  gs.doingFlip = false;
  gs.flipAngle = 0.0f;

  physicsSpawnSparks(gs, gs.ax, gs.ay, gs.az, COL_WHITE, 6, 20.0f);
  audioPlaySfx(SfxId::WEB_SHOOT);
  return true;
}

void onSwingDown(GameState& gs, const InputState& in, const NearbyWorld& world) {
  gs.swingReattachCooldown = 0.0f;
  if (gs.py <= 4.0f) {
    gs.vy = 58.0f;
    const float sinY = sinf(gs.camYaw);
    const float cosY = cosf(gs.camYaw);
    const float hSpd = hypot2f(gs.vx, gs.vz);
    if (hSpd < 26.0f) {
      gs.vx = sinY * 26.0f;
      gs.vz = cosY * 26.0f;
    }
    gs.autoCatchAfterJump = true;
    physicsSpawnSparks(gs, gs.px, 1.5f, gs.pz, COL_NEON_CYAN, 6, 18.0f);
    audioPlaySfx(SfxId::JUMP);
    return;
  }

  if (!gs.isSwinging) {
    startWebSwing(gs, in, world, false);
  }
}

void onSwingUp(GameState& gs) {
  gs.autoCatchAfterJump = false;
  if (!gs.isSwinging) return;

  const bool wasPerfect = gs.inPerfectWindow || (gs.perfectGraceTimer > 0.0f);
  gs.isSwinging = false;
  gs.inPerfectWindow = false;
  gs.perfectGraceTimer = 0.0f;
  gs.isRopeTaut = false;
  gs.swingWebShootTimer = 0.0f;
  gs.groundLaunchTimer = 0.0f;

  if ((gs.swingTimer > 0.18f && (gs.passedBottom || gs.vy > 8.0f)) || wasPerfect) {
    gs.swingCombo = (gs.swingCombo + (wasPerfect ? 2 : 1));
    if (gs.swingCombo > 12) gs.swingCombo = 12;

    const float swingDepth = fmaxf(10.0f, gs.peakYBeforeSwing - gs.swingMinY);
    const float depthRatio = fminf(1.0f, swingDepth / 75.0f);
    const float sinY = sinf(gs.camYaw);
    const float cosY = cosf(gs.camYaw);
    const float maxCruiseSpd = BASE_SWING_MAX_SPD;
    const float softBoostCap = BASE_SWING_MAX_SPD + 16.0f;

    if (wasPerfect) {
      const float upwardKick = 12.0f + depthRatio * 8.0f;
      const float targetVy = fminf(88.0f, gs.vy + upwardKick);
      gs.vy = fmaxf(gs.vy, targetVy);

      const float curSpd = hypot3f(gs.vx, gs.vy, gs.vz);
      const float rawFwd = 10.0f + depthRatio * 6.0f;
      const float fwdAdd = (curSpd < softBoostCap) ? fminf(rawFwd, softBoostCap - curSpd) : 0.0f;
      gs.vx += sinY * fwdAdd;
      gs.vz += cosY * fwdAdd;

      const float relSpd = hypot3f(gs.vx, gs.vy, gs.vz);
      if (relSpd > softBoostCap) {
        const float hRel = hypot2f(gs.vx, gs.vz);
        const float remSq = softBoostCap * softBoostCap - gs.vy * gs.vy;
        if (remSq > 0.0f && hRel > 1.0f) {
          const float targetH = fminf(hRel, fmaxf(hRel * 0.65f, sqrtf(remSq)));
          const float hSc = targetH / hRel;
          gs.vx *= hSc;
          gs.vz *= hSc;
        }
      }

      gs.perfectBuffTimer = 3.4f;
      gs.shakeMag = fmaxf(gs.shakeMag, 2.6f);
      physicsSpawnSparks(gs, gs.px, gs.py, gs.pz, COL_GOLD, 8, 32.0f);
      physicsSpawnSparks(gs, gs.px, gs.py, gs.pz, COL_NEON_CYAN, 6, 28.0f);
      physicsSetPopup(gs, "PERFECT RELEASE!!", COL_NEON_CYAN, 1.25f);
      audioPlaySfx(SfxId::PERFECT_RELEASE);
    } else {
      const float upwardKick = 7.5f + depthRatio * 6.5f;
      const float targetVy = fminf(73.0f, gs.vy + upwardKick);
      gs.vy = fmaxf(gs.vy, targetVy);

      const float curHSpd = hypot2f(gs.vx, gs.vz);
      if (curHSpd < maxCruiseSpd) {
        const float fwdAdd = fminf(3.0f + depthRatio * 4.0f, maxCruiseSpd - curHSpd);
        gs.vx += sinY * fwdAdd;
        gs.vz += cosY * fwdAdd;
      }

      const float normalReleaseCap = BASE_SWING_MAX_SPD + 6.0f;
      const float relSpd = hypot3f(gs.vx, gs.vy, gs.vz);
      if (relSpd > normalReleaseCap) {
        const float hRel = hypot2f(gs.vx, gs.vz);
        const float remSq = normalReleaseCap * normalReleaseCap - gs.vy * gs.vy;
        if (remSq > 0.0f && hRel > 1.0f) {
          const float targetH = fminf(hRel, fmaxf(hRel * 0.65f, sqrtf(remSq)));
          const float hSc = targetH / hRel;
          gs.vx *= hSc;
          gs.vz *= hSc;
        }
      }

      if (swingDepth > 55.0f) {
        physicsSetPopup(gs, "BIG ARC!", COL_GOLD, 0.9f);
      }
      audioPlaySfx(SfxId::WEB_RELEASE);
    }

    gs.doingFlip = true;
    gs.flipAngle = 0.0f;
  } else if (gs.swingTimer > 0.10f && gs.vy > 4.0f) {
    gs.vy = fmaxf(gs.vy, fminf(52.0f, gs.vy + 7.0f));
    gs.doingFlip = true;
    gs.flipAngle = 0.0f;
  }

  gs.peakYBeforeSwing = fmaxf(115.0f, gs.py);
}

void handleBuildingCollisions(GameState& gs, const NearbyWorld& world, float& outMinWallDist, int& outNearestSide) {
  outMinWallDist = 999.0f;
  outNearestSide = 0;
  const float cosY = cosf(gs.camYaw);
  const float sinY = sinf(gs.camYaw);

  for (int i = 0; i < world.buildingCount; i++) {
    const Building& b = world.buildings[i];
    if (gs.py >= b.bh + 4.0f) continue;

    const float hw = b.bw * 0.5f + 1.3f;
    const float hd = b.bd * 0.5f + 1.3f;

    const float dxBox = fmaxf(0.0f, fabsf(gs.px - b.bx) - hw);
    const float dzBox = fmaxf(0.0f, fabsf(gs.pz - b.bz) - hd);
    const float wallDist = hypot2f(dxBox, dzBox);

    if (wallDist < outMinWallDist) {
      outMinWallDist = wallDist;
      const float relX = (b.bx - gs.px) * cosY - (b.bz - gs.pz) * sinY;
      outNearestSide = (relX >= 0.0f) ? 1 : -1;
    }

    if (gs.py < b.bh &&
        gs.px > b.bx - hw && gs.px < b.bx + hw &&
        gs.pz > b.bz - hd && gs.pz < b.bz + hd) {
      const float ox = fminf(gs.px - (b.bx - hw), (b.bx + hw) - gs.px);
      const float oz = fminf(gs.pz - (b.bz - hd), (b.bz + hd) - gs.pz);
      float nx = 0.0f, nz = 0.0f;
      if (ox < oz) {
        nx = (gs.px < b.bx) ? -1.0f : 1.0f;
        gs.px = (gs.px < b.bx) ? (b.bx - hw) : (b.bx + hw);
      } else {
        nz = (gs.pz < b.bz) ? -1.0f : 1.0f;
        gs.pz = (gs.pz < b.bz) ? (b.bz - hd) : (b.bz + hd);
      }

      const float hSpd = hypot2f(gs.vx, gs.vz);
      if (hSpd > 0.5f) {
        const float vn = gs.vx * nx + gs.vz * nz;
        if (vn < 0.0f) {
          const float impactCos = fabsf(vn) / hSpd;
          const float crashThreshold = (hSpd > 65.0f) ? 0.82f : 0.74f;

          if (impactCos > crashThreshold) {
            const float absVn = fabsf(vn);
            const float wallRatio = clampf((absVn - 28.0f) / 86.0f, 0.0f, 1.0f);
            gs.vx = (gs.vx - vn * nx) * 0.25f + nx * fminf(18.0f, absVn * 0.28f);
            gs.vz = (gs.vz - vn * nz) * 0.25f + nz * fminf(18.0f, absVn * 0.28f);
            gs.vy *= 0.45f;
            gs.isSwinging = false;
            gs.inPerfectWindow = false;
            gs.perfectGraceTimer = 0.0f;
            gs.isRopeTaut = false;
            gs.swingReattachCooldown = 0.18f;
            gs.diveCharge = 0.0f;
            gs.shakeMag = fmaxf(gs.shakeMag, 3.0f + wallRatio * 3.0f);
            physicsSpawnSparks(gs, gs.px, gs.py, gs.pz, COL_CRIMSON, 10, 32.0f);
            physicsSetPopup(gs, "WALL CRASH!", COL_CRIMSON, 1.0f);
            audioPlaySfx(SfxId::PLAYER_HIT);
          } else {
            const float tx = gs.vx - vn * nx;
            const float tz = gs.vz - vn * nz;
            const float keepRatio = fmaxf(0.90f, 0.97f - impactCos * 0.09f);
            gs.vx = tx * keepRatio + nx * 2.4f;
            gs.vz = tz * keepRatio + nz * 2.4f;

            const float slideYaw = atan2f(gs.vx, gs.vz);
            gs.camYaw += wrapAngleDiff(slideYaw, gs.camYaw) * 0.35f;

            if (gs.wallSlideCooldown <= 0.0f && hSpd > 26.0f) {
              gs.wallSlideCooldown = 0.42f;
              physicsSpawnSparks(gs, gs.px, gs.py, gs.pz, COL_NEON_CYAN, 6, 20.0f);
              physicsSetPopup(gs, "WALL SLIDE!", COL_NEON_CYAN, 0.85f);
              gs.shakeMag = fmaxf(gs.shakeMag, 1.3f);
              audioPlaySfx(SfxId::WALL_SLIDE);
            }
          }
        }
      }
    }
  }
}

} // namespace

void physicsReset(GameState& gs) {
  const bool prevDiag = gs.showDiagHud;
  gs = {};
  gs.px = 0.0f;
  gs.py = 124.0f;
  gs.pz = -60.0f;
  gs.vx = 0.0f;
  gs.vy = 0.0f;
  gs.vz = 28.0f;
  gs.camYaw = 0.0f;
  gs.anchorSide = 1;
  gs.lastAnchorSide = -1;
  gs.peakYBeforeSwing = 124.0f;
  gs.swingMinY = 124.0f;
  gs.camDist = 15.5f;
  gs.camLagYaw = 0.0f;
  gs.camPitch = -0.06f;
  gs.camRoll = 0.0f;
  gs.fovD = 175.0f;
  gs.showDiagHud = prevDiag;
  physicsSetPopup(gs, "SWING READY!", COL_GOLD, 1.4f);
}

void physicsSetPopup(GameState& gs, const char* text, uint16_t col, float dur) {
  strncpy(gs.popupText, text, sizeof(gs.popupText) - 1);
  gs.popupText[sizeof(gs.popupText) - 1] = '\0';
  gs.popupCol = col;
  gs.popupTimer = dur;
}

void physicsSpawnSparks(GameState& gs, float x, float y, float z, uint16_t col, int count, float spread) {
  int spawned = 0;
  for (int i = 0; i < MAX_SPARKS && spawned < count; i++) {
    if (!gs.sparks[i].active) {
      Spark& s = gs.sparks[i];
      s.active = true;
      s.x = x; s.y = y; s.z = z;
      s.vx = (rand01() - 0.5f) * spread * 2.0f;
      s.vy = (rand01() - 0.35f) * spread * 1.8f;
      s.vz = (rand01() - 0.5f) * spread * 2.0f;
      s.life = 0.25f + rand01() * 0.28f;
      s.col = col;
      spawned++;
    }
  }
}

void physicsStep(GameState& gs, const InputState& in, const NearbyWorld& world, float dt) {
  gs.simTime += dt;

  // Timers
  if (gs.wallSlideCooldown > 0.0f) gs.wallSlideCooldown = fmaxf(0.0f, gs.wallSlideCooldown - dt);
  if (gs.shakeMag > 0.0f) gs.shakeMag = fmaxf(0.0f, gs.shakeMag - 12.0f * dt);
  if (gs.perfectBuffTimer > 0.0f) gs.perfectBuffTimer = fmaxf(0.0f, gs.perfectBuffTimer - dt);
  if (gs.swingReattachCooldown > 0.0f) gs.swingReattachCooldown = fmaxf(0.0f, gs.swingReattachCooldown - dt);
  if (gs.swingWebShootTimer > 0.0f) gs.swingWebShootTimer = fmaxf(0.0f, gs.swingWebShootTimer - dt);
  if (gs.perfectGraceTimer > 0.0f) gs.perfectGraceTimer = fmaxf(0.0f, gs.perfectGraceTimer - dt);
  if (gs.popupTimer > 0.0f) gs.popupTimer = fmaxf(0.0f, gs.popupTimer - dt);

  // Swing button edges & hold auto-attach
  if (in.swingPressed)  onSwingDown(gs, in, world);
  if (in.swingReleased) onSwingUp(gs);

  if (gs.autoCatchAfterJump && in.swingHeld && !gs.isSwinging && gs.py > 13.5f) {
    if (startWebSwing(gs, in, world, true)) gs.autoCatchAfterJump = false;
  } else if (in.swingHeld && !gs.isSwinging && !gs.autoCatchAfterJump &&
             gs.py > 4.0f && gs.swingReattachCooldown <= 0.0f) {
    startWebSwing(gs, in, world, false);
  }

  const float turnInput = in.turn;
  const float forwardInput = in.fwd;

  // ---- 1. Pendulum Swing vs Free-Fall Kinematics ----
  if (gs.isSwinging) {
    gs.vy -= BASE_GRAVITY * dt;
    gs.isDiving = false;
    gs.isGliding = false;
    gs.swingTimer += dt;
    if (gs.py < gs.swingMinY) gs.swingMinY = gs.py;

    const float sinY = sinf(gs.camYaw);
    const float cosY = cosf(gs.camYaw);
    const float rightX = cosY;
    const float rightZ = -sinY;

    const float relAnchorX = (gs.ax - gs.px) * cosY - (gs.az - gs.pz) * sinY;
    const int currentAnchorSide = (relAnchorX >= 0.0f) ? 1 : -1;
    gs.anchorSide = currentAnchorSide;

    // 1) Yaw carving + lateral thrust
    if (fabsf(turnInput) > 0.01f) {
      const float carveAng = turnInput * 1.35f * dt;
      const float cA = cosf(carveAng);
      const float sA = sinf(carveAng);
      const float rVx = gs.vx * cA + gs.vz * sA;
      const float rVz = -gs.vx * sA + gs.vz * cA;
      gs.vx = rVx + rightX * (turnInput * 56.0f) * dt;
      gs.vz = rVz + rightZ * (turnInput * 56.0f) * dt;
    }

    const float maxSwingSpd = BASE_SWING_MAX_SPD + (gs.perfectBuffTimer > 0.0f ? 12.0f : 0.0f);
    const bool isEvadingOutward = (turnInput * (float)currentAnchorSide) < -0.25f;
    const bool isRisingArc = gs.passedBottom && gs.vy > -6.0f;

    // 2) 3-zone analog throttle (forward push / full-forward reel-in / back pay-out)
    if (forwardInput > 0.15f) {
      const float curSpd3D = hypot3f(gs.vx, gs.vy, gs.vz);
      if (curSpd3D < maxSwingSpd) {
        const float pushAcc = forwardInput * 22.0f * dt;
        if ((isRisingArc || gs.vy > 0.0f) && curSpd3D > 8.0f) {
          gs.vx += (gs.vx / curSpd3D) * pushAcc;
          gs.vy += (gs.vy / curSpd3D) * pushAcc;
          gs.vz += (gs.vz / curSpd3D) * pushAcc;
        } else {
          gs.vx += sinY * pushAcc;
          gs.vz += cosY * pushAcc;
        }
      }

      if (forwardInput > 0.65f && fabsf(turnInput) < 0.35f && gs.ropeLen > 46.0f) {
        const float reelIntensity = fminf(1.0f, (forwardInput - 0.65f) / 0.35f);
        const float reelRate = (isRisingArc && gs.isRopeTaut) ? 26.0f : 20.0f;
        const float prevRopeLen = gs.ropeLen;
        gs.ropeLen = fmaxf(46.0f, gs.ropeLen - reelRate * reelIntensity * dt);
        const float reeledDist = prevRopeLen - gs.ropeLen;

        if (reeledDist > 0.0f && isRisingArc && gs.py > 10.0f) {
          const float spdNow = hypot3f(gs.vx, gs.vy, gs.vz);
          const float pumpCap = maxSwingSpd + 4.0f;
          if (spdNow > 6.0f && spdNow < pumpCap) {
            const float tanAdd = fminf(reeledDist * 0.85f, pumpCap - spdNow);
            gs.vx += (gs.vx / spdNow) * tanAdd;
            gs.vy += (gs.vy / spdNow) * tanAdd;
            gs.vz += (gs.vz / spdNow) * tanAdd;
          }
          gs.vy += reeledDist * 0.65f;
          const float postSpd = hypot3f(gs.vx, gs.vy, gs.vz);
          if (postSpd > pumpCap) {
            const float hNow = hypot2f(gs.vx, gs.vz);
            const float allowedH = sqrtf(fmaxf(0.0f, pumpCap * pumpCap - gs.vy * gs.vy));
            if (hNow > 1.0f && allowedH < hNow) {
              const float targetH = fmaxf(fminf(hNow, pumpCap * 0.45f), allowedH);
              const float hSc = targetH / hNow;
              gs.vx *= hSc;
              gs.vz *= hSc;
            }
          }
        }
      }
    } else if (forwardInput < -0.30f) {
      const float payOutIntensity = fminf(1.0f, (-forwardInput - 0.30f) / 0.70f);
      gs.ropeLen = fminf(gs.ay - SAFE_SKIM_Y, gs.ropeLen + 28.0f * payOutIntensity * dt);
    }

    if (isEvadingOutward) {
      const float evadeMaxLen = fminf(230.0f, fmaxf(gs.ropeLen, gs.ay - SAFE_SKIM_Y));
      gs.ropeLen = fminf(evadeMaxLen, gs.ropeLen + 22.0f * fabsf(turnInput) * dt);
    }

    if (gs.groundLaunchTimer > 0.0f) {
      gs.groundLaunchTimer -= dt;
      gs.ropeLen = fmaxf(32.0f, gs.ropeLen - 26.0f * dt);
    }

    // Dynamic low-altitude auto-reel for safe skimming
    const float predictedBottom = gs.ay - gs.ropeLen;
    if (predictedBottom < SAFE_SKIM_Y && gs.py < 68.0f) {
      const float targetLen = fmaxf(26.0f, gs.ay - SAFE_SKIM_Y);
      const float curSpd = hypot3f(gs.vx, gs.vy, gs.vz);
      const float dynamicBase = fmaxf(55.0f, curSpd * 1.2f);
      const float urgency = (gs.py < 22.0f) ? 11.0f : ((gs.py < 40.0f) ? 6.5f : 3.4f);
      const float maxReelPerSec = (gs.py < 22.0f) ? fmaxf(dynamicBase * 1.25f, 78.0f) : dynamicBase;
      const float deltaLen = fminf(maxReelPerSec * dt, (gs.ropeLen - targetLen) * urgency * dt);
      if (deltaLen > 0.0f) gs.ropeLen -= deltaLen;
    }

    gs.px += gs.vx * dt;
    gs.py += gs.vy * dt;
    gs.pz += gs.vz * dt;

    const float dx = gs.px - gs.ax;
    const float dy = gs.py - gs.ay;
    const float dz = gs.pz - gs.az;
    const float curDist = hypot3f(dx, dy, dz);
    gs.isRopeTaut = (curDist >= gs.ropeLen - 1.5f);

    if (curDist > gs.ropeLen && curDist > 0.001f) {
      const float invD = 1.0f / curDist;
      const float nx = dx * invD;
      const float ny = dy * invD;
      const float nz = dz * invD;
      gs.px = gs.ax + nx * gs.ropeLen;
      gs.py = gs.ay + ny * gs.ropeLen;
      gs.pz = gs.az + nz * gs.ropeLen;

      const float speedBefore = hypot3f(gs.vx, gs.vy, gs.vz);
      const float radialDot = gs.vx * nx + gs.vy * ny + gs.vz * nz;
      if (radialDot > 0.0f) {
        gs.vx -= radialDot * nx;
        gs.vy -= radialDot * ny;
        gs.vz -= radialDot * nz;
      }

      const float speedAfter = hypot3f(gs.vx, gs.vy, gs.vz);
      if (speedAfter > 4.0f) {
        float targetSpd = speedAfter;
        if (speedBefore > speedAfter) {
          targetSpd = speedAfter + (speedBefore - speedAfter) * 0.985f;
        }
        if (targetSpd > maxSwingSpd) {
          const float dragRate = (gs.passedBottom && gs.vy > 0.0f) ? 0.95f : 1.35f;
          targetSpd -= (targetSpd - maxSwingSpd) * fminf(1.0f, dragRate * dt);
        }
        const float sc = targetSpd / speedAfter;
        gs.vx *= sc;
        gs.vy *= sc;
        gs.vz *= sc;
      } else {
        gs.vx += sinY * 14.0f * dt;
        gs.vz += cosY * 14.0f * dt;
      }

      const float anchorLocalZ = (gs.ax - gs.px) * sinY + (gs.az - gs.pz) * cosY;
      if (anchorLocalZ < 6.0f && gs.swingTimer > 0.14f) gs.passedBottom = true;

      const float fwdPast = -anchorLocalZ;
      const float arcProgress = fwdPast / fmaxf(30.0f, gs.ropeLen);
      const bool prevPerfect = gs.inPerfectWindow;
      gs.inPerfectWindow = gs.passedBottom && arcProgress >= 0.34f && arcProgress <= 0.88f && gs.vy > 14.0f;
      if (gs.inPerfectWindow || prevPerfect) {
        gs.perfectGraceTimer = 0.09f;
      }

      if (gs.py < 24.0f && gs.py > 4.5f) {
        const float skimBoost = (1.0f - (gs.py - 4.5f) / 19.5f) * 24.0f;
        const float hNow = hypot2f(gs.vx, gs.vz);
        if (hNow > 1.0f && hNow < (maxSwingSpd + 6.0f)) {
          gs.vx += (gs.vx / hNow) * skimBoost * dt;
          gs.vz += (gs.vz / hNow) * skimBoost * dt;
        }
      }
    } else {
      if (gs.inPerfectWindow) gs.perfectGraceTimer = fmaxf(gs.perfectGraceTimer, 0.09f);
      gs.inPerfectWindow = false;
    }

    const float curHSpd = hypot2f(gs.vx, gs.vz);
    if (curHSpd > 8.0f) {
      const float velYaw = atan2f(gs.vx, gs.vz);
      gs.camYaw += wrapAngleDiff(velYaw, gs.camYaw) * 8.5f * dt;
    }
  } else {
    // Free-fall / Glide / Dive
    gs.inPerfectWindow = false;
    const float fallT = (gs.vy < -4.0f) ? fminf(1.0f, (-gs.vy - 4.0f) / 70.0f) : 0.0f;
    const float fallGravMult = 1.40f + 0.35f * fallT;

    if (gs.py > 6.5f && gs.vy <= 0.0f && forwardInput < -0.25f) {
      gs.isGliding = true;
      gs.isDiving = false;
      gs.diveCharge = fmaxf(0.0f, gs.diveCharge - 0.35f * dt);
      gs.vy -= (BASE_GRAVITY * 0.16f) * dt;
      if (gs.vy < -9.0f) gs.vy += (-9.0f - gs.vy) * 9.0f * dt;
    } else if (gs.py > 8.0f && gs.vy < -4.0f && forwardInput > 0.25f) {
      gs.isGliding = false;
      gs.isDiving = true;
      gs.vy -= (BASE_GRAVITY * fallGravMult + 42.0f * forwardInput) * dt;
      gs.diveCharge = fminf(1.0f, gs.diveCharge + 0.85f * forwardInput * dt);
    } else {
      gs.isGliding = false;
      gs.isDiving = false;
      gs.diveCharge = fmaxf(0.0f, gs.diveCharge - 0.28f * dt);
      if (gs.vy < -4.0f) {
        gs.vy -= (BASE_GRAVITY * fallGravMult) * dt;
      } else if (gs.py > 45.0f && gs.vy <= 8.0f) {
        gs.vy -= (BASE_GRAVITY * 0.52f) * dt;
      } else {
        gs.vy -= BASE_GRAVITY * dt;
      }
    }

    if (gs.doingFlip) {
      gs.flipAngle += 7.5f * dt;
      if (gs.flipAngle >= TWO_PI_F) {
        gs.flipAngle = 0.0f;
        gs.doingFlip = false;
      }
    }

    const float maxFreeSpd = BASE_FREE_MAX_SPD;
    const float maxSwingSpd = BASE_SWING_MAX_SPD + (gs.perfectBuffTimer > 0.0f ? 12.0f : 0.0f);
    float curHSpd = hypot2f(gs.vx, gs.vz);

    if (forwardInput > 0.0f) {
      if (curHSpd < maxFreeSpd) {
        curHSpd = fminf(maxFreeSpd, curHSpd + 24.0f * forwardInput * dt);
      } else {
        curHSpd = fmaxf(maxFreeSpd, curHSpd * (1.0f - BASE_AIR_DRAG * dt));
      }
    } else if (forwardInput < 0.0f && !gs.isGliding) {
      curHSpd = fmaxf(0.0f, curHSpd + 42.0f * forwardInput * dt);
    } else if (gs.isGliding) {
      curHSpd = fmaxf(22.0f, curHSpd * (1.0f - 0.14f * dt));
    } else {
      curHSpd = fmaxf(0.0f, curHSpd * (1.0f - BASE_AIR_DRAG * dt));
    }

    if (curHSpd > maxSwingSpd) {
      curHSpd -= (curHSpd - maxSwingSpd) * fminf(1.0f, 1.15f * dt);
    }

    const float airSpd = hypot2f(curHSpd, gs.vy);
    const float maxAirSpd = BASE_SWING_MAX_SPD + (gs.isDiving ? 18.0f : 8.0f);
    if (airSpd > maxAirSpd) {
      const float targetAirSpd = airSpd - (airSpd - maxAirSpd) * fminf(1.0f, 1.45f * dt);
      const float airSc = targetAirSpd / airSpd;
      curHSpd *= airSc;
      gs.vy *= airSc;
    }

    const float turnRate = gs.isGliding ? 1.65f : 0.95f;
    gs.camYaw += turnInput * turnRate * dt;
    gs.vx = sinf(gs.camYaw) * curHSpd;
    gs.vz = cosf(gs.camYaw) * curHSpd;

    gs.px += gs.vx * dt;
    gs.py += gs.vy * dt;
    gs.pz += gs.vz * dt;
  }

  // ---- 2. Building Collisions & Proximity ----
  float minWallDist = 999.0f;
  int nearestSide = 0;
  handleBuildingCollisions(gs, world, minWallDist, nearestSide);

  // ---- 3. INVARIANT #3: Ground Rocket-Launch Prevention ----
  // Immediately sever web & clamp vy=0 on ground contact (py <= 4.5 while swinging, or py < 2.5)
  if (gs.isSwinging && gs.py <= 4.5f) {
    gs.isSwinging = false;
    gs.inPerfectWindow = false;
    gs.perfectGraceTimer = 0.0f;
    gs.isRopeTaut = false;
    gs.swingReattachCooldown = 0.18f;
    if (gs.vy > 18.0f) gs.vy = 18.0f;
  }
  if (gs.py < 2.5f) {
    const float fallSpd = fabsf(gs.vy);
    gs.py = 2.5f;
    gs.vy = 0.0f;
    gs.doingFlip = false;
    gs.flipAngle = 0.0f;
    gs.isDiving = false;
    gs.isGliding = false;
    gs.diveCharge = 0.0f;
    if (gs.isSwinging) {
      gs.vx *= 0.42f;
      gs.vz *= 0.42f;
      gs.isSwinging = false;
      gs.inPerfectWindow = false;
      gs.perfectGraceTimer = 0.0f;
      gs.isRopeTaut = false;
      gs.swingReattachCooldown = 0.18f;
    } else if (fallSpd > 34.0f) {
      gs.vx *= 0.55f;
      gs.vz *= 0.55f;
      gs.shakeMag = fmaxf(gs.shakeMag, 2.5f);
      physicsSpawnSparks(gs, gs.px, 1.5f, gs.pz, COL_ORANGE, 8, 24.0f);
      physicsSetPopup(gs, "HARD LANDING!", COL_ORANGE, 0.9f);
      audioPlaySfx(SfxId::PLAYER_HIT);
    }
  }

  if (gs.py > GAME_MAX_ALTITUDE) {
    gs.py = GAME_MAX_ALTITUDE;
    if (gs.vy > 0.0f) gs.vy = 0.0f;
  }
  gs.vy = clampf(gs.vy, -260.0f, 210.0f);

  const float horizSpeed = hypot2f(gs.vx, gs.vz);
  const float totalSpeed = hypot2f(horizSpeed, gs.vy);

  // Wall & Ground Skim feedback
  if (minWallDist < 14.5f && totalSpeed > 26.0f && gs.py > 4.0f) {
    const float wNorm = fmaxf(0.0f, 1.0f - minWallDist / 14.5f);
    gs.wallSkimIntensity += (wNorm - gs.wallSkimIntensity) * 12.0f * dt;
    gs.wallSkimSide = nearestSide;
    if (gs.isSwinging && horizSpeed < (BASE_SWING_MAX_SPD + 10.0f) && horizSpeed > 1.0f) {
      const float wBoost = (16.0f + wNorm * 28.0f) * dt;
      gs.vx += (gs.vx / horizSpeed) * wBoost;
      gs.vz += (gs.vz / horizSpeed) * wBoost;
    }
  } else {
    gs.wallSkimIntensity *= fmaxf(0.0f, 1.0f - 8.0f * dt);
  }

  if (gs.py < 24.0f && gs.py > 3.2f && totalSpeed > 30.0f) {
    const float gNorm = fmaxf(0.0f, 1.0f - (gs.py - 3.5f) / 20.5f);
    gs.groundSkimIntensity += (gNorm - gs.groundSkimIntensity) * 10.0f * dt;
  } else {
    gs.groundSkimIntensity *= fmaxf(0.0f, 1.0f - 8.0f * dt);
  }

  // Update sparks
  for (int i = 0; i < MAX_SPARKS; i++) {
    Spark& s = gs.sparks[i];
    if (!s.active) continue;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.z += s.vz * dt;
    s.vy -= 30.0f * dt;
    s.life -= dt;
    if (s.life <= 0.0f) s.active = false;
  }

  // ---- 4. Camera Dynamics (1:1 with js/main.js) ----
  gs.camLagYaw += wrapAngleDiff(gs.camYaw, gs.camLagYaw) * 9.0f * dt;

  const float targetDist = 13.0f + totalSpeed * 0.068f + (gs.isSwinging ? -1.2f : 2.2f);
  gs.camDist += (targetDist - gs.camDist) * 6.0f * dt;

  const float normAlt = clampf((gs.py - 14.0f) / 360.0f, 0.0f, 1.0f);
  const float descentLook = (!gs.isSwinging && gs.vy < -10.0f && gs.py > 24.0f)
    ? fmaxf(-0.50f, gs.vy * 0.0062f)
    : (gs.vy * 0.0014f);
  const float divePitchBias = gs.isDiving ? -0.26f : (gs.isGliding ? 0.05f : 0.0f);
  const float lowSpeedLevel = (gs.py < 30.0f && totalSpeed > 45.0f) ? -0.11f : 0.0f;
  const float targetPitch = clampf(0.14f - normAlt * 0.64f + descentLook + divePitchBias + lowSpeedLevel, -0.96f, 0.42f);
  gs.camPitch += (targetPitch - gs.camPitch) * 8.0f * dt;

  const float swingBank = gs.isSwinging ? (0.12f * (float)gs.anchorSide) : 0.0f;
  const float skimBank = gs.wallSkimIntensity * (float)(-gs.wallSkimSide) * 0.14f;
  const float targetRoll = -turnInput * 0.28f + swingBank + skimBank;
  gs.camRoll += (targetRoll - gs.camRoll) * 9.0f * dt;

  const float lowThrill = fmaxf(0.0f, (26.0f - gs.py) * 1.0f);
  const float wallThrill = gs.wallSkimIntensity * 24.0f;
  const float rushFov = gs.diveCharge * 20.0f;
  const float targetFov = fmaxf(66.0f, 228.0f - totalSpeed * 0.80f - lowThrill - wallThrill - rushFov);
  gs.fovD += (targetFov - gs.fovD) * 8.5f * dt;
}
