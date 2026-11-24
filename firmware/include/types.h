#pragma once
// Spider 3D — Core Types, Constants & PC-98 RGB565 Palette

#include <stdint.h>
#include <stddef.h>

// Helper to convert 24-bit RGB to 16-bit RGB565 at compile time
constexpr uint16_t rgb565(uint8_t r, uint8_t g, uint8_t b) {
  return (uint16_t)(((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3));
}

// Chromakey transparent color (TFT_MAGENTA #FF00FF)
constexpr uint16_t COL_CHROMA         = 0xF81F;

// PC-98 Core Palette (RGB565)
constexpr uint16_t COL_INDIGO_OUTLINE = rgb565(0x14, 0x19, 0x33);
constexpr uint16_t COL_CRIMSON        = rgb565(0xe8, 0x28, 0x48);
constexpr uint16_t COL_CRIMSON_SHADE  = rgb565(0xa6, 0x16, 0x34);
constexpr uint16_t COL_ROYAL_BLUE     = rgb565(0x24, 0x54, 0xc4);
constexpr uint16_t COL_BLUE_SHADE     = rgb565(0x15, 0x31, 0x78);
constexpr uint16_t COL_CREAM          = rgb565(0xff, 0xf4, 0xd6);
constexpr uint16_t COL_GOLD           = rgb565(0xff, 0xe5, 0x5c);
constexpr uint16_t COL_ORANGE         = rgb565(0xff, 0x94, 0x36);
constexpr uint16_t COL_EMERALD        = rgb565(0x4a, 0xde, 0x80);
constexpr uint16_t COL_NEON_CYAN      = rgb565(0x54, 0xf8, 0xff);
constexpr uint16_t COL_WHITE          = 0xFFFF;
constexpr uint16_t COL_BLACK          = 0x0000;

// Summer Day Stage Colors
constexpr uint16_t COL_SKY_TOP        = rgb565(0x1e, 0x46, 0xa8);
constexpr uint16_t COL_SKY_MID        = rgb565(0x3a, 0x78, 0xd4);
constexpr uint16_t COL_SKY_LOW        = rgb565(0x76, 0xb8, 0xf0);
constexpr uint16_t COL_SKY_HORIZON    = rgb565(0xc2, 0xe4, 0xff);
constexpr uint16_t COL_ASPHALT        = rgb565(0x38, 0x42, 0x60);
constexpr uint16_t COL_ASPHALT_FAR    = rgb565(0x56, 0x66, 0x8a);
constexpr uint16_t COL_SIDEWALK       = rgb565(0xae, 0xba, 0xd4);
constexpr uint16_t COL_LANE_YEL       = rgb565(0xff, 0xd8, 0x36);
constexpr uint16_t COL_CLOUD_LIGHT    = rgb565(0xff, 0xff, 0xff);
constexpr uint16_t COL_CLOUD_MID      = rgb565(0xa8, 0xdc, 0xff);
constexpr uint16_t COL_CLOUD_SHADE    = rgb565(0x7c, 0x96, 0xcc);

struct BldgPalette {
  uint16_t sun;
  uint16_t shade;
  uint16_t roof;
  uint16_t trim;
  uint16_t trimSh;
  uint16_t frame;
  uint16_t winSky;
  uint16_t winDark;
  uint16_t winWarm;
  uint16_t lobby;
};

// 5 Manhattan Building Palettes (matching assets.js STAGE_CONFIGS[0].bldgThemes)
constexpr BldgPalette BLDG_PALETTES[5] = {
  // 0: Warm Sandstone
  { rgb565(0xdc,0xc0,0x94), rgb565(0x88,0x70,0x60), rgb565(0xbc,0xa2,0x84), rgb565(0xff,0xf2,0xd6), rgb565(0xb0,0x96,0x80),
    rgb565(0x1a,0x24,0x48), rgb565(0x7e,0xc8,0xf8), rgb565(0x22,0x36,0x64), rgb565(0xff,0xea,0x9c), rgb565(0x28,0x24,0x3a) },
  // 1: Glass Blue Tower
  { rgb565(0x70,0xa6,0xd2), rgb565(0x3c,0x5e,0x8c), rgb565(0x60,0x86,0xac), rgb565(0xc4,0xe6,0xff), rgb565(0x64,0x8a,0xb4),
    rgb565(0x16,0x22,0x44), rgb565(0xa8,0xe2,0xff), rgb565(0x1c,0x38,0x66), rgb565(0xff,0xf2,0xb2), rgb565(0x1c,0x28,0x48) },
  // 2: Red Brick
  { rgb565(0xbc,0x5a,0x4c), rgb565(0x6c,0x32,0x3a), rgb565(0x8e,0x52,0x4c), rgb565(0xf0,0xb4,0x9c), rgb565(0x96,0x58,0x54),
    rgb565(0x1c,0x1c,0x38), rgb565(0x7e,0xc4,0xec), rgb565(0x24,0x32,0x58), rgb565(0xff,0xe4,0x8c), rgb565(0x2c,0x1e,0x30) },
  // 3: Modern Silver
  { rgb565(0xce,0xd6,0xe2), rgb565(0x7a,0x86,0xa2), rgb565(0xb2,0xbc,0xcc), rgb565(0xff,0xff,0xff), rgb565(0x9c,0xa8,0xc2),
    rgb565(0x1a,0x24,0x48), rgb565(0x8a,0xd4,0xff), rgb565(0x24,0x3a,0x68), rgb565(0xff,0xef,0xaa), rgb565(0x26,0x2e,0x46) },
  // 4: Steel Slate
  { rgb565(0x84,0x94,0xb0), rgb565(0x48,0x58,0x74), rgb565(0x6e,0x80,0x9a), rgb565(0xca,0xd8,0xec), rgb565(0x6e,0x80,0x9e),
    rgb565(0x14,0x1c,0x38), rgb565(0x76,0xc8,0xf4), rgb565(0x1e,0x32,0x58), rgb565(0xff,0xe2,0x82), rgb565(0x1e,0x24,0x38) }
};

constexpr uint16_t COL_AWNINGS[4] = {
  rgb565(0xd9, 0x32, 0x48),
  rgb565(0x2a, 0x8f, 0x5c),
  rgb565(0xe6, 0x98, 0x24),
  rgb565(0x32, 0x68, 0xc8)
};

// ---- World & Physics Constants (1:1 with js/state.js & assets.js) ----
constexpr float NEAR_Z             = 1.6f;
constexpr float BLOCK_SIZE         = 240.0f;
constexpr float RENDER_DIST        = 540.0f;
constexpr float SAFE_SKIM_Y        = 8.2f;
constexpr float GAME_MAX_ALTITUDE  = 650.0f;
constexpr float BASE_GRAVITY       = 64.0f;
constexpr float BASE_AIR_DRAG      = 0.11f;
constexpr float BASE_SWING_MAX_SPD = 92.0f;
constexpr float BASE_FREE_MAX_SPD  = 68.0f;

constexpr int MAX_NEARBY_BUILDINGS = 64;
constexpr int MAX_NEARBY_CLOUDS    = 50;
constexpr int MAX_SPARKS           = 48;

struct Vec3 {
  float x, y, z;
};

struct Building {
  float bx, bz;
  float bw, bd, bh;
  uint8_t palIdx;
  uint8_t awningIdx;
  uint32_t seed;
  bool hasSpire;
  bool hasPenthouse;
};

struct Cloud {
  float x, y, z;
  float scale;
};

struct Spark {
  float x, y, z;
  float vx, vy, vz;
  float life;
  uint16_t col;
  bool active;
};

struct NearbyWorld {
  Building buildings[MAX_NEARBY_BUILDINGS];
  int buildingCount;
  Cloud clouds[MAX_NEARBY_CLOUDS];
  int cloudCount;
  int centerGx;
  int centerGz;
};

struct InputState {
  float turn;            // -1.0 (left) .. +1.0 (right)
  float fwd;             // -1.0 (back) .. +1.0 (forward)
  int   rawAdcX;
  int   rawAdcY;
  int   centerAdcX;
  int   centerAdcY;
  bool  swingHeld;
  bool  swingPressed;    // Rising edge this frame
  bool  swingReleased;   // Falling edge this frame
  bool  strikeHeld;
  bool  strikePressed;   // Rising edge this frame
  bool  strikeReleased;  // Falling edge this frame
  // Raw individual pins for hardware bring-up diagnostics
  bool  rawSwingInt;
  bool  rawSwingExt;
  bool  rawStrikeInt;
  bool  rawStrikeExt;
  float strikeHoldSec;
};

struct GameState {
  // Player kinematics
  float px, py, pz;
  float vx, vy, vz;
  float camYaw;

  // Web swing state
  bool  isSwinging;
  float ax, ay, az;
  float ropeLen;
  int   anchorSide;
  int   lastAnchorSide;
  float swingTimer;
  bool  passedBottom;
  float peakYBeforeSwing;
  float swingMinY;
  bool  autoCatchAfterJump;
  float groundLaunchTimer;
  float swingReattachCooldown;
  float swingWebShootTimer;
  bool  isRopeTaut;

  // Timing, Dive, Glide & Flip
  bool  inPerfectWindow;
  float perfectGraceTimer;
  float perfectBuffTimer;
  float diveCharge;
  bool  isDiving;
  bool  isGliding;
  bool  doingFlip;
  float flipAngle;

  // Skim & Collision feedback
  float wallSkimIntensity;
  int   wallSkimSide;
  float groundSkimIntensity;
  float wallSlideCooldown;
  float shakeMag;
  int   swingCombo;

  // Camera state
  float camDist;
  float camLagYaw;
  float camPitch;
  float camRoll;
  float fovD;

  // Status banner popup (single top-center line for zero alloc)
  char     popupText[28];
  uint16_t popupCol;
  float    popupTimer;

  // Simulation time & diagnostics
  float simTime;
  float fps;
  uint32_t frameUs;
  bool  showDiagHud;

  // Fixed-size spark pool
  Spark sparks[MAX_SPARKS];
};
