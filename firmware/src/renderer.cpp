#include "renderer.h"
#include "pins.h"
#include "audio_hw.h"
#include <TFT_eSPI.h>
#include <math.h>
#include <stdio.h>

namespace {

TFT_eSPI    tft = TFT_eSPI();
TFT_eSprite spr = TFT_eSprite(&tft);

struct CamBasis {
  float cx, cy, cz;
  float cosY, sinY;
  float cosP, sinP;
  float cosR, sinR;
  float d;
  float sx, sy;
};

struct Pt2 {
  int16_t x, y;
};

inline Vec3 worldToCam(float x, float y, float z, const CamBasis& cb) {
  const float dx = x - cb.cx;
  const float dy = y - cb.cy;
  const float dz = z - cb.cz;
  const float rx0 = dx * cb.cosY - dz * cb.sinY;
  const float rz0 = dx * cb.sinY + dz * cb.cosY;
  const float ry1 = dy * cb.cosP - rz0 * cb.sinP;
  const float rz1 = dy * cb.sinP + rz0 * cb.cosP;
  const float rx2 = rx0 * cb.cosR - ry1 * cb.sinR;
  const float ry2 = rx0 * cb.sinR + ry1 * cb.cosR;
  return { rx2, ry2, rz1 };
}

inline Pt2 projectCam(const Vec3& p, const CamBasis& cb) {
  const float invZ = cb.d / p.z;
  float fx = p.x * invZ + (LCD_W * 0.5f) + cb.sx;
  float fy = -p.y * invZ + (LCD_H * 0.5f) + cb.sy;
  // Clamp to safe int16 screen bounds to avoid overflow in TFT_eSprite rasterizer
  if (fx < -1200.0f) fx = -1200.0f; else if (fx > 1520.0f) fx = 1520.0f;
  if (fy < -1200.0f) fy = -1200.0f; else if (fy > 1370.0f) fy = 1370.0f;
  return { (int16_t)fx, (int16_t)fy };
}

bool projectWorld(float x, float y, float z, const CamBasis& cb, Pt2& outPt, float& outZ) {
  Vec3 c = worldToCam(x, y, z, cb);
  if (c.z <= NEAR_Z || c.z > RENDER_DIST + 80.0f) return false;
  outPt = projectCam(c, cb);
  outZ = c.z;
  return true;
}

void drawClippedLine3D(const Vec3& a3, const Vec3& b3, const CamBasis& cb, uint16_t col) {
  Vec3 a = worldToCam(a3.x, a3.y, a3.z, cb);
  Vec3 b = worldToCam(b3.x, b3.y, b3.z, cb);
  if (a.z < NEAR_Z && b.z < NEAR_Z) return;
  if (a.z > RENDER_DIST + 80.0f && b.z > RENDER_DIST + 80.0f) return;

  if (a.z < NEAR_Z) {
    float t = (NEAR_Z - a.z) / (b.z - a.z);
    a.x += (b.x - a.x) * t;
    a.y += (b.y - a.y) * t;
    a.z = NEAR_Z;
  } else if (b.z < NEAR_Z) {
    float t = (NEAR_Z - b.z) / (a.z - b.z);
    b.x += (a.x - b.x) * t;
    b.y += (a.y - b.y) * t;
    b.z = NEAR_Z;
  }

  Pt2 pa = projectCam(a, cb);
  Pt2 pb = projectCam(b, cb);
  // Quick 2D bounding rejection
  if ((pa.x < -8 && pb.x < -8) || (pa.x > LCD_W + 8 && pb.x > LCD_W + 8) ||
      (pa.y < -8 && pb.y < -8) || (pa.y > LCD_H + 8 && pb.y > LCD_H + 8)) {
    return;
  }
  spr.drawLine(pa.x, pa.y, pb.x, pb.y, col);
}

bool drawClippedQuad3D(const Vec3 quad[4], const CamBasis& cb, uint16_t fillCol, bool drawStroke, uint16_t strokeCol) {
  Vec3 cam[4];
  bool anyFront = false;
  bool allFar = true;
  for (int i = 0; i < 4; i++) {
    cam[i] = worldToCam(quad[i].x, quad[i].y, quad[i].z, cb);
    if (cam[i].z >= NEAR_Z) anyFront = true;
    if (cam[i].z <= RENDER_DIST) allFar = false;
  }
  if (!anyFront || allFar) return false;

  // Sutherland-Hodgman near-plane clip (4 verts -> at most 5 verts)
  Vec3 clipped[6];
  int cnt = 0;
  for (int i = 0; i < 4; i++) {
    const Vec3& a = cam[i];
    const Vec3& b = cam[(i + 1) & 3];
    const bool aIn = (a.z >= NEAR_Z);
    const bool bIn = (b.z >= NEAR_Z);
    if (aIn) clipped[cnt++] = a;
    if (aIn != bIn) {
      const float t = (NEAR_Z - a.z) / (b.z - a.z);
      clipped[cnt++] = { a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, NEAR_Z };
    }
  }
  if (cnt < 3) return false;

  Pt2 pts[6];
  int16_t minX = 32000, maxX = -32000, minY = 32000, maxY = -32000;
  for (int i = 0; i < cnt; i++) {
    pts[i] = projectCam(clipped[i], cb);
    if (pts[i].x < minX) minX = pts[i].x;
    if (pts[i].x > maxX) maxX = pts[i].x;
    if (pts[i].y < minY) minY = pts[i].y;
    if (pts[i].y > maxY) maxY = pts[i].y;
  }
  if (maxX < 0 || minX >= LCD_W || maxY < 0 || minY >= LCD_H) return false;

  for (int i = 1; i < cnt - 1; i++) {
    spr.fillTriangle(pts[0].x, pts[0].y, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, fillCol);
  }
  if (drawStroke) {
    for (int i = 0; i < cnt; i++) {
      const Pt2& p0 = pts[i];
      const Pt2& p1 = pts[(i + 1) % cnt];
      spr.drawLine(p0.x, p0.y, p1.x, p1.y, strokeCol);
    }
  }
  return true;
}

inline Vec3 lerp3(const Vec3& a, const Vec3& b, float t) {
  return { a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t };
}

inline Vec3 bilerp3(const Vec3 c[4], float u, float v) {
  Vec3 bot = lerp3(c[0], c[1], u);
  Vec3 top = lerp3(c[3], c[2], u);
  return lerp3(bot, top, v);
}

void drawSkyAndGround(const CamBasis& cb) {
  // Compute rolled horizon line from camera pitch & roll
  // Horizon direction in cam space before roll: y = -sinP, z = cosP
  // Screen center horizon Y (roll=0): cy0 = LCD_H*0.5 + (sinP / cosP) * d
  const float tanP = cb.sinP / fmaxf(0.15f, cb.cosP);
  const float hyCenter = (LCD_H * 0.5f) + tanP * cb.d + cb.sy;
  const float cxCenter = (LCD_W * 0.5f) + cb.sx;

  // Tangent vector along horizon rotated by roll: (cosR, sinR)
  // Upward normal in screen space: (sinR, -cosR)
  const float tx = cb.cosR * 260.0f;
  const float ty = cb.sinR * 260.0f;
  const float ux = cb.sinR;
  const float uy = -cb.cosR;

  // Base fill = asphalt ground
  spr.fillSprite(COL_ASPHALT);

  auto drawBand = [&](float h0, float h1, uint16_t col) {
    int16_t x0 = (int16_t)(cxCenter - tx + ux * h0);
    int16_t y0 = (int16_t)(hyCenter - ty + uy * h0);
    int16_t x1 = (int16_t)(cxCenter + tx + ux * h0);
    int16_t y1 = (int16_t)(hyCenter + ty + uy * h0);
    int16_t x2 = (int16_t)(cxCenter + tx + ux * h1);
    int16_t y2 = (int16_t)(hyCenter + ty + uy * h1);
    int16_t x3 = (int16_t)(cxCenter - tx + ux * h1);
    int16_t y3 = (int16_t)(hyCenter - ty + uy * h1);
    spr.fillTriangle(x0, y0, x1, y1, x2, y2, col);
    spr.fillTriangle(x0, y0, x2, y2, x3, y3, col);
  };

  // Far horizon haze on ground & 4-band PC-98 sky gradient
  drawBand(-16.0f,   0.0f, COL_ASPHALT_FAR);
  drawBand(  0.0f,  16.0f, COL_SKY_HORIZON);
  drawBand( 16.0f,  46.0f, COL_SKY_LOW);
  drawBand( 46.0f,  98.0f, COL_SKY_MID);
  drawBand( 98.0f, 340.0f, COL_SKY_TOP);
}

void drawRoadGrid(const NearbyWorld& world, const CamBasis& cb) {
  // Crisp Manhattan avenue dashed yellow centerlines & intersection grid on nearby 3x3 blocks
  for (int dgx = -1; dgx <= 1; dgx++) {
    const float roadX = (float)(world.centerGx + dgx) * BLOCK_SIZE;
    for (int dgz = -1; dgz <= 1; dgz++) {
      const float roadZ = (float)(world.centerGz + dgz) * BLOCK_SIZE;
      // Avenue Z dashes
      for (int k = -2; k <= 2; k++) {
        float z0 = roadZ + k * 44.0f - 10.0f;
        float z1 = z0 + 20.0f;
        drawClippedLine3D({ roadX, 0.15f, z0 }, { roadX, 0.15f, z1 }, cb, COL_LANE_YEL);
      }
      // Cross-street X dashes
      for (int k = -2; k <= 2; k++) {
        float x0 = roadX + k * 44.0f - 10.0f;
        float x1 = x0 + 20.0f;
        drawClippedLine3D({ x0, 0.15f, roadZ }, { x1, 0.15f, roadZ }, cb, COL_SIDEWALK);
      }
    }
  }
}

void drawPC98Face(const Vec3 corners[4], bool isSunlit, const Building& b, float d2, const CamBasis& cb, int faceIdx) {
  const BldgPalette& pal = BLDG_PALETTES[b.palIdx];
  const uint16_t wallCol = isSunlit ? pal.sun : pal.shade;
  const uint16_t trimCol = isSunlit ? pal.trim : pal.trimSh;

  if (!drawClippedQuad3D(corners, cb, wallCol, true, pal.frame)) return;

  if (isSunlit && d2 < 320.0f * 320.0f) {
    drawClippedLine3D(corners[0], corners[3], cb, trimCol);
  }

  // Mid/Close LOD: Lobby & Horizontal Ledges
  if (d2 < 260.0f * 260.0f) {
    const float lobbyV = fminf(0.18f, 16.0f / b.bh);
    Vec3 lobbyQ[4] = { corners[0], corners[1], bilerp3(corners, 1.0f, lobbyV), bilerp3(corners, 0.0f, lobbyV) };
    drawClippedQuad3D(lobbyQ, cb, pal.lobby, false, pal.frame);

    if (d2 < 175.0f * 175.0f) {
      const float awV0 = lobbyV * 0.56f;
      const float awV1 = lobbyV * 0.92f;
      Vec3 awQ[4] = {
        bilerp3(corners, 0.08f, awV0),
        bilerp3(corners, 0.92f, awV0),
        bilerp3(corners, 0.92f, awV1),
        bilerp3(corners, 0.08f, awV1)
      };
      drawClippedQuad3D(awQ, cb, COL_AWNINGS[(b.awningIdx + faceIdx) & 3], false, pal.frame);
    }

    // Horizontal ledges + window bands (fast lines keep ESP32 at 60fps!)
    const int ledgeCount = (d2 < 165.0f * 165.0f) ? 5 : 3;
    for (int i = 1; i < ledgeCount; i++) {
      const float v = lobbyV + (1.0f - lobbyV) * ((float)i / (float)ledgeCount);
      drawClippedLine3D(bilerp3(corners, 0.0f, v), bilerp3(corners, 1.0f, v), cb, trimCol);
    }

    if (d2 < 145.0f * 145.0f) {
      // Close-up: Crisp perspective window quads (3 cols x up to 5 rows)
      constexpr int COLS = 3;
      int rows = (int)((b.bh - 22.0f) / 38.0f);
      if (rows < 2) rows = 2;
      if (rows > 5) rows = 5;
      const float padU = 0.07f;
      const float stepU = (1.0f - padU * 2.0f) / COLS;
      const float winW = stepU * 0.58f;
      const float startV = lobbyV + 0.05f;
      const float stepV = (0.93f - startV) / (float)rows;
      const float winH = stepV * 0.52f;

      for (int r = 0; r < rows; r++) {
        const float v0 = startV + r * stepV;
        const float v1 = v0 + winH;
        for (int c = 0; c < COLS; c++) {
          const float u0 = padU + c * stepU + stepU * 0.21f;
          const float u1 = u0 + winW;
          const uint32_t h = (b.seed + r * 31u + c * 17u + faceIdx * 13u) & 15u;
          const uint16_t paneCol = (h < 5u) ? pal.winSky : ((h < 12u) ? pal.winDark : pal.winWarm);
          Vec3 wq[4] = {
            bilerp3(corners, u0, v0),
            bilerp3(corners, u1, v0),
            bilerp3(corners, u1, v1),
            bilerp3(corners, u0, v1)
          };
          drawClippedQuad3D(wq, cb, paneCol, false, pal.frame);
        }
      }
    } else {
      // Mid-range: Lightweight window horizon strips
      for (int i = 1; i <= 4; i++) {
        const float v = 0.20f + i * 0.16f;
        const uint16_t bandCol = isSunlit ? pal.winSky : pal.winDark;
        drawClippedLine3D(bilerp3(corners, 0.08f, v), bilerp3(corners, 0.92f, v), cb, bandCol);
      }
    }
  }
}

void drawPC98Building(const Building& b, float d2, const CamBasis& cb) {
  const float hw = b.bw * 0.5f;
  const float hd = b.bd * 0.5f;
  const float x0 = b.bx - hw, x1 = b.bx + hw;
  const float z0 = b.bz - hd, z1 = b.bz + hd;
  const float h  = b.bh;
  const BldgPalette& pal = BLDG_PALETTES[b.palIdx];

  if (cb.cz < z0) {
    Vec3 q[4] = { {x0,0,z0}, {x1,0,z0}, {x1,h,z0}, {x0,h,z0} };
    drawPC98Face(q, true, b, d2, cb, 0);
  } else if (cb.cz > z1) {
    Vec3 q[4] = { {x1,0,z1}, {x0,0,z1}, {x0,h,z1}, {x1,h,z1} };
    drawPC98Face(q, false, b, d2, cb, 1);
  }

  if (cb.cx < x0) {
    Vec3 q[4] = { {x0,0,z1}, {x0,0,z0}, {x0,h,z0}, {x0,h,z1} };
    drawPC98Face(q, true, b, d2, cb, 2);
  } else if (cb.cx > x1) {
    Vec3 q[4] = { {x1,0,z0}, {x1,0,z1}, {x1,h,z1}, {x1,h,z0} };
    drawPC98Face(q, false, b, d2, cb, 3);
  }

  if (cb.cy > h) {
    Vec3 rq[4] = { {x0,h,z0}, {x1,h,z0}, {x1,h,z1}, {x0,h,z1} };
    drawClippedQuad3D(rq, cb, pal.roof, true, pal.frame);
    if (b.hasPenthouse && d2 < 260.0f * 260.0f) {
      const float pw = hw * 0.42f, pd = hd * 0.42f, ph = h + 10.0f;
      const float px0 = b.bx - pw, px1 = b.bx + pw, pz0 = b.bz - pd, pz1 = b.bz + pd;
      if (cb.cz < pz0) {
        Vec3 pq[4] = { {px0,h,pz0}, {px1,h,pz0}, {px1,ph,pz0}, {px0,ph,pz0} };
        drawClippedQuad3D(pq, cb, pal.sun, true, pal.frame);
      } else if (cb.cz > pz1) {
        Vec3 pq[4] = { {px1,h,pz1}, {px0,h,pz1}, {px0,ph,pz1}, {px1,ph,pz1} };
        drawClippedQuad3D(pq, cb, pal.shade, true, pal.frame);
      }
      Vec3 pr[4] = { {px0,ph,pz0}, {px1,ph,pz0}, {px1,ph,pz1}, {px0,ph,pz1} };
      drawClippedQuad3D(pr, cb, pal.trim, true, pal.frame);
    }
  }

  if (b.hasSpire && d2 < 420.0f * 420.0f) {
    drawClippedLine3D({ b.bx, h + 4.0f, b.bz }, { b.bx, h + 38.0f, b.bz }, cb, COL_CREAM);
  }
}

void drawCloud(const Cloud& c, const CamBasis& cb) {
  Pt2 p;
  float z;
  if (!projectWorld(c.x, c.y, c.z, cb, p, z)) return;
  if (z < 18.0f) return;

  int w = (int)((52.0f * c.scale * cb.d) / z);
  if (w < 6 || w > 120) return;
  int h = (w * 3) >> 3;
  if (h < 3) h = 3;

  int x0 = p.x - (w >> 1);
  int y0 = p.y - (h >> 1);
  if (x0 + w < 0 || x0 >= LCD_W || y0 + h < 0 || y0 >= LCD_H) return;

  // PC-98 stepped pixel cloud puff (zero alpha)
  spr.fillRect(x0 + (w >> 3), y0 + 1, w - (w >> 2), h, COL_CLOUD_SHADE);
  spr.fillRect(x0, y0, w, (h * 2) / 3 + 1, COL_CLOUD_MID);
  spr.fillRect(x0 + (w >> 2), y0 - (h >> 2), w >> 1, h >> 1, COL_CLOUD_LIGHT);
  spr.fillRect(x0 + (w >> 3), y0, (w * 3) >> 2, (h >> 1) + 1, COL_CLOUD_LIGHT);
}

// Compact 14x16 PC-98 Spider-Man Pixel Art Sprites (0=transparent chromakey)
// Palette: 1=INDIGO, 2=CRIMSON, 3=CRIMSON_SH, 4=ROYAL_BLUE, 5=BLUE_SH, 6=WHITE, 7=CYAN
constexpr uint16_t SPIDEY_PAL[8] = {
  COL_CHROMA, COL_INDIGO_OUTLINE, COL_CRIMSON, COL_CRIMSON_SHADE,
  COL_ROYAL_BLUE, COL_BLUE_SHADE, COL_WHITE, COL_NEON_CYAN
};

// Pose 0: Web Swing (arm raised right/up, knees tucked)
constexpr uint8_t SPR_SWING[16][14] = {
  {0,0,0,0,0,0,0,0,0,1,1,0,0,0},
  {0,0,0,0,0,1,1,1,1,2,2,1,0,0},
  {0,0,0,0,1,2,2,2,2,1,2,1,0,0},
  {0,0,0,0,1,2,6,2,6,2,1,0,0,0},
  {0,0,0,0,1,2,2,2,2,1,0,0,0,0},
  {0,0,0,1,2,2,2,2,2,1,0,0,0,0},
  {0,0,1,2,4,2,2,2,4,1,0,0,0,0},
  {0,1,2,1,4,4,2,4,4,1,0,0,0,0},
  {0,0,1,0,1,4,4,4,1,0,0,0,0,0},
  {0,0,0,1,4,5,2,4,4,1,0,0,0,0},
  {0,0,1,4,5,1,1,5,4,2,1,0,0,0},
  {0,0,1,2,2,1,0,1,2,2,1,0,0,0},
  {0,0,0,1,2,1,0,0,1,2,1,0,0,0},
  {0,0,0,0,1,0,0,0,0,1,0,0,0,0},
  {0,0,0,0,0,0,0,0,0,0,0,0,0,0},
  {0,0,0,0,0,0,0,0,0,0,0,0,0,0}
};

// Pose 1: Glide (Web-Wings spread wide)
constexpr uint8_t SPR_GLIDE[16][14] = {
  {0,0,0,0,0,1,1,1,1,0,0,0,0,0},
  {0,0,0,0,1,2,2,2,2,1,0,0,0,0},
  {0,0,0,0,1,2,6,2,6,1,0,0,0,0},
  {0,1,1,1,1,2,2,2,2,1,1,1,1,0},
  {1,2,2,2,2,2,2,2,2,2,2,2,2,1},
  {0,1,7,7,7,4,2,2,4,7,7,7,1,0},
  {0,0,1,7,7,4,2,2,4,7,7,1,0,0},
  {0,0,0,1,1,4,4,4,4,1,1,0,0,0},
  {0,0,0,0,1,4,2,2,4,1,0,0,0,0},
  {0,0,0,1,4,5,1,1,5,4,1,0,0,0},
  {0,0,0,1,2,2,1,1,2,2,1,0,0,0},
  {0,0,0,1,3,2,1,1,2,3,1,0,0,0},
  {0,0,0,0,1,1,0,0,1,1,0,0,0,0},
  {0,0,0,0,0,0,0,0,0,0,0,0,0,0},
  {0,0,0,0,0,0,0,0,0,0,0,0,0,0},
  {0,0,0,0,0,0,0,0,0,0,0,0,0,0}
};

// Pose 2: Freefall / Dive (tucked aerodynamic silhouette)
constexpr uint8_t SPR_DIVE[16][14] = {
  {0,0,0,0,0,0,0,0,0,0,0,0,0,0},
  {0,0,0,1,1,0,0,0,0,1,1,0,0,0},
  {0,0,1,2,2,1,0,0,1,2,2,1,0,0},
  {0,0,1,4,5,1,0,0,1,5,4,1,0,0},
  {0,0,0,1,4,4,1,1,4,4,1,0,0,0},
  {0,0,0,0,1,4,2,2,4,1,0,0,0,0},
  {0,0,0,1,2,4,2,2,4,2,1,0,0,0},
  {0,0,1,2,2,2,2,2,2,2,2,1,0,0},
  {0,0,1,2,1,2,2,2,2,1,2,1,0,0},
  {0,0,0,1,1,2,6,2,6,1,1,0,0,0},
  {0,0,0,0,1,2,2,2,2,1,0,0,0,0},
  {0,0,0,0,0,1,1,1,1,0,0,0,0,0},
  {0,0,0,0,0,0,0,0,0,0,0,0,0,0},
  {0,0,0,0,0,0,0,0,0,0,0,0,0,0},
  {0,0,0,0,0,0,0,0,0,0,0,0,0,0},
  {0,0,0,0,0,0,0,0,0,0,0,0,0,0}
};

void drawSpiderMan(const GameState& gs, const CamBasis& cb) {
  Pt2 p;
  float z;
  if (!projectWorld(gs.px, gs.py, gs.pz, cb, p, z)) return;

  const uint8_t (*bmp)[14] = SPR_DIVE;
  if (gs.isSwinging) bmp = SPR_SWING;
  else if (gs.isGliding) bmp = SPR_GLIDE;

  const bool flipX = gs.isSwinging && (gs.anchorSide < 0);
  const bool flipY = gs.doingFlip && (sinf(gs.flipAngle) < 0.0f);
  const int scale = (z < 18.0f) ? 2 : 1;
  const int drawW = 14 * scale;
  const int drawH = 16 * scale;
  const int ox = p.x - (drawW >> 1);
  const int oy = p.y - (drawH >> 1);

  for (int r = 0; r < 16; r++) {
    const int sr = flipY ? (15 - r) : r;
    const int py = oy + r * scale;
    if (py + scale < 0 || py >= LCD_H) continue;
    for (int c = 0; c < 14; c++) {
      const int sc = flipX ? (13 - c) : c;
      const uint8_t idx = bmp[sr][sc];
      if (idx == 0) continue;
      const int px = ox + c * scale;
      if (px + scale < 0 || px >= LCD_W) continue;
      if (scale == 1) spr.drawPixel(px, py, SPIDEY_PAL[idx]);
      else spr.fillRect(px, py, 2, 2, SPIDEY_PAL[idx]);
    }
  }
}

void drawHud(const GameState& gs, const InputState& in) {
  const float spd = sqrtf(gs.vx * gs.vx + gs.vy * gs.vy + gs.vz * gs.vz);

  // Top-left compact telemetry badge
  spr.fillRect(3, 3, 118, 28, COL_INDIGO_OUTLINE);
  spr.drawRect(3, 3, 118, 28, COL_NEON_CYAN);

  spr.setTextSize(1);
  spr.setTextDatum(TL_DATUM);

  char buf[36];
  snprintf(buf, sizeof(buf), "FPS:%2d  SPD:%3d", (int)(gs.fps + 0.5f), (int)(spd + 0.5f));
  spr.setTextColor(COL_GOLD, COL_INDIGO_OUTLINE);
  spr.drawString(buf, 7, 6);

  const char* stateTag = "AIR";
  uint16_t stateCol = COL_CREAM;
  if (gs.isSwinging && (gs.inPerfectWindow || gs.perfectGraceTimer > 0.0f)) {
    stateTag = "PERFECT!";
    stateCol = COL_NEON_CYAN;
  } else if (gs.isSwinging) {
    stateTag = gs.isRopeTaut ? "SWING" : "SLACK";
    stateCol = COL_WHITE;
  } else if (gs.isGliding) {
    stateTag = "GLIDE";
    stateCol = COL_EMERALD;
  } else if (gs.isDiving) {
    stateTag = "DIVE";
    stateCol = COL_ORANGE;
  } else if (gs.py <= 3.5f) {
    stateTag = "GROUND";
    stateCol = COL_GOLD;
  }

  snprintf(buf, sizeof(buf), "ALT:%3dm ", (int)(gs.py + 0.5f));
  spr.setTextColor(COL_CREAM, COL_INDIGO_OUTLINE);
  spr.drawString(buf, 7, 18);
  spr.setTextColor(stateCol, COL_INDIGO_OUTLINE);
  spr.drawString(stateTag, 64, 18);

  // Top-center dynamic popup banner
  if (gs.popupTimer > 0.0f && gs.popupText[0] != '\0') {
    spr.setTextDatum(TC_DATUM);
    spr.setTextColor(COL_INDIGO_OUTLINE);
    spr.drawString(gs.popupText, LCD_W / 2 + 1, 37);
    spr.setTextColor(gs.popupCol);
    spr.drawString(gs.popupText, LCD_W / 2, 36);
  }

  // Bottom speed/perfect progress bar
  if (gs.isSwinging && (gs.inPerfectWindow || gs.perfectGraceTimer > 0.0f)) {
    spr.drawRect(0, 0, LCD_W, LCD_H, COL_NEON_CYAN);
  }

  // Optional Phase 1 Hardware Bring-up Diagnostic Panel (Top-Right)
  if (gs.showDiagHud) {
    const int px = LCD_W - 118;
    spr.fillRect(px, 3, 115, 42, COL_INDIGO_OUTLINE);
    spr.drawRect(px, 3, 115, 42, COL_GOLD);

    spr.setTextDatum(TL_DATUM);
    snprintf(buf, sizeof(buf), "JX:%+.2f JY:%+.2f", in.turn, in.fwd);
    spr.setTextColor(COL_CREAM, COL_INDIGO_OUTLINE);
    spr.drawString(buf, px + 4, 6);

    snprintf(buf, sizeof(buf), "ADC:%4d/%4d", in.rawAdcX, in.rawAdcY);
    spr.setTextColor(COL_CLOUD_MID, COL_INDIGO_OUTLINE);
    spr.drawString(buf, px + 4, 16);

    // Individual button pin live indicators (Built-in + External)
    spr.setTextColor(in.swingHeld ? COL_EMERALD : COL_CREAM, COL_INDIGO_OUTLINE);
    snprintf(buf, sizeof(buf), "SW:%c%c", in.rawSwingInt ? 'I' : '-', in.rawSwingExt ? 'E' : '-');
    spr.drawString(buf, px + 4, 26);

    spr.setTextColor(in.strikeHeld ? COL_ORANGE : COL_CREAM, COL_INDIGO_OUTLINE);
    snprintf(buf, sizeof(buf), "ST:%c%c", in.rawStrikeInt ? 'I' : '-', in.rawStrikeExt ? 'E' : '-');
    spr.drawString(buf, px + 44, 26);

    spr.setTextColor(COL_GOLD, COL_INDIGO_OUTLINE);
    snprintf(buf, sizeof(buf), "B:%s", audioModeLabel());
    spr.drawString(buf, px + 82, 26);

    snprintf(buf, sizeof(buf), "FRAME:%2lu.%1lums", (unsigned long)(gs.frameUs / 1000), (unsigned long)((gs.frameUs % 1000) / 100));
    spr.setTextColor(gs.frameUs <= 16667 ? COL_EMERALD : COL_CRIMSON, COL_INDIGO_OUTLINE);
    spr.drawString(buf, px + 4, 35);
  }
}

} // namespace

bool rendererInit() {
  // Power on LCD rail (essential on T-Display-S3 when running off LiPo battery)
  pinMode(PIN_LCD_POWER_ON, OUTPUT);
  digitalWrite(PIN_LCD_POWER_ON, HIGH);
  delay(20);

  tft.init();
  tft.setRotation(3); // 320x170 Landscape (USB-C on right, buttons conveniently placed)
  tft.fillScreen(COL_INDIGO_OUTLINE);

  pinMode(PIN_LCD_BL, OUTPUT);
  digitalWrite(PIN_LCD_BL, HIGH);

  // Allocate 320x170 RGB565 single framebuffer (108.8KB) in fast internal SRAM first
  spr.setColorDepth(16);
  spr.setAttribute(PSRAM_ENABLE, false);
  if (!spr.createSprite(LCD_W, LCD_H)) {
    // Fallback to PSRAM if DRAM is fragmented
    spr.setAttribute(PSRAM_ENABLE, true);
    if (!spr.createSprite(LCD_W, LCD_H)) {
      return false;
    }
  }
  return true;
}

void rendererDrawFrame(const GameState& gs, const InputState& in, const NearbyWorld& world) {
  // Camera position (1:1 with js/renderer.js getCameraPos)
  const float sinLag = sinf(gs.camLagYaw);
  const float cosLag = cosf(gs.camLagYaw);

  CamBasis cb{};
  cb.cx   = gs.px - sinLag * gs.camDist;
  cb.cy   = fmaxf(3.2f, gs.py + 3.8f - gs.vy * 0.032f);
  cb.cz   = gs.pz - cosLag * gs.camDist;
  cb.cosY = cosLag;
  cb.sinY = sinLag;
  cb.cosP = cosf(gs.camPitch);
  cb.sinP = sinf(gs.camPitch);
  cb.cosR = cosf(gs.camRoll);
  cb.sinR = sinf(gs.camRoll);
  cb.d    = gs.fovD;
  cb.sx   = (gs.shakeMag > 0.1f) ? sinf(gs.simTime * 67.0f) * gs.shakeMag : 0.0f;
  cb.sy   = (gs.shakeMag > 0.1f) ? cosf(gs.simTime * 53.0f) * gs.shakeMag : 0.0f;

  // 1) Sky gradient + Asphalt ground + Road dashes
  drawSkyAndGround(cb);
  drawRoadGrid(world, cb);

  // 2) Clouds (back layer behind close skyscrapers)
  for (int i = 0; i < world.cloudCount; i++) {
    drawCloud(world.clouds[i], cb);
  }

  // 3) Frustum-cull & far-to-near sort buildings
  struct SortItem { int idx; float d2; };
  SortItem visible[MAX_NEARBY_BUILDINGS];
  int visCount = 0;

  for (int i = 0; i < world.buildingCount; i++) {
    const Building& b = world.buildings[i];
    const float dx = b.bx - cb.cx;
    const float dz = b.bz - cb.cz;
    const float localZ = dx * cb.sinY + dz * cb.cosY;
    if (localZ < -65.0f || localZ > RENDER_DIST + 40.0f) continue;

    const float localX = dx * cb.cosY - dz * cb.sinY;
    if (fabsf(localX) > fmaxf(95.0f, localZ * 1.35f + 70.0f)) continue;

    const float d2 = dx * dx + dz * dz;
    if (d2 > (RENDER_DIST + 45.0f) * (RENDER_DIST + 45.0f)) continue;

    visible[visCount++] = { i, d2 };
  }

  // Insertion sort descending by d2 (Painter's algorithm: far -> near)
  for (int i = 1; i < visCount; i++) {
    SortItem key = visible[i];
    int j = i - 1;
    while (j >= 0 && visible[j].d2 < key.d2) {
      visible[j + 1] = visible[j];
      j--;
    }
    visible[j + 1] = key;
  }

  for (int i = 0; i < visCount; i++) {
    drawPC98Building(world.buildings[visible[i].idx], visible[i].d2, cb);
  }

  // 4) 3D Clipped Web Line (White core + indigo outline)
  if (gs.isSwinging) {
    const Vec3 hand = { gs.px, gs.py + 1.2f, gs.pz };
    const Vec3 anch = { gs.ax, gs.ay, gs.az };
    const uint16_t webCol = (gs.inPerfectWindow || gs.perfectGraceTimer > 0.0f) ? COL_NEON_CYAN : COL_WHITE;
    drawClippedLine3D({ hand.x + 0.18f, hand.y, hand.z }, { anch.x + 0.18f, anch.y, anch.z }, cb, COL_INDIGO_OUTLINE);
    drawClippedLine3D(hand, anch, cb, webCol);

    // Anchor hit point marker
    Pt2 ap;
    float az;
    if (projectWorld(gs.ax, gs.ay, gs.az, cb, ap, az)) {
      spr.fillRect(ap.x - 1, ap.y - 1, 3, 3, webCol);
    }
  }

  // 5) Spider-Man Sprite
  drawSpiderMan(gs, cb);

  // 6) 3D Sparks
  for (int i = 0; i < MAX_SPARKS; i++) {
    const Spark& s = gs.sparks[i];
    if (!s.active) continue;
    Pt2 sp;
    float sz;
    if (projectWorld(s.x, s.y, s.z, cb, sp, sz)) {
      const int szPx = (sz < 28.0f) ? 3 : 2;
      spr.fillRect(sp.x - 1, sp.y - 1, szPx, szPx, s.col);
    }
  }

  // 7) HUD & Push 108.8KB RGB565 Framebuffer via 8-bit 8080 Parallel Bus
  drawHud(gs, in);
  spr.pushSprite(0, 0);
}
