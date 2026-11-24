'use strict';
// Spider 3D — 3D Camera, Clipping, PC-98 Entities & World Frame Renderer

// =========================================================================
// 9. 3D CAMERA BASIS, NEAR-PLANE CLIPPING & RENDER HELPERS
// =========================================================================
function getCameraPos() {
  const sinY = Math.sin(camLagYaw), cosY = Math.cos(camLagYaw);
  const rightX = cosY, rightZ = -sinY;
  const sideShift = strikeCamBlend * strikeCamSide * 3.2;
  const baseCam = thirdPerson ? {
    cx: px - sinY * camDist + rightX * sideShift,
    cy: Math.max(3.2, py + 3.8 - vy * 0.032 - strikeCamBlend * 1.4),
    cz: pz - cosY * camDist + rightZ * sideShift
  } : { cx: px, cy: py, cz: pz };

  if (apexCamBlend > 0.001) {
    const b = Math.max(0.0, Math.min(1.0, apexCamBlend));
    return {
      cx: baseCam.cx + (apexCamX - baseCam.cx) * b,
      cy: baseCam.cy + (apexCamY - baseCam.cy) * b,
      cz: baseCam.cz + (apexCamZ - baseCam.cz) * b
    };
  }
  if (openingCamBlend > 0.001) {
    const b = Math.max(0.0, Math.min(1.0, openingCamBlend));
    return {
      cx: baseCam.cx + (openCamX - baseCam.cx) * b,
      cy: baseCam.cy + (openCamY - baseCam.cy) * b,
      cz: baseCam.cz + (openCamZ - baseCam.cz) * b
    };
  }
  return baseCam;
}

function makeCamBasis(camPos, yaw, pitch, roll, d, sx, sy) {
  return {
    cx: camPos.cx, cy: camPos.cy, cz: camPos.cz,
    cosY: Math.cos(yaw), sinY: Math.sin(yaw),
    cosP: Math.cos(pitch), sinP: Math.sin(pitch),
    cosR: Math.cos(roll), sinR: Math.sin(roll),
    d, sx, sy
  };
}

function worldToCam(x, y, z, cb) {
  const dx = x - cb.cx, dy = y - cb.cy, dz = z - cb.cz;
  const rx0 = dx * cb.cosY - dz * cb.sinY;
  const rz0 = dx * cb.sinY + dz * cb.cosY;
  const ry1 = dy * cb.cosP - rz0 * cb.sinP;
  const rz1 = dy * cb.sinP + rz0 * cb.cosP;
  const rx2 = rx0 * cb.cosR - ry1 * cb.sinR;
  const ry2 = rx0 * cb.sinR + ry1 * cb.cosR;
  return { x: rx2, y: ry2, z: rz1 };
}

function projectCamPt(p, cb) {
  return {
    x: (p.x / p.z) * cb.d + LCD_W * 0.5 + cb.sx,
    y: (-p.y / p.z) * cb.d + LCD_H * 0.5 + cb.sy,
    z: p.z
  };
}

function projectWorldPt(x, y, z, cb) {
  const c = worldToCam(x, y, z, cb);
  if (c.z <= NEAR_Z || c.z > RENDER_DIST + 80) return null;
  return projectCamPt(c, cb);
}

function clipPolyNear(camPts, nearZ = NEAR_Z) {
  const out = [];
  const n = camPts.length;
  for (let i = 0; i < n; i++) {
    const a = camPts[i];
    const b = camPts[(i + 1) % n];
    const aIn = a.z >= nearZ;
    const bIn = b.z >= nearZ;
    if (aIn) out.push(a);
    if (aIn !== bIn) {
      const t = (nearZ - a.z) / (b.z - a.z);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: nearZ });
    }
  }
  return out;
}

function drawClippedPoly3D(worldPts, cb, fill, stroke = null) {
  const camPts = worldPts.map(p => worldToCam(p[0], p[1], p[2], cb));
  let anyFront = false, allFar = true;
  for (const c of camPts) {
    if (c.z >= NEAR_Z) anyFront = true;
    if (c.z <= RENDER_DIST) allFar = false;
  }
  if (!anyFront || allFar) return false;

  const clipped = clipPolyNear(camPts, NEAR_Z);
  if (clipped.length < 3) return false;

  ctx.beginPath();
  const p0 = projectCamPt(clipped[0], cb);
  ctx.moveTo(p0.x, p0.y);
  for (let i = 1; i < clipped.length; i++) {
    const pi = projectCamPt(clipped[i], cb);
    ctx.lineTo(pi.x, pi.y);
  }
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  return true;
}

function drawClippedLine3D(a3, b3, cb, color, width = 1) {
  let a = worldToCam(a3[0], a3[1], a3[2], cb);
  let b = worldToCam(b3[0], b3[1], b3[2], cb);
  if (a.z < NEAR_Z && b.z < NEAR_Z) return;
  if (a.z > RENDER_DIST + 80 && b.z > RENDER_DIST + 80) return;
  if (a.z < NEAR_Z) {
    const t = (NEAR_Z - a.z) / (b.z - a.z);
    a = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: NEAR_Z };
  } else if (b.z < NEAR_Z) {
    const t = (NEAR_Z - b.z) / (a.z - b.z);
    b = { x: b.x + (a.x - b.x) * t, y: b.y + (a.y - b.y) * t, z: NEAR_Z };
  }
  const pa = projectCamPt(a, cb), pb = projectCamPt(b, cb);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(pa.x, pa.y);
  ctx.lineTo(pb.x, pb.y);
  ctx.stroke();
}

// Jagged Pixel Lightning Renderer (3 segments, zero alpha overhead)
function drawLightning3D(bolt, cb) {
  const p1 = projectWorldPt(bolt.x1, bolt.y1, bolt.z1, cb);
  const p2 = projectWorldPt(bolt.x2, bolt.y2, bolt.z2, cb);
  if (!p1 || !p2) return;

  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const jitter = Math.min(10, len * 0.14);

  const m1x = p1.x + dx * 0.33 + nx * ((Math.random() - 0.5) * jitter * 2);
  const m1y = p1.y + dy * 0.33 + ny * ((Math.random() - 0.5) * jitter * 2);
  const m2x = p1.x + dx * 0.67 + nx * ((Math.random() - 0.5) * jitter * 2);
  const m2y = p1.y + dy * 0.67 + ny * ((Math.random() - 0.5) * jitter * 2);

  ctx.strokeStyle = PAL.INDIGO_OUTLINE;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y); ctx.lineTo(m1x, m1y); ctx.lineTo(m2x, m2y); ctx.lineTo(p2.x, p2.y);
  ctx.stroke();

  ctx.strokeStyle = bolt.col;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y); ctx.lineTo(m1x, m1y); ctx.lineTo(m2x, m2y); ctx.lineTo(p2.x, p2.y);
  ctx.stroke();
}

// =========================================================================
// 10. PC-98 SKYSCRAPERS, 3-TIER ENEMIES, RADAR & SPIDER-MAN RENDERERS
// =========================================================================
function drawPC98Face(corners, isSunlit, b, d2, cb, faceIdx, stageCfg, stagePat) {
  const theme = stageCfg.bldgThemes[b.palIdx];
  const pat = stagePat.bldg[b.palIdx];
  const wallPattern = isSunlit ? pat.sun : pat.shade;
  const trimCol = isSunlit ? theme.trim : theme.trimSh;

  if (!drawClippedPoly3D(corners, cb, wallPattern, theme.frame)) return;

  const lerp3 = (pA, pB, t) => [
    pA[0] + (pB[0] - pA[0]) * t,
    pA[1] + (pB[1] - pA[1]) * t,
    pA[2] + (pB[2] - pA[2]) * t
  ];
  const bilerp = (u, v) => {
    const bot = lerp3(corners[0], corners[1], u);
    const top = lerp3(corners[3], corners[2], u);
    return lerp3(bot, top, v);
  };

  if (isSunlit && d2 < 360 * 360) {
    drawClippedLine3D(corners[0], corners[3], cb, trimCol, 1);
  }

  const lobbyV = Math.min(0.18, 16.0 / b.bh);
  if (d2 < 360 * 360) {
    drawClippedPoly3D([corners[0], corners[1], bilerp(1, lobbyV), bilerp(0, lobbyV)], cb, theme.lobby, theme.frame);
    if (d2 < 240 * 240) {
      const awV0 = lobbyV * 0.56, awV1 = lobbyV * 0.92;
      const awCol = PAL.AWNINGS[(b.awningIdx + faceIdx) % PAL.AWNINGS.length];
      drawClippedPoly3D([bilerp(0.08, awV0), bilerp(0.92, awV0), bilerp(0.92, awV1), bilerp(0.08, awV1)], cb, awCol, theme.frame);
      drawClippedLine3D(bilerp(0.08, awV1), bilerp(0.92, awV1), cb, PAL.CREAM, 1);
    }
  }

  const ledgeCount = d2 < 240 * 240 ? 6 : 3;
  for (let i = 1; i < ledgeCount; i++) {
    const v = lobbyV + (1 - lobbyV) * (i / ledgeCount);
    drawClippedLine3D(bilerp(0, v), bilerp(1, v), cb, trimCol, 1);
  }

  if (d2 < 235 * 235) {
    const close = d2 < 145 * 145;
    const cols = close ? 4 : 3;
    const rows = close ? Math.min(10, Math.floor((b.bh - 22) / 22)) : Math.min(6, Math.floor((b.bh - 22) / 34));
    const padU = 0.055;
    const stepU = (1.0 - padU * 2) / cols;
    const winW = stepU * 0.62;
    const startV = lobbyV + 0.04;
    const spanV = 0.94 - startV;
    const stepV = spanV / Math.max(1, rows);
    const winH = stepV * 0.56;

    for (let r = 0; r < rows; r++) {
      const v0 = startV + r * stepV;
      const v1 = v0 + winH;
      for (let c = 0; c < cols; c++) {
        const u0 = padU + c * stepU + stepU * 0.19;
        const u1 = u0 + winW;
        const hash = ((b.seed + r * 31 + c * 17 + faceIdx * 13) & 15);
        let paneCol;
        if (currentStage >= 3) {
          paneCol = hash < 5 ? theme.winSky : (hash < 10 ? theme.winWarm : theme.winDark);
        } else {
          paneCol = hash < 5 ? theme.winSky : (hash < 12 ? theme.winDark : theme.winWarm);
        }

        const pBL = bilerp(u0, v0), pBR = bilerp(u1, v0);
        const pTR = bilerp(u1, v1), pTL = bilerp(u0, v1);

        if (close) {
          const fBL = bilerp(u0 - 0.013, v0 - 0.007);
          const fBR = bilerp(u1 + 0.013, v0 - 0.007);
          const fTR = bilerp(u1 + 0.013, v1 + 0.008);
          const fTL = bilerp(u0 - 0.013, v1 + 0.008);
          drawClippedPoly3D([fBL, fBR, fTR, fTL], cb, theme.frame);
          drawClippedPoly3D([pBL, pBR, pTR, pTL], cb, paneCol);
          drawClippedLine3D(pBL, pBR, cb, isSunlit ? theme.sill : trimCol, 1);
        } else {
          drawClippedPoly3D([pBL, pBR, pTR, pTL], cb, paneCol);
        }
      }
    }
  } else if (d2 < 430 * 430) {
    for (let i = 1; i <= 5; i++) {
      const v = 0.18 + i * 0.14;
      const bandCol = currentStage >= 3
        ? ((i & 1) ? theme.winSky : theme.winWarm)
        : (isSunlit ? theme.winSky : theme.winDark);
      drawClippedLine3D(bilerp(0.08, v), bilerp(0.92, v), cb, bandCol, 1);
    }
  }
}

function drawPC98Building(b, d2, cb, stageCfg, stagePat) {
  const hw = b.bw * 0.5, hd = b.bd * 0.5;
  const x0 = b.bx - hw, x1 = b.bx + hw;
  const z0 = b.bz - hd, z1 = b.bz + hd;
  const h = b.bh;
  const theme = stageCfg.bldgThemes[b.palIdx];
  const pat = stagePat.bldg[b.palIdx];

  if (cb.cz < z0)      drawPC98Face([[x0, 0, z0], [x1, 0, z0], [x1, h, z0], [x0, h, z0]], true,  b, d2, cb, 0, stageCfg, stagePat);
  else if (cb.cz > z1) drawPC98Face([[x1, 0, z1], [x0, 0, z1], [x0, h, z1], [x1, h, z1]], false, b, d2, cb, 1, stageCfg, stagePat);

  if (cb.cx < x0)      drawPC98Face([[x0, 0, z1], [x0, 0, z0], [x0, h, z0], [x0, h, z1]], true,  b, d2, cb, 2, stageCfg, stagePat);
  else if (cb.cx > x1) drawPC98Face([[x1, 0, z0], [x1, 0, z1], [x1, h, z1], [x1, h, z0]], false, b, d2, cb, 3, stageCfg, stagePat);

  if (cb.cy > h) {
    drawClippedPoly3D([[x0, h, z0], [x1, h, z0], [x1, h, z1], [x0, h, z1]], cb, pat.roof, theme.frame);
    if (b.isStartRoof) {
      drawClippedLine3D([x0 + 1.5, h + 0.15, z1 - 0.6], [x1 - 1.5, h + 0.15, z1 - 0.6], cb, PAL.INDIGO_OUTLINE, 3);
      drawClippedLine3D([x0 + 1.5, h + 0.15, z1 - 0.6], [x1 - 1.5, h + 0.15, z1 - 0.6], cb, PAL.GOLD, 1.5);
      // 초고층 전망대 난간 보행 가이드 라인 & 좌우 항공 장애등 점멸
      drawClippedLine3D([b.bx - 3.5, h + 0.12, z0 + 6.0], [b.bx - 3.5, h + 0.12, z1 - 1.5], cb, '#475569', 1);
      drawClippedLine3D([b.bx + 3.5, h + 0.12, z0 + 6.0], [b.bx + 3.5, h + 0.12, z1 - 1.5], cb, '#475569', 1);
      const beaconBlink = (Math.floor(performance.now() / 380) & 1) === 0;
      const bCol = beaconBlink ? PAL.CRIMSON : PAL.GOLD;
      const corners = [[x0 + 2.0, h + 3.2, z1 - 1.5], [x1 - 2.0, h + 3.2, z1 - 1.5]];
      for (let ci = 0; ci < 2; ci++) {
        const c3 = corners[ci];
        drawClippedLine3D([c3[0], h, c3[2]], c3, cb, PAL.INDIGO_OUTLINE, 2);
        const bp = projectWorldPt(c3[0], c3[1], c3[2], cb);
        if (bp) {
          ctx.fillStyle = PAL.INDIGO_OUTLINE; ctx.fillRect((bp.x - 2) | 0, (bp.y - 2) | 0, 5, 5);
          ctx.fillStyle = bCol; ctx.fillRect((bp.x - 1) | 0, (bp.y - 1) | 0, 3, 3);
        }
      }
    }
    if (b.hasPenthouse && d2 < 340 * 340) {
      const pw = hw * 0.44, pd = hd * 0.44, ph = h + 11.0;
      const px0 = b.bx - pw, px1 = b.bx + pw, pz0 = b.bz - pd, pz1 = b.bz + pd;
      if (cb.cz < pz0)      drawClippedPoly3D([[px0, h, pz0], [px1, h, pz0], [px1, ph, pz0], [px0, ph, pz0]], cb, pat.sun, theme.frame);
      else if (cb.cz > pz1) drawClippedPoly3D([[px1, h, pz1], [px0, h, pz1], [px0, ph, pz1], [px1, ph, pz1]], cb, pat.shade, theme.frame);
      if (cb.cx < px0)      drawClippedPoly3D([[px0, h, pz1], [px0, h, pz0], [px0, ph, pz0], [px0, ph, pz1]], cb, pat.sun, theme.frame);
      else if (cb.cx > px1) drawClippedPoly3D([[px1, h, pz0], [px1, h, pz1], [px1, ph, pz1], [px1, ph, pz0]], cb, pat.shade, theme.frame);
      drawClippedPoly3D([[px0, ph, pz0], [px1, ph, pz0], [px1, ph, pz1], [px0, ph, pz1]], cb, theme.trim, theme.frame);
    }
    if (b.hasWaterTower && d2 < 320 * 320) {
      const wtPt = projectWorldPt(b.bx + hw * 0.45, h + 7.5, b.bz - hd * 0.4, cb);
      if (wtPt && wtPt.z > 10) {
        const s = Math.max(0.45, Math.min(2.2, (11.0 * cb.d) / (wtPt.z * 14.0)));
        const tw = (waterTowerSprite.width * s) | 0;
        const th = (waterTowerSprite.height * s) | 0;
        if (tw >= 4) ctx.drawImage(waterTowerSprite, (wtPt.x - tw * 0.5) | 0, (wtPt.y - th * 0.5) | 0, tw, th);
      }
    }
  }
  if (b.hasSpire && d2 < 460 * 460) {
    drawClippedLine3D([b.bx, h + 10, b.bz], [b.bx, h + 42, b.bz], cb, PAL.INDIGO_OUTLINE, 2);
    const spireCol = currentStage === 4 ? PAL.GOLD : (currentStage === 3 ? '#ff5cf4' : '#e2ecff');
    drawClippedLine3D([b.bx, h + 10, b.bz], [b.bx, h + 42, b.bz], cb, spireCol, 1);
  }
}

// Render 3-Tier PC-98 Pixel Enemies + Compact HP Bar + Animated Lock-On Reticle
function drawEnemy3D(e, cb) {
  const p = projectWorldPt(e.x, e.y, e.z, cb);
  if (!p || p.z < 4) return;

  const maxDrawH = e.isBoss ? 82 : 62;
  const drawH = Math.max(6, Math.min(maxDrawH, (e.radius * 1.95 / p.z) * cb.d));
  const cx = Math.round(p.x), cy = Math.round(p.y);
  const half = Math.max(3, Math.round(drawH * 0.5));
  const flash = e.hitFlash > 0 && ((Math.floor(simTime * 30) & 1) === 0);

  if (e.isBoss) {
    const isGroggy = (bossPhase === 'GROGGY');
    const isP2 = (bossStage >= 2);
    const spin = simTime * (isGroggy ? 0.6 : (isP2 ? 2.4 : 1.6));

    // 1) EVADE 중 외장 2겹 회전 방어 실드 링 (순수 12각형 벡터로 ESP32 1:1 이식 대응)
    if (!isGroggy) {
      const ringR = half + 5 + ((Math.floor(simTime * 10) & 1) ? 2 : 0);
      const ry = Math.max(4, Math.round(ringR * 0.44));
      const drawTiltRing = (rot, col) => {
        const cr = Math.cos(rot), sr = Math.sin(rot);
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let k = 0; k <= 12; k++) {
          const t = (k / 12) * Math.PI * 2;
          const lx = Math.cos(t) * ringR;
          const ly = Math.sin(t) * ry;
          const rx = cx + lx * cr - ly * sr;
          const ry0 = cy + lx * sr + ly * cr;
          if (k === 0) ctx.moveTo(rx, ry0); else ctx.lineTo(rx, ry0);
        }
        ctx.stroke();
      };
      drawTiltRing(spin, isP2 ? PAL.GOLD : PAL.NEON_CYAN);
      drawTiltRing(-spin * 0.85, isP2 ? PAL.CRIMSON : '#a78bfa');
    } else {
      const gR = half + 6 + ((Math.floor(simTime * 14) & 1) ? 3 : 0);
      ctx.strokeStyle = PAL.GOLD;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, gR, 0, Math.PI * 2); ctx.stroke();
    }

    // 2) 외장 회전 팔각형 아머
    const outerR = isGroggy ? (half + 3) : half;
    ctx.fillStyle = PAL.INDIGO_OUTLINE;
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = spin * 0.4 + (k / 8) * Math.PI * 2;
      const vx0 = cx + Math.cos(a) * (outerR + 2);
      const vy0 = cy + Math.sin(a) * (outerR + 2);
      if (k === 0) ctx.moveTo(vx0, vy0); else ctx.lineTo(vx0, vy0);
    }
    ctx.closePath(); ctx.fill();

    ctx.fillStyle = flash ? '#ffffff' : (isGroggy ? '#3b2458' : (isP2 ? '#8f1333' : '#2d3b66'));
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = spin * 0.4 + (k / 8) * Math.PI * 2;
      const vx0 = cx + Math.cos(a) * outerR;
      const vy0 = cy + Math.sin(a) * outerR;
      if (k === 0) ctx.moveTo(vx0, vy0); else ctx.lineTo(vx0, vy0);
    }
    ctx.closePath(); ctx.fill();

    // 3) 중앙 약점 코어
    const coreR = Math.max(4, Math.round(half * (isGroggy ? 0.58 : 0.40)));
    ctx.fillStyle = PAL.INDIGO_OUTLINE;
    ctx.fillRect(cx - coreR - 1, cy - coreR - 1, coreR * 2 + 2, coreR * 2 + 2);
    ctx.fillStyle = flash ? PAL.NEON_CYAN : (isGroggy ? PAL.GOLD : (isP2 ? PAL.GOLD : PAL.CRIMSON));
    ctx.fillRect(cx - coreR, cy - coreR, coreR * 2, coreR * 2);
    ctx.fillStyle = '#ffffff';
    const innerR = Math.max(2, Math.round(coreR * 0.45));
    ctx.fillRect(cx - innerR, cy - innerR, innerR * 2, innerR * 2);
  } else if (e.type === 'ELITE_CORE') {
    const pulseR = half + 3 + ((Math.floor(simTime * 10) & 1) ? 2 : 0);
    ctx.strokeStyle = PAL.GOLD;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, pulseR, 0, Math.PI * 2); ctx.stroke();

    ctx.fillStyle = PAL.INDIGO_OUTLINE;
    ctx.beginPath();
    ctx.moveTo(cx, cy - half - 2); ctx.lineTo(cx + half + 2, cy);
    ctx.lineTo(cx, cy + half + 2); ctx.lineTo(cx - half - 2, cy);
    ctx.closePath(); ctx.fill();

    ctx.fillStyle = flash ? '#ffffff' : PAL.CRIMSON;
    ctx.beginPath();
    ctx.moveTo(cx, cy - half); ctx.lineTo(cx + half, cy);
    ctx.lineTo(cx, cy + half); ctx.lineTo(cx - half, cy);
    ctx.closePath(); ctx.fill();

    const coreR = Math.max(3, Math.round(half * 0.5));
    ctx.fillStyle = flash ? PAL.NEON_CYAN : PAL.GOLD;
    ctx.fillRect(cx - coreR, cy - coreR, coreR * 2, coreR * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - 2, cy - 2, 4, 4);
  } else if (e.type === 'SKY_CORE') {
    ctx.fillStyle = PAL.INDIGO_OUTLINE;
    ctx.beginPath();
    ctx.moveTo(cx, cy - half - 2); ctx.lineTo(cx + half + 2, cy);
    ctx.lineTo(cx, cy + half + 2); ctx.lineTo(cx - half - 2, cy);
    ctx.closePath(); ctx.fill();

    ctx.fillStyle = flash ? '#ffffff' : '#6c24a8';
    ctx.beginPath();
    ctx.moveTo(cx, cy - half); ctx.lineTo(cx + half, cy);
    ctx.lineTo(cx, cy + half); ctx.lineTo(cx - half, cy);
    ctx.closePath(); ctx.fill();

    const coreR = Math.max(2, Math.round(half * 0.5));
    ctx.fillStyle = flash ? PAL.GOLD : PAL.NEON_PINK;
    ctx.fillRect(cx - coreR, cy - coreR, coreR * 2, coreR * 2);
  } else if (e.type === 'WALL_TURRET') {
    ctx.fillStyle = PAL.INDIGO_OUTLINE;
    ctx.fillRect(cx - half - 1, cy - half - 1, half * 2 + 2, half * 2 + 2);
    ctx.fillStyle = flash ? '#ffffff' : '#4a5574';
    ctx.fillRect(cx - half, cy - half, half * 2, half * 2);
    ctx.fillStyle = flash ? PAL.GOLD : PAL.CRIMSON;
    ctx.fillRect(cx - Math.round(half * 0.65), cy - Math.round(half * 0.45), Math.round(half * 1.3), Math.round(half * 0.9));
    ctx.fillStyle = PAL.GOLD;
    ctx.fillRect(cx - Math.max(1, (half * 0.25) | 0), cy - Math.max(1, (half * 0.25) | 0), Math.max(2, (half * 0.5) | 0), Math.max(2, (half * 0.5) | 0));
  } else {
    // 1단계 추격 스웜 드론
    const rw = Math.round(half * 1.35);
    const rh = Math.max(2, Math.round(half * 0.6));
    ctx.fillStyle = PAL.INDIGO_OUTLINE;
    ctx.fillRect(cx - rw - 1, cy - rh - 1, rw * 2 + 2, rh * 2 + 2);
    ctx.fillStyle = flash ? '#ffffff' : PAL.ORANGE;
    ctx.fillRect(cx - rw, cy - rh, rw * 2, rh * 2);
    ctx.fillStyle = PAL.NEON_CYAN;
    ctx.fillRect(cx - Math.round(rw * 0.55), cy - Math.max(1, rh >> 1), Math.round(rw * 1.1), Math.max(2, rh));
  }

  if (!e.isBoss && (e.tier === 'ELITE' || e.tier === 'MEDIUM' || e.hp < e.maxHp)) {
    const barW = e.tier === 'ELITE' ? 30 : (e.tier === 'MEDIUM' ? 20 : 12);
    const barH = e.tier === 'ELITE' ? 4 : 3;
    const bx = Math.round(cx - barW * 0.5);
    const by = cy - half - (e.tier === 'ELITE' ? 10 : 7);
    ctx.fillStyle = PAL.INDIGO_OUTLINE;
    ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);
    ctx.fillStyle = '#241838';
    ctx.fillRect(bx, by, barW, barH);
    const fillW = Math.max(1, Math.round((Math.max(0, e.hp) / e.maxHp) * barW));
    ctx.fillStyle = e.tier === 'ELITE' ? PAL.GOLD : (e.tier === 'MEDIUM' ? PAL.CRIMSON : PAL.ORANGE);
    ctx.fillRect(bx, by, fillW, barH);
  }

  const isLocked = (homingTarget === e || strikeTarget === e);
  if (isLocked) {
    const isStrikingThis = (strikeTarget === e && strikeMode !== 0);
    const previewCase = strikeMode !== 0 ? strikeMode : classifyStrikeCase();
    const curSpd = Math.hypot(vx, vy, vz);
    const distM = Math.round(Math.hypot(e.x - px, e.y - py, e.z - pz));
    const est = computeStrikeDamage(previewCase, curSpd, distM, Math.max(0, -vy), false);
    const canOneShotMed = (!e.isBoss && e.tier !== 'SWARM' && est.dmg >= e.hp);
    const isInstantC3 = (previewCase === 3 && curSpd >= STRIKE_NO_FREEZE_SPEED);
    const r = Math.max(9, Math.round(drawH * 0.68 + Math.sin(simTime * 18) * 2));
    const brk = Math.max(4, (r * 0.42) | 0);
    const retCol = (isStrikingThis || canOneShotMed)
      ? PAL.GOLD
      : (previewCase === 1 ? PAL.ORANGE : (isInstantC3 ? PAL.NEON_CYAN : PAL.NEON_PINK));

    const drawCorners = (col, lw) => {
      ctx.strokeStyle = col; ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(cx - r, cy - r + brk); ctx.lineTo(cx - r, cy - r); ctx.lineTo(cx - r + brk, cy - r);
      ctx.moveTo(cx + r - brk, cy - r); ctx.lineTo(cx + r, cy - r); ctx.lineTo(cx + r, cy - r + brk);
      ctx.moveTo(cx - r, cy + r - brk); ctx.lineTo(cx - r, cy + r); ctx.lineTo(cx - r + brk, cy + r);
      ctx.moveTo(cx + r - brk, cy + r); ctx.lineTo(cx + r, cy + r); ctx.lineTo(cx + r, cy + r - brk);
      ctx.stroke();
    };
    drawCorners(PAL.INDIGO_OUTLINE, 3);
    drawCorners(retCol, 1.4);

    const modeStr = canOneShotMed ? '1-HIT! ' : (previewCase === 1 ? 'C1 ' : (isInstantC3 ? 'FAST ' : 'C3 '));
    const tag = (isStrikingThis ? 'STRIKE ' : modeStr) + 'HP' + e.hp + ' ' + distM + 'm';
    ctx.font = 'bold 7.5px Consolas, monospace';
    const tw = ctx.measureText(tag).width;
    const tx = Math.round(cx - tw * 0.5);
    const ty = cy + r + 9;
    ctx.fillStyle = '#121936';
    ctx.fillRect(tx - 2, ty - 7, Math.round(tw + 4), 9);
    ctx.fillStyle = retCol;
    ctx.fillText(tag, tx, ty);
  }
}

// Step 3 보스전 전용 3D 기믹 렌더링 (공전/부유 기뢰, 반발 펄스 경고, 조준 레이저)
function drawRing3D(cx, cy, cz, r, segs, plane, cb, col, width) {
  if (r <= 0.5 || segs < 4) return;
  let prevX = 0, prevY = 0, prevZ = 0;
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const c = Math.cos(a) * r;
    const s = Math.sin(a) * r;
    let wx = cx, wy = cy, wz = cz;
    if (plane === 'XZ') {
      wx = cx + c; wz = cz + s;
    } else if (plane === 'XY') {
      wx = cx + c; wy = cy + s;
    } else {
      wy = cy + s; wz = cz + c;
    }
    if (i > 0) {
      drawClippedLine3D([prevX, prevY, prevZ], [wx, wy, wz], cb, col, width);
    }
    prevX = wx; prevY = wy; prevZ = wz;
  }
}

function drawBossHazards3D(cb) {
  if (!bossActive) return;

  const fastBlink = ((Math.floor(simTime * 18) & 1) === 0);
  const medBlink = ((Math.floor(simTime * 10) & 1) === 0);

  // 1) 보스 공전 실드 에너지 기뢰
  for (let i = 0; i < bossMines.length; i++) {
    const m = bossMines[i];
    if (m.respawnTimer > 0) continue;
    const mp = projectWorldPt(m.x, m.y, m.z, cb);
    if (!mp || mp.z < 4) continue;
    const mr = Math.max(3, Math.min(18, (m.radius * 1.1 / mp.z) * cb.d));
    const mx = Math.round(mp.x), my = Math.round(mp.y);
    const blink = ((Math.floor(simTime * 12 + i) & 1) === 0);

    ctx.fillStyle = PAL.INDIGO_OUTLINE;
    ctx.beginPath();
    ctx.moveTo(mx, my - mr - 2); ctx.lineTo(mx + mr + 2, my);
    ctx.lineTo(mx, my + mr + 2); ctx.lineTo(mx - mr - 2, my);
    ctx.closePath(); ctx.fill();

    ctx.fillStyle = blink ? PAL.CRIMSON : '#9b1c48';
    ctx.beginPath();
    ctx.moveTo(mx, my - mr); ctx.lineTo(mx + mr, my);
    ctx.lineTo(mx, my + mr); ctx.lineTo(mx - mr, my);
    ctx.closePath(); ctx.fill();

    ctx.fillStyle = blink ? '#ffffff' : PAL.GOLD;
    ctx.fillRect(mx - 1, my - 1, 2, 2);
  }

  // 2) 패턴 D: REPULSOR DOME (근접 62m 3D 구형 외곽 링 + 수축 타이밍 링)
  if (bossEntity && bossPulseState === 'WARN') {
    const b = bossEntity;
    const remRatio = Math.max(0.05, Math.min(1.0, bossPulseTimer / 0.95));
    const outerCol = fastBlink ? PAL.CRIMSON : PAL.GOLD;
    drawRing3D(b.x, b.y, b.z, 62.0, 12, 'XZ', cb, outerCol, 1);
    drawRing3D(b.x, b.y, b.z, 62.0, 10, 'XY', cb, PAL.CRIMSON, 1);
    drawRing3D(b.x, b.y, b.z, 62.0 * remRatio, 10, 'XZ', cb, fastBlink ? '#ffffff' : PAL.GOLD, 2);
  }

  // 3) 패턴 A: SOLAR SWEEP (예고 부채꼴 평면 궤적 -> 고출력 휩쓸기 빔)
  if (bossEntity && bossSweep && bossPatternType === 'SWEEP') {
    const b = bossEntity;
    const sw = bossSweep;
    const getEndPt = (frac) => {
      const ang = sw.startAngle + (sw.endAngle - sw.startAngle) * frac;
      return [
        b.x + Math.sin(ang) * sw.length,
        sw.targetY + (frac - 0.5) * 2.0 * sw.tiltY,
        b.z + Math.cos(ang) * sw.length
      ];
    };

    if (bossPatternStage === 'WARN') {
      const warnCol = fastBlink ? PAL.CRIMSON : PAL.GOLD;
      const p0 = getEndPt(0.0);
      const p1 = getEndPt(1.0);
      // 부채꼴 양 끝 경계선 (2px)
      drawClippedLine3D([b.x, b.y, b.z], p0, cb, '#ffffff', 2);
      drawClippedLine3D([b.x, b.y, b.z], p1, cb, warnCol, 1);
      // 중간 3가닥 가이드선 + 외곽 호(Arc) 연결로 3D 스윕 평면 명확히 표시
      let prevArc = p0;
      for (let k = 1; k <= 4; k++) {
        const frac = k / 4;
        const pk = (k === 4) ? p1 : getEndPt(frac);
        if (k < 4) drawClippedLine3D([b.x, b.y, b.z], pk, cb, warnCol, 1);
        drawClippedLine3D(prevArc, pk, cb, medBlink ? PAL.GOLD : PAL.CRIMSON, 1);
        prevArc = pk;
      }
      // 시작점 펄스 마커 (빔이 시작될 위치 강조)
      const sp = projectWorldPt(p0[0], p0[1], p0[2], cb);
      if (sp && sp.z > 4) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(Math.round(sp.x) - 3, Math.round(sp.y) - 3, 6, 6);
      }
    } else if (bossPatternStage === 'ACTIVE') {
      // 잔여 스윕 경계 가이드
      const pEnd = getEndPt(1.0);
      drawClippedLine3D([b.x, b.y, b.z], pEnd, cb, '#8b1e3f', 1);
      // 현재 휩쓸고 있는 고출력 솔라 빔
      const frac = Math.max(0.0, Math.min(1.0, (sw.curAngle - sw.startAngle) / ((sw.endAngle - sw.startAngle) || 0.001)));
      const pCur = getEndPt(frac);
      drawClippedLine3D([b.x, b.y, b.z], pCur, cb, PAL.INDIGO_OUTLINE, 6);
      drawClippedLine3D([b.x, b.y, b.z], pCur, cb, PAL.CRIMSON, 4);
      drawClippedLine3D([b.x, b.y, b.z], pCur, cb, PAL.GOLD, 2);
      drawClippedLine3D([b.x, b.y, b.z], pCur, cb, '#ffffff', 1);
    }
  }

  // 4) 패턴 B: ORBITAL LOCK-ON (3D 구체 폭발 경계 교차 링 + 수축 카운트다운 링)
  for (let i = 0; i < bossBombZones.length; i++) {
    const z = bossBombZones[i];
    if (z.detonated) continue;
    const remRatio = Math.max(0.04, Math.min(1.0, z.timer / z.maxTimer));
    const urgent = (remRatio < 0.35);
    const outerCol = urgent ? (fastBlink ? '#ffffff' : PAL.CRIMSON) : (medBlink ? PAL.CRIMSON : PAL.ORANGE);
    // 실제 폭발 범위 외곽 3D 교차 링 (수평 + 수직)
    drawRing3D(z.x, z.y, z.z, z.r, 8, 'XZ', cb, outerCol, urgent ? 2 : 1);
    drawRing3D(z.x, z.y, z.z, z.r, 8, 'XY', cb, PAL.ORANGE, 1);
    // 중심을 향해 수축하는 타이밍 링
    drawRing3D(z.x, z.y, z.z, z.r * remRatio, 8, 'XZ', cb, urgent ? '#ffffff' : PAL.GOLD, 2);
    // 중심 십자 마커
    const zp = projectWorldPt(z.x, z.y, z.z, cb);
    if (zp && zp.z > 4) {
      const cx = Math.round(zp.x), cy = Math.round(zp.y);
      ctx.fillStyle = urgent ? '#ffffff' : PAL.GOLD;
      ctx.fillRect(cx - 3, cy, 7, 1);
      ctx.fillRect(cx, cy - 3, 1, 7);
    }
  }

  // 5) 패턴 C: SKY RING (고도층 이중 8각 경고 링 -> 16각 고출력 확장 에너지 링)
  for (let i = 0; i < bossSkyRings.length; i++) {
    const rg = bossSkyRings[i];
    if (!rg.active) {
      const warnCol = fastBlink ? PAL.CRIMSON : PAL.GOLD;
      drawRing3D(rg.x, rg.y, rg.z, 55.0, 8, 'XZ', cb, warnCol, 2);
      drawRing3D(rg.x, rg.y, rg.z, 125.0, 8, 'XZ', cb, PAL.ORANGE, 1);
      // 위험 고도대 두께(±bandH) 4방향 세로 기둥
      for (let k = 0; k < 4; k++) {
        const a = k * (Math.PI * 0.5) + simTime * 0.4;
        const px1 = rg.x + Math.cos(a) * 55.0;
        const pz1 = rg.z + Math.sin(a) * 55.0;
        drawClippedLine3D([px1, rg.y - rg.bandH, pz1], [px1, rg.y + rg.bandH, pz1], cb, '#ffffff', 1);
      }
    } else {
      drawRing3D(rg.x, rg.y, rg.z, rg.r, 14, 'XZ', cb, PAL.CRIMSON, 3);
      drawRing3D(rg.x, rg.y, rg.z, rg.r, 14, 'XZ', cb, fastBlink ? '#ffffff' : PAL.GOLD, 1);
      drawRing3D(rg.x, rg.y + rg.bandH * 0.5, rg.z, rg.r, 12, 'XZ', cb, PAL.ORANGE, 1);
      drawRing3D(rg.x, rg.y - rg.bandH * 0.5, rg.z, rg.r, 12, 'XZ', cb, PAL.ORANGE, 1);
    }
  }

  // 6) 플레이어가 텔레그래프 위험 범위 내부에 있을 때 화면 네 모서리 점멸 경고 브래킷
  if (bossPlayerInDanger && fastBlink) {
    ctx.fillStyle = PAL.CRIMSON;
    // 좌상 / 우상 / 좌하 / 우하 L자 브래킷
    ctx.fillRect(3, 3, 14, 2); ctx.fillRect(3, 3, 2, 12);
    ctx.fillRect(LCD_W - 17, 3, 14, 2); ctx.fillRect(LCD_W - 5, 3, 2, 12);
    ctx.fillRect(3, LCD_H - 5, 14, 2); ctx.fillRect(3, LCD_H - 15, 2, 12);
    ctx.fillRect(LCD_W - 17, LCD_H - 5, 14, 2); ctx.fillRect(LCD_W - 5, LCD_H - 15, 2, 12);
  }
}


function drawSpiderManSprite(cb, totalSpeed) {
  const drawPx = px + (apexActive ? apexPlayerDrawOff.x : 0.0);
  const drawPy = py + (apexActive ? apexPlayerDrawOff.y : 0.0);
  const drawPz = pz + (apexActive ? apexPlayerDrawOff.z : 0.0);
  const centerPt = projectWorldPt(drawPx, drawPy, drawPz, cb);
  if (!centerPt) return null;

  let poseKey = 'DIVE';
  let spinThisPose = false;
  const isHeroPoseCut = (openingPhase === 'DROP_INTRO' && openingPoseMode === 'POSE');
  const apexDef = apexActive ? APEX_CUT_DEFS[apexId] : null;
  if (openingPhase === 'ROOF_WAIT') {
    poseKey = 'ROOF_IDLE';
  } else if (openingPhase === 'ROOF_WALK') {
    poseKey = (openingPoseMode === 'IDLE') ? 'ROOF_IDLE' : ((openingPoseMode === 'WALK_B') ? 'ROOF_WALK_B' : 'ROOF_WALK_A');
  } else if (openingPhase === 'DROP_INTRO') {
    if (openingPoseMode === 'SLIP') poseKey = 'GROUND_JUMP';
    else if (openingPoseMode === 'FLIP') poseKey = 'FLIP';
    else if (openingPoseMode === 'POSE') poseKey = 'DROP_HERO';
    else poseKey = 'DIVE';
  } else if (apexDef) {
    if (apexTimer < APEX_ACT2_DUR) {
      poseKey = apexDef.pose1;
      spinThisPose = false;
    } else {
      poseKey = apexDef.pose2;
      spinThisPose = !!apexDef.spin2;
    }
  } else if (strikeMode === 3) {
    const cm = CARTOON_MOTIONS[strikeMotionIdx];
    poseKey = cm.pose;
    spinThisPose = cm.spin && strikePhase === 'RUSH';
  } else if (strikeMode === 1) {
    poseKey = 'DIVE';
  } else if (isSwinging) {
    poseKey = anchorSide >= 0 ? 'SWING_R' : 'SWING_L';
  } else if (doingFlip || strikeTumbleTimer > 0) {
    poseKey = 'FLIP';
  } else if (isGliding) {
    poseKey = 'GLIDE';
  } else if (py <= 4.5) {
    poseKey = 'GROUND_JUMP';
  } else if (isDiving || vy < -10) {
    poseKey = 'DIVE';
  } else {
    poseKey = 'GROUND_JUMP';
  }

  for (let i = 0; i < afterimages.length; i++) {
    const ai = afterimages[i];
    const ap = projectWorldPt(ai.x, ai.y, ai.z, cb);
    if (!ap) continue;
    const aPose = spideySprites[ai.poseKey] || spideySprites.FLIP;
    const ghostCanvas = ai.tone === 0 ? aPose.cyanGhost : aPose.goldGhost;
    const maxGhostH = isHeroPoseCut ? 64 : (apexActive ? 58 : 46);
    const sc = Math.max(12, Math.min(maxGhostH, (4.2 / ap.z) * cb.d)) / ghostCanvas.height;
    const dw = Math.round(ghostCanvas.width * sc), dh = Math.round(ghostCanvas.height * sc);
    ctx.save();
    ctx.translate(Math.round(ap.x), Math.round(ap.y));
    ctx.rotate(ai.rot);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(ghostCanvas, (-dw * 0.5) | 0, (-dh * 0.5) | 0, dw, dh);
    ctx.restore();
  }

  const pose = spideySprites[poseKey] || spideySprites.DIVE;
  const spr = pose.canvas;
  const isApexCloseUp = (apexActive && apexTimer < APEX_ACT1_DUR && apexId !== 'elastic');
  const maxSprH = isHeroPoseCut ? 72 : (isApexCloseUp ? 76 : (apexActive ? 64 : 54));
  const screenH = Math.max(14, Math.min(maxSprH, (4.2 / centerPt.z) * cb.d));
  const scale = screenH / spr.height;
  const drawW = Math.round(spr.width * scale), drawH = Math.round(spr.height * scale);
  const cx = Math.round(centerPt.x), cy = Math.round(centerPt.y);

  // [전격 오라] 회전하는 2색 점선 PC-98 오라 링 (공용 isSwingAuraActive 기준 통일)
  const lvAura = getLv('swing_aura');
  if (lvAura > 0 && isSwingAuraActive(totalSpeed, isSwinging)) {
    const overcharge = lvAura >= 3 && totalSpeed >= 95.0;
    const auraScreenR = Math.round(screenH * (0.82 + lvAura * 0.16) + Math.sin(simTime * 22) * 2.0);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(simTime * (overcharge ? 8.5 : 5.5));
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = PAL.INDIGO_OUTLINE;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, auraScreenR, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = overcharge
      ? ((Math.floor(simTime * 24) & 1) ? PAL.GOLD : '#ffffff')
      : ((Math.floor(simTime * 20) & 1) ? PAL.NEON_CYAN : PAL.GOLD);
    ctx.lineWidth = overcharge ? 2.0 : 1.5;
    ctx.beginPath(); ctx.arc(0, 0, auraScreenR, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // Visual Energy Aura for Active STRIKE Cases, Just Chain Parry, or Post-Strike Grace
  if (strikeMode !== 0) {
    if (strikeMode === 3 && strikePhase === 'HANG_SHOOT') {
      ctx.strokeStyle = (Math.floor(simTime * 28) & 1) ? PAL.GOLD : PAL.NEON_PINK;
      ctx.lineWidth = 1;
      for (let k = 0; k < 10; k++) {
        const ang = (k / 10) * Math.PI * 2 + simTime * 4.0;
        const rIn = screenH * 0.55;
        const rOut = screenH * 0.98 + ((k & 1) ? 6 : 0);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * rIn, cy + Math.sin(ang) * rIn);
        ctx.lineTo(cx + Math.cos(ang) * rOut, cy + Math.sin(ang) * rOut);
        ctx.stroke();
      }
    } else {
      const auraR = Math.round(screenH * 0.65 + Math.sin(simTime * 34) * 2.5);
      ctx.strokeStyle = justChainParryTimer > 0 ? PAL.GOLD : (strikeMode === 1 ? PAL.ORANGE : (isChainRush ? PAL.NEON_PINK : PAL.NEON_CYAN));
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, auraR, 0, Math.PI * 2); ctx.stroke();
    }
  } else if (justChainParryTimer > 0 && !apexActive) {
    const shieldR = Math.round(screenH * 0.66);
    ctx.strokeStyle = (Math.floor(simTime * 30) & 1) ? PAL.GOLD : PAL.NEON_CYAN;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, shieldR, 0, Math.PI * 2); ctx.stroke();
  } else if (strikeGraceTimer > 0 && !apexActive) {
    const shieldR = Math.round(screenH * 0.62);
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = PAL.NEON_CYAN;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(cx, cy, shieldR, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  } else if (inPerfectWindow) {
    const flashR = Math.round(screenH * 0.62 + Math.sin(simTime * 35) * 2.5);
    ctx.strokeStyle = (Math.floor(simTime * 24) & 1) ? PAL.NEON_CYAN : PAL.GOLD;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, flashR, 0, Math.PI * 2); ctx.stroke();
  }

  if (!apexActive && invulnTimer > 0 && (Math.floor(simTime * 18) & 1) === 0) {
    return { x: cx, y: cy, x1: null, y1: null, x2: null, y2: null };
  }

  if (!isApexFreezePhase() && (doingFlip || spinThisPose)) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(flipAngle);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(spr, (-drawW * 0.5) | 0, (-drawH * 0.5) | 0, drawW, drawH);
    ctx.restore();
    return { x: cx, y: cy, x1: null, y1: null, x2: null, y2: null };
  }

  ctx.drawImage(spr, (cx - drawW * 0.5) | 0, (cy - drawH * 0.5) | 0, drawW, drawH);
  return {
    x: Math.round((cx - drawW * 0.5) + pose.handX * scale),
    y: Math.round((cy - drawH * 0.5) + pose.handY * scale),
    x2: pose.hand2X !== undefined ? Math.round((cx - drawW * 0.5) + pose.hand2X * scale) : null,
    y2: pose.hand2Y !== undefined ? Math.round((cx - drawH * 0.5) + pose.hand2Y * scale) : null,
    x1: pose.hand1X !== undefined ? Math.round((cx - drawW * 0.5) + pose.hand1X * scale) : null,
    y1: pose.hand1Y !== undefined ? Math.round((cy - drawH * 0.5) + pose.hand1Y * scale) : null
  };
}


function renderWorld3D(isFrozen, nearbyBlocks, nearbyBuildings, nearbyClouds, nearbyParks, turnInput, forwardInput) {
  const horizSpeed = Math.hypot(vx, vz);
  const totalSpeed = Math.hypot(horizSpeed, vy);

  const totalShake = shakeMag + (groundSkimIntensity > 0.55 ? groundSkimIntensity * 1.4 : 0) + (wallSkimIntensity > 0.6 ? wallSkimIntensity * 1.2 : 0);
  const sx = (!isFrozen && totalShake > 0.2) ? (Math.random() - 0.5) * totalShake * 2 : 0;
  const sy = (!isFrozen && totalShake > 0.2) ? (Math.random() - 0.5) * totalShake * 2 : 0;

  const camPos = getCameraPos();
  const cb = makeCamBasis(camPos, camLagYaw, camPitch, camRoll, fovD, sx, sy);

  const stageCfg = STAGE_CONFIGS[currentStage];
  const stagePat = STAGE_PATTERNS[currentStage];
  const panoCanvas = panoramaCanvases[currentStage];
  const cloudSpr = cloud2Sprites[currentStage];

  // =======================================================================
  // 3. RENDER 320x170 PC-98 VINTAGE DITHERED FRAME
  // =======================================================================
  ctx.imageSmoothingEnabled = false;

  ctx.save();
  ctx.translate(LCD_W * 0.5 + sx, LCD_H * 0.5 + sy);
  ctx.rotate(-camRoll);

  const horizonY = Math.round(Math.tan(camPitch) * fovD);
  const panoW = panoCanvas.width;
  const panoH = panoCanvas.height;

  ctx.fillStyle = stageCfg.skyTop;
  ctx.fillRect(-360, horizonY - 980, 720, 980 - panoH + 2);

  let normYaw = (camLagYaw / (Math.PI * 2)) % 1.0;
  if (normYaw < 0) normYaw += 1.0;
  const scrollX = Math.round(normYaw * panoW);
  const panoTopY = horizonY - panoH;

  let remW = 520, dstX = -260;
  let srcX = (scrollX - 260 + panoW * 2) % panoW;
  while (remW > 0) {
    const chunk = Math.min(remW, panoW - srcX);
    ctx.drawImage(panoCanvas, srcX, 0, chunk, panoH, dstX, panoTopY, chunk, panoH);
    dstX += chunk;
    remW -= chunk;
    srcX = 0;
  }

  ctx.fillStyle = stagePat.asphaltFar;
  ctx.fillRect(-360, horizonY, 720, 26);
  ctx.fillStyle = stagePat.asphalt;
  ctx.fillRect(-360, horizonY + 22, 720, 980);
  ctx.restore();

  const halfB = BLOCK_SIZE * 0.5;
  const padHalf = halfB - 23.0;
  for (const bl of nearbyBlocks) {
    const d2 = (bl.cx - camPos.cx) ** 2 + (bl.cz - camPos.cz) ** 2;
    if (d2 > 540 * 540) continue;

    drawClippedPoly3D([
      [bl.cx - padHalf, 0.04, bl.cz - padHalf],
      [bl.cx + padHalf, 0.04, bl.cz - padHalf],
      [bl.cx + padHalf, 0.04, bl.cz + padHalf],
      [bl.cx - padHalf, 0.04, bl.cz + padHalf]
    ], cb, stagePat.sidewalk, stageCfg.sidewalkEdge);

    const pk = bl.park;
    const pw = pk.w * 0.5, pd = pk.d * 0.5;
    drawClippedPoly3D([
      [pk.x - pw, 0.07, pk.z - pd], [pk.x + pw, 0.07, pk.z - pd],
      [pk.x + pw, 0.07, pk.z + pd], [pk.x - pw, 0.07, pk.z + pd]
    ], cb, stagePat.park, stageCfg.parkEdge);
    drawClippedPoly3D([
      [pk.x - pw * 0.65, 0.08, pk.z - pd * 0.65], [pk.x + pw * 0.65, 0.08, pk.z - pd * 0.65],
      [pk.x + pw * 0.65, 0.08, pk.z + pd * 0.65], [pk.x - pw * 0.65, 0.08, pk.z + pd * 0.65]
    ], cb, stagePat.parkHi);

    if (d2 < 390 * 390) {
      const roadX = bl.cx + halfB;
      const roadZ = bl.cz + halfB;
      for (let s = -90; s <= 90; s += 36) {
        drawClippedLine3D([roadX, 0.09, bl.cz + s], [roadX, 0.09, bl.cz + s + 18], cb, stageCfg.laneCol, 1);
        drawClippedLine3D([bl.cx + s, 0.09, roadZ], [bl.cx + s + 18, 0.09, roadZ], cb, stageCfg.laneCol, 1);
      }
      if (d2 < 290 * 290) {
        for (let s = -14; s <= 14; s += 7) {
          drawClippedLine3D([roadX + s, 0.1, roadZ - 21], [roadX + s, 0.1, roadZ - 14], cb, stageCfg.crossCol, 1);
          drawClippedLine3D([roadX - 21, 0.1, roadZ + s], [roadX - 14, 0.1, roadZ + s], cb, stageCfg.crossCol, 1);
        }
      }
    }
  }

  if (shadowsOn) {
    const shSX = stageCfg.shadowStretchX;
    const shSZ = stageCfg.shadowStretchZ;
    for (const b of nearbyBuildings) {
      const d2 = (b.bx - camPos.cx) ** 2 + (b.bz - camPos.cz) ** 2;
      if (d2 > 460 * 460) continue;
      const hw = b.bw * 0.5, hd = b.bd * 0.5;
      const x0 = b.bx - hw, x1 = b.bx + hw, z0 = b.bz - hd, z1 = b.bz + hd;
      const shX = Math.min(180, b.bh * shSX), shZ = Math.min(140, b.bh * shSZ);
      drawClippedPoly3D([
        [x0, 0.14, z0], [x1, 0.14, z0],
        [x1 + shX, 0.14, z0 + shZ], [x1 + shX, 0.14, z1 + shZ],
        [x0 + shX, 0.14, z1 + shZ], [x0, 0.14, z1]
      ], cb, stagePat.shadow);
    }

    if (py < 180) {
      const nearF = Math.max(0.2, 1.0 - py / 180.0);
      const rad = 1.6 + nearF * 2.8;
      const spOct = [];
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        spOct.push([px + Math.cos(a) * rad, 0.18, pz + Math.sin(a) * rad]);
      }
      drawClippedPoly3D(spOct, cb, stagePat.shadow);
    }
  }

  for (const bl of nearbyBlocks) {
    const roadX = bl.cx + halfB;
    const roadZ = bl.cz + halfB;
    const t1z = bl.cz - halfB + ((simTime * 28.0 + Math.abs(bl.gx * 53 + bl.gz * 37)) % BLOCK_SIZE);
    const tp1 = projectWorldPt(roadX + 8.0, 1.8, t1z, cb);
    if (tp1 && tp1.z > 8 && tp1.z < 260) {
      const s = Math.max(0.5, Math.min(2.2, (5.5 * fovD) / (tp1.z * 8)));
      const tw = (taxiSprite.width * s) | 0, th = (taxiSprite.height * s) | 0;
      if (tw >= 3) ctx.drawImage(taxiSprite, (tp1.x - tw * 0.5) | 0, (tp1.y - th * 0.5) | 0, tw, th);
    }
    const t2x = bl.cx - halfB + ((simTime * 24.0 + Math.abs(bl.gx * 29 + bl.gz * 71)) % BLOCK_SIZE);
    const tp2 = projectWorldPt(t2x, 1.8, roadZ - 8.0, cb);
    if (tp2 && tp2.z > 8 && tp2.z < 260) {
      const s = Math.max(0.5, Math.min(2.2, (5.5 * fovD) / (tp2.z * 8)));
      const tw = (taxiSprite.width * s) | 0, th = (taxiSprite.height * s) | 0;
      if (tw >= 3) ctx.drawImage(taxiSprite, (tp2.x - tw * 0.5) | 0, (tp2.y - th * 0.5) | 0, tw, th);
    }
  }

  const renderItems = [];
  for (const b of nearbyBuildings) {
    const d2 = (b.bx - camPos.cx) ** 2 + (b.bz - camPos.cz) ** 2;
    if (d2 <= RENDER_DIST * RENDER_DIST) renderItems.push({ kind: 'b', obj: b, d2 });
  }
  for (const c of nearbyClouds) {
    const d2 = (c.x - camPos.cx) ** 2 + (c.y - camPos.cy) ** 2 + (c.z - camPos.cz) ** 2;
    if (d2 <= (RENDER_DIST * 1.15) ** 2) renderItems.push({ kind: 'c', obj: c, d2 });
  }
  for (const pk of nearbyParks) {
    const d2 = (pk.x - camPos.cx) ** 2 + (pk.z - camPos.cz) ** 2;
    if (d2 <= 320 * 320) renderItems.push({ kind: 't', obj: pk, d2 });
  }
  for (const e of enemies) {
    const d2 = (e.x - camPos.cx) ** 2 + (e.y - camPos.cy) ** 2 + (e.z - camPos.cz) ** 2;
    if (d2 <= (RENDER_DIST * 1.15) ** 2) renderItems.push({ kind: 'e', obj: e, d2 });
  }
  renderItems.sort((a, b) => b.d2 - a.d2);

  for (const item of renderItems) {
    if (item.kind === 'b') {
      drawPC98Building(item.obj, item.d2, cb, stageCfg, stagePat);
    } else if (item.kind === 'e') {
      drawEnemy3D(item.obj, cb);
    } else if (item.kind === 'c') {
      const c = item.obj;
      const cp = projectWorldPt(c.x, c.y, c.z, cb);
      if (cp && cp.z > 20) {
        const rawW = (cloudSpr.width * 1.15 * c.scale * fovD) / cp.z;
        const drawW = Math.max(18, Math.min(54, rawW)) | 0;
        const drawH = Math.max(7, Math.round(drawW * (cloudSpr.height / cloudSpr.width)));
        ctx.drawImage(cloudSpr, (cp.x - drawW * 0.5) | 0, (cp.y - drawH * 0.5) | 0, drawW, drawH);
      }
    } else {
      const pk = item.obj;
      const treeOffs = [[-13, -12], [12, -10], [-10, 12], [13, 13]];
      for (const [ox, oz] of treeOffs) {
        const tp = projectWorldPt(pk.x + ox, 5.5, pk.z + oz, cb);
        if (tp && tp.z > 8) {
          const s = Math.max(0.35, Math.min(1.6, (9.5 * fovD) / (tp.z * 20)));
          const tw = (treeSprite.width * s) | 0, th = (treeSprite.height * s) | 0;
          if (tw >= 4) ctx.drawImage(treeSprite, (tp.x - tw * 0.5) | 0, (tp.y - th * 0.5) | 0, tw, th);
        }
      }
    }
  }

  for (const sw of shockwaves) {
    const sp = projectWorldPt(sw.x, sw.y, sw.z, cb);
    if (sp && sp.z > 3) {
      const sr = Math.max(4, Math.min(145, (sw.r / sp.z) * cb.d));
      ctx.strokeStyle = PAL.INDIGO_OUTLINE;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(sp.x, sp.y, sr, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = sw.col;
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(sp.x, sp.y, sr, 0, Math.PI * 2); ctx.stroke();
    }
  }
  for (const bolt of lightningBolts) {
    drawLightning3D(bolt, cb);
  }
  drawBossHazards3D(cb);

  for (const pr of projectiles) {
    const pp = projectWorldPt(pr.x, pr.y, pr.z, cb);
    if (pp && pp.z > 3) {
      const r = Math.max(2, Math.min(7, (2.8 / pp.z) * cb.d));
      ctx.fillStyle = PAL.INDIGO_OUTLINE;
      ctx.beginPath(); ctx.arc(pp.x, pp.y, r + 1.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = pr.col;
      ctx.beginPath(); ctx.arc(pp.x, pp.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect((pp.x - 1) | 0, (pp.y - 1) | 0, 2, 2);
    }
  }

  for (const s of sparks) {
    const sp = projectWorldPt(s.x, s.y, s.z, cb);
    if (sp) { ctx.fillStyle = s.col; ctx.fillRect(sp.x | 0, sp.y | 0, 2, 2); }
  }

  // [Step 4] 5.0초 4-Act 깔끔한 90년대 애니메이션/스파이더버스식 3D 물리 연출 (다트판·원통·벽 0%)
  if (apexActive && apexSceneExtras) {
    const defA = APEX_CUT_DEFS[apexId];
    const accCol = defA ? defA.col : PAL.GOLD;
    const inAct1 = apexTimer < APEX_ACT1_DUR;
    const inAct2 = apexTimer >= APEX_ACT1_DUR && apexTimer < APEX_ACT2_DUR;
    const inFreeze = apexTimer < APEX_ACT2_DUR;
    const inAct3 = apexTimer >= APEX_ACT2_DUR && apexTimer < APEX_ACT3_DUR;
    const act3Elapsed = Math.max(0.0, apexTimer - APEX_ACT2_DUR);
    const act3Dur = Math.max(0.05, APEX_ACT3_DUR - APEX_ACT2_DUR);
    const p3 = inAct3 ? Math.max(0.0, Math.min(1.0, act3Elapsed / act3Dur)) : (apexTimer >= APEX_ACT3_DUR ? 1.0 : 0.0);
    const p4Fade = apexTimer >= APEX_ACT3_DUR ? Math.max(0.0, 1.0 - (apexTimer - APEX_ACT3_DUR) / 0.42) : 1.0;

    // 1) 분할선 없는 깔끔한 3D 수평 충격파 링 (초중력 슈트 바닥 기압파 전용)
    const drawCleanRing3D = (cx, cy, cz, rad, segs, col, width) => {
      const pts = [];
      for (let i = 0; i <= segs; i++) {
        const ang = (i / segs) * Math.PI * 2;
        pts.push(projectWorldPt(cx + Math.cos(ang) * rad, cy, cz + Math.sin(ang) * rad, cb));
      }
      ctx.lineJoin = 'round';
      for (let pass = 0; pass < 2; pass++) {
        ctx.strokeStyle = pass === 0 ? PAL.INDIGO_OUTLINE : col;
        ctx.lineWidth = pass === 0 ? (width + 2.0) : width;
        ctx.beginPath();
        let drawing = false;
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i];
          if (!p) { drawing = false; continue; }
          if (!drawing) { ctx.moveTo(p.x, p.y); drawing = true; }
          else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }
    };

    // 2) 원근 테이퍼 3중 코어 3D 빔 (기둥 / 일섬 / 도탄 궤적 / 거미줄 장력선 공용)
    const draw3DThickBeam = (a, b, worldW, col, coreCol) => {
      let ca = worldToCam(a.x, a.y, a.z, cb);
      let cbPt = worldToCam(b.x, b.y, b.z, cb);
      if (ca.z < NEAR_Z && cbPt.z < NEAR_Z) return;
      if (ca.z < NEAR_Z) {
        const t = (NEAR_Z - ca.z) / (cbPt.z - ca.z);
        ca = { x: ca.x + (cbPt.x - ca.x) * t, y: ca.y + (cbPt.y - ca.y) * t, z: NEAR_Z };
      } else if (cbPt.z < NEAR_Z) {
        const t = (NEAR_Z - cbPt.z) / (ca.z - cbPt.z);
        cbPt = { x: cbPt.x + (ca.x - cbPt.x) * t, y: cbPt.y + (ca.y - cbPt.y) * t, z: NEAR_Z };
      }
      const pa = projectCamPt(ca, cb);
      const pb = projectCamPt(cbPt, cb);
      const dx = pb.x - pa.x, dy = pb.y - pa.y;
      const len = Math.hypot(dx, dy);
      if (len < 0.5) return;
      const nx = -dy / len, ny = dx / len;
      const hwA = Math.max(1.2, Math.min(20.0, (worldW * 0.5 / Math.max(4.5, pa.z)) * cb.d));
      const hwB = Math.max(1.2, Math.min(20.0, (worldW * 0.5 / Math.max(4.5, pb.z)) * cb.d));
      const fillStrip = (padA, padB, fillC) => {
        ctx.fillStyle = fillC;
        ctx.beginPath();
        ctx.moveTo(pa.x + nx * padA, pa.y + ny * padA);
        ctx.lineTo(pb.x + nx * padB, pb.y + ny * padB);
        ctx.lineTo(pb.x - nx * padB, pb.y - ny * padB);
        ctx.lineTo(pa.x - nx * padA, pa.y - ny * padA);
        ctx.closePath();
        ctx.fill();
      };
      fillStrip(hwA + 1.5, hwB + 1.5, PAL.INDIGO_OUTLINE);
      fillStrip(hwA, hwB, col);
      if (coreCol) {
        fillStrip(Math.max(0.7, hwA * 0.42), Math.max(0.7, hwB * 0.42), coreCol);
      }
    };

    // 3) 타격 지점 날카로운 십자(+) / 팔각 임팩트 섬광 (애니메이션식 임팩트 플래시)
    const drawCrossFlash = (pt, sizePx, col, diagonal) => {
      const sp = projectWorldPt(pt.x, pt.y, pt.z, cb);
      if (!sp || sp.z < 2.0 || sizePx < 3) return;
      const drawDiamond = (ang, len, wid, fillC) => {
        const ca = Math.cos(ang), sa = Math.sin(ang);
        const px1 = -sa * wid, py1 = ca * wid;
        ctx.fillStyle = fillC;
        ctx.beginPath();
        ctx.moveTo(sp.x + ca * len, sp.y + sa * len);
        ctx.lineTo(sp.x + px1, sp.y + py1);
        ctx.lineTo(sp.x - ca * len, sp.y - sa * len);
        ctx.lineTo(sp.x - px1, sp.y - py1);
        ctx.closePath();
        ctx.fill();
      };
      const baseAng = diagonal ? (Math.PI * 0.25) : 0.0;
      const hLen = sizePx;
      const vLen = sizePx * 0.72;
      const wMain = Math.max(2.0, sizePx * 0.14);
      drawDiamond(baseAng, hLen + 3, wMain + 1.6, PAL.INDIGO_OUTLINE);
      drawDiamond(baseAng + Math.PI * 0.5, vLen + 3, wMain + 1.6, PAL.INDIGO_OUTLINE);
      drawDiamond(baseAng, hLen, wMain, col);
      drawDiamond(baseAng + Math.PI * 0.5, vLen, wMain, col);
      drawDiamond(baseAng, hLen * 0.72, wMain * 0.45, '#ffffff');
      drawDiamond(baseAng + Math.PI * 0.5, vLen * 0.72, wMain * 0.45, '#ffffff');
    };

    // 4) 팽팽하게 진동하는 3D 탄성 거미줄 스트랜드 (#6 탄성 반발 전용)
    const drawElasticStrand3D = (a, b, offY, vibAmp, vibPhase, wid, col, coreCol) => {
      const segs = 6;
      let prev = { x: a.x, y: a.y + offY, z: a.z };
      for (let i = 1; i <= segs; i++) {
        const t = i / segs;
        const env = Math.sin(t * Math.PI); // 양 끝 고정, 중앙 최대 진동
        const vib = vibAmp > 0.01 ? Math.sin(vibPhase + i * 2.4) * vibAmp * env : 0.0;
        const cur = {
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t + offY + vib,
          z: a.z + (b.z - a.z) * t
        };
        draw3DThickBeam(prev, cur, wid, col, coreCol);
        prev = cur;
      }
    };

    // 5) 결정론적 3D 물리 파편 블록 비산
    const draw3DDebrisChunks = (origin, seed, count, prog, spreadR, riseH, colMain, colHi, dirBias) => {
      if (prog <= 0.01 || prog >= 1.0) return;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + Math.sin(seed + i * 2.1) * 0.35;
        const spd = 0.55 + ((i * 37) % 10) * 0.08;
        const dist = prog * spreadR * spd;
        const lift = (Math.sin(prog * Math.PI) * riseH + (i % 3) * 3.0) * (0.65 + (i % 4) * 0.15);
        const bx = dirBias ? (dirBias.x * dist * 0.85) : 0.0;
        const bz = dirBias ? (dirBias.z * dist * 0.85) : 0.0;
        const wx = origin.x + Math.cos(a) * dist + bx;
        const wy = Math.max(2.0, origin.y + lift - prog * prog * 14.0);
        const wz = origin.z + Math.sin(a) * dist + bz;
        const sp = projectWorldPt(wx, wy, wz, cb);
        if (!sp || sp.z < 3.0) continue;
        const sz = Math.max(2, Math.min(7, ((2.2 + (i % 3) * 0.9) / sp.z) * cb.d)) * (1.0 - prog * 0.35);
        const s = Math.max(2, sz | 0);
        ctx.fillStyle = PAL.INDIGO_OUTLINE;
        ctx.fillRect((sp.x - s * 0.5 - 1) | 0, (sp.y - s * 0.5 - 1) | 0, s + 2, s + 2);
        ctx.fillStyle = (i & 1) ? colHi : colMain;
        ctx.fillRect((sp.x - s * 0.5) | 0, (sp.y - s * 0.5) | 0, s, s);
      }
    };

    const drawDummyNode = (pt, col, big) => {
      const sp = projectWorldPt(pt.x, pt.y, pt.z, cb);
      if (!sp || sp.z < 2.0) return;
      const r = Math.max(3, Math.min(big ? 13 : 9, ((big ? 4.0 : 2.8) / sp.z) * cb.d));
      ctx.strokeStyle = PAL.INDIGO_OUTLINE; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.fillRect((sp.x - 1) | 0, (sp.y - 1) | 0, 2, 2);
    };

    // #6 탄성 반발 공중 적 측 타깃 실루엣 (실전/테스트 모두 탄성줄 반대편 적의 반발·충돌 시각화)
    const drawElasticEnemyNode = (pt, tensionCol) => {
      const sp = projectWorldPt(pt.x, pt.y, pt.z, cb);
      if (!sp || sp.z < 2.0) return;
      const r = Math.max(5, Math.min(18, (4.8 / sp.z) * cb.d));
      // 짙은 외곽 다이아몬드 적 코어
      ctx.fillStyle = PAL.INDIGO_OUTLINE;
      ctx.beginPath();
      ctx.moveTo(sp.x, sp.y - r - 2); ctx.lineTo(sp.x + r + 2, sp.y);
      ctx.lineTo(sp.x, sp.y + r + 2); ctx.lineTo(sp.x - r - 2, sp.y);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = PAL.CRIMSON;
      ctx.beginPath();
      ctx.moveTo(sp.x, sp.y - r); ctx.lineTo(sp.x + r, sp.y);
      ctx.lineTo(sp.x, sp.y + r); ctx.lineTo(sp.x - r, sp.y);
      ctx.closePath(); ctx.fill();
      // 탄성 거미줄 포박 X-크로스 띠
      ctx.strokeStyle = tensionCol; ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(sp.x - r * 0.72, sp.y - r * 0.72); ctx.lineTo(sp.x + r * 0.72, sp.y + r * 0.72);
      ctx.moveTo(sp.x + r * 0.72, sp.y - r * 0.72); ctx.lineTo(sp.x - r * 0.72, sp.y + r * 0.72);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect((sp.x - 2) | 0, (sp.y - 2) | 0, 4, 4);
    };

    // 대각선 화면 전체 일섬(Flash Cut) 헬퍼 (#2 오버드라이브 2단계 X-일섬용)
    const drawScreenFlashCut = (cutH, yLeft, yRight, col) => {
      if (cutH <= 0.6) return;
      ctx.fillStyle = PAL.INDIGO_OUTLINE;
      ctx.beginPath();
      ctx.moveTo(0, yLeft - cutH - 2); ctx.lineTo(LCD_W, yRight - cutH - 2);
      ctx.lineTo(LCD_W, yRight + cutH + 2); ctx.lineTo(0, yLeft + cutH + 2);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, yLeft - cutH); ctx.lineTo(LCD_W, yRight - cutH);
      ctx.lineTo(LCD_W, yRight + cutH); ctx.lineTo(0, yLeft + cutH);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, yLeft - cutH * 0.45); ctx.lineTo(LCD_W, yRight - cutH * 0.45);
      ctx.lineTo(LCD_W, yRight + cutH * 0.45); ctx.lineTo(0, yLeft + cutH * 0.45);
      ctx.closePath(); ctx.fill();
    };

    if (apexId === 'heavy_suit') {
      // #1 초중력 슈트: Act 1~2 수직 낙하 기압선 + Act 3 0.28s 압착 -> 거대 수직 대기 압착 기둥 + 무지 링 3겹 + 파편 18개
      const tp = apexSceneExtras.targetPt || { x: px, y: Math.max(6.0, py - 8.0), z: pz };
      if (inFreeze) {
        draw3DThickBeam({ x: px, y: apexSceneExtras.dropTopY || (py + 42.0), z: pz }, { x: px, y: py + 2.0, z: pz }, inAct1 ? 2.6 : 4.0, PAL.ORANGE, '#ffffff');
        drawCleanRing3D(tp.x, tp.y, tp.z, inAct1 ? 9.0 : 12.0, 20, PAL.ORANGE, 2.2);
      } else if (inAct3 && p3 < 0.19) {
        // 1단계: 대기 압착 수축 (0.28s)
        const cProg = p3 / 0.19;
        draw3DThickBeam({ x: tp.x, y: tp.y, z: tp.z }, { x: tp.x, y: tp.y + 180.0, z: tp.z }, 5.5 - cProg * 2.5, PAL.GOLD, '#ffffff');
        drawCleanRing3D(tp.x, tp.y, tp.z, 26.0 * (1.0 - cProg * 0.72), 20, '#ffffff', 2.4);
      } else if (p4Fade > 0.05) {
        // 2단계: 거대 수직 대기 압착 기둥 대폭발 + 3겹 깔끔한 수평 기압 링 + 파편 18개
        const expP = Math.max(0.0, Math.min(1.0, (p3 - 0.19) / 0.81));
        const wScale = (1.0 - expP * 0.28) * p4Fade;
        draw3DThickBeam({ x: tp.x, y: Math.max(1.0, tp.y - 4.0), z: tp.z }, { x: tp.x, y: tp.y + 250.0, z: tp.z }, 17.5 * wScale, PAL.ORANGE, '#ffffff');
        for (let ri = 0; ri < 3; ri++) {
          const rp = Math.max(0.0, Math.min(1.0, expP * 1.28 - ri * 0.15));
          if (rp <= 0.01) continue;
          const rad = 12.0 + rp * (84.0 + ri * 22.0);
          const ry = tp.y + ri * 15.0 * rp;
          drawCleanRing3D(tp.x, ry, tp.z, rad, 22, ri === 0 ? '#ffffff' : (ri === 1 ? PAL.GOLD : PAL.ORANGE), ri === 0 ? 3.2 : 2.2);
        }
        if (inAct3) {
          drawCrossFlash(tp, Math.max(10, 58 * (1.0 - expP * 0.60)), PAL.ORANGE, false);
          draw3DDebrisChunks(tp, 17, 18, expP, 68.0, 30.0, PAL.ORANGE, PAL.GOLD, null);
        }
      }
      if (apexSceneExtras.isDummy && inAct2) drawDummyNode(tp, PAL.ORANGE, true);
    } else if (apexId === 'overdrive') {
      // #2 오버드라이브 (원통·링 0%): Act 1~2 7중 잔상 관통선 -> Act 3 2단계 교차 X-일섬(Flash Cut 1+2) + 6다발 번개 + 24줄 스피드라인
      const mSin = apexSceneExtras.mSin !== undefined ? apexSceneExtras.mSin : Math.sin(camYaw);
      const mCos = apexSceneExtras.mCos !== undefined ? apexSceneExtras.mCos : Math.cos(camYaw);
      const tp = apexSceneExtras.targetPt || { x: px + mSin * 12.0, y: py, z: pz + mCos * 12.0 };
      if (inFreeze) {
        draw3DThickBeam({ x: px - mSin * 28.0, y: py, z: pz - mCos * 28.0 }, tp, inAct1 ? 2.0 : 2.8, PAL.NEON_PINK, '#ffffff');
      } else if (inAct3) {
        const slashW = Math.max(1.8, 11.5 * (1.0 - p3 * 0.60));
        draw3DThickBeam({ x: px - mSin * 48.0, y: py, z: pz - mCos * 48.0 }, { x: tp.x + mSin * 32.0, y: tp.y, z: tp.z + mCos * 32.0 }, slashW, PAL.NEON_PINK, '#ffffff');
        // 1차 대각선 일섬 (p3: 0.00~0.55)
        const cutH1 = Math.max(0, 1.0 - p3 * 2.1) * 12.5;
        drawScreenFlashCut(cutH1, LCD_H * 0.58, LCD_H * 0.40, PAL.NEON_PINK);
        // 2차 반대 대각선 X-교차 일섬 (p3 >= 0.40)
        if (p3 >= 0.40) {
          const s2p = (p3 - 0.40) / 0.60;
          const cutH2 = Math.max(0, 1.0 - s2p * 1.65) * 14.0;
          drawScreenFlashCut(cutH2, LCD_H * 0.36, LCD_H * 0.62, PAL.NEON_CYAN);
          drawCrossFlash(tp, Math.max(10, 68 * (1.0 - s2p * 0.60)), PAL.GOLD, false);
          draw3DDebrisChunks(tp, 41, 18, s2p, 56.0, 20.0, PAL.NEON_CYAN, PAL.GOLD, { x: -mSin, z: -mCos });
        }
        drawCrossFlash(tp, Math.max(10, 62 * (1.0 - p3 * 0.55)), PAL.NEON_PINK, true);
        // 초고속 전방위 스피드라인 폭풍 (24줄)
        ctx.lineWidth = 1.2;
        for (let i = 0; i < 24; i++) {
          const ang = (i / 24) * Math.PI * 2 + p3 * 0.55;
          const rIn = 44 + ((i * 19) % 28);
          const rOut = rIn + 58 + ((i * 23) % 46);
          ctx.strokeStyle = (i % 3 === 0) ? '#ffffff' : ((i & 1) ? PAL.NEON_PINK : PAL.NEON_CYAN);
          ctx.beginPath();
          ctx.moveTo(LCD_W * 0.5 + Math.cos(ang) * rIn, LCD_H * 0.5 + Math.sin(ang) * rIn * 0.55);
          ctx.lineTo(LCD_W * 0.5 + Math.cos(ang) * rOut, LCD_H * 0.5 + Math.sin(ang) * rOut * 0.55);
          ctx.stroke();
        }
      }
      if (apexSceneExtras.isDummy && inAct2) drawDummyNode(tp, PAL.NEON_PINK, true);
    } else if (apexId === 'bungee_web') {
      // #3 고탄성 번지줄 (원뿔·막대·링 0%): Act 1~2 팽팽한 거미줄 -> Act 3 0.35s 스냅 절단 + 대형 2번 구름 12개 성층권 돌파 + 28줄 수직 스피드라인
      const anc = apexSceneExtras.anchorPt;
      if (inFreeze) {
        if (anc) {
          draw3DThickBeam({ x: px, y: py, z: pz }, anc, inAct1 ? 2.4 : 3.0, PAL.GOLD, '#ffffff');
        }
      } else if (inAct3) {
        if (p3 < 0.23 && anc) {
          const snapP = p3 / 0.23;
          const midPt = { x: px + (anc.x - px) * snapP, y: py + (anc.y - py) * snapP, z: pz + (anc.z - pz) * snapP };
          draw3DThickBeam(midPt, anc, 2.8 * (1.0 - snapP * 0.65), PAL.GOLD, '#ffffff');
          drawCrossFlash({ x: px, y: py - 2.0, z: pz }, Math.max(8, 52 * (1.0 - snapP * 0.5)), PAL.GOLD, false);
        } else {
          const rushP = (p3 - 0.23) / 0.77;
          drawCrossFlash({ x: px, y: py - 3.0, z: pz }, Math.max(6, 54 * (1.0 - rushP * 0.78)), PAL.GOLD, false);
          // 수직 상승 스피드라인 폭풍 (28줄)
          for (let i = 0; i < 28; i++) {
            const lx = ((i * 37 + 13) % (LCD_W - 12)) + 6;
            const phase = (rushP * (2.6 + (i % 4) * 0.60) + i * 0.17) % 1.0;
            const ly = phase * (LCD_H + 55) - 45;
            const segL = 26 + (i % 3) * 16;
            ctx.strokeStyle = (i % 3 === 0) ? '#ffffff' : ((i & 1) ? PAL.GOLD : PAL.NEON_CYAN);
            ctx.lineWidth = (i % 4 === 0) ? 1.8 : 1.0;
            ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx, ly + segL); ctx.stroke();
          }
          // 대형 2번 구름 12개 하향 돌파 스윕!
          if (cloudSpr) {
            for (let ci = 0; ci < 12; ci++) {
              const lanePhase = (rushP * (2.5 + (ci % 4) * 0.48) + ci * 0.18) % 1.0;
              const sc = 1.45 + (ci % 4) * 0.44;
              const cw = Math.round(cloudSpr.width * sc);
              const ch = Math.round(cloudSpr.height * sc);
              const side = (ci & 1) ? 1 : -1;
              const spread = (ci % 5) * 16;
              const cxPos = side < 0 ? Math.round(-cw * 0.28 + spread) : Math.round(LCD_W - cw * 0.72 - spread);
              const cyPos = Math.round(lanePhase * (LCD_H + ch * 2) - ch);
              ctx.drawImage(cloudSpr, cxPos, cyPos, cw, ch);
            }
          }
        }
      }
      if (apexSceneExtras.isDummy && apexSceneExtras.targetPt && inAct2) {
        drawDummyNode(apexSceneExtras.targetPt, PAL.GOLD, true);
      }
    } else if (apexId === 'lasso_swing' && apexSceneExtras.lassoPts) {
      // #4 올가미 스윙 (다트판 링 0%): Act 2 1.95x 사방 화면 밖 확장·한계 쪼기 -> Act 3 0.22s 초고속 폭축(스피드라인 24줄) -> 반동 대파열(파편 22개)
      const lPts = apexSceneExtras.lassoPts;
      const tPt = apexSceneExtras.targetPt || { x: px, y: py, z: pz };
      const expand = apexSceneExtras.lassoExpand || 1.0;
      const pullDur = apexSceneExtras.lassoPullDur || 0.22;
      const uPull = inFreeze ? 0.0 : Math.max(0.0, Math.min(1.0, act3Elapsed / pullDur));
      const pullT = Math.pow(uPull, 3.5); // 급가속 채찍 폭축!
      const curScale = expand * (1.0 - pullT);
      const curPts = [];
      for (let i = 0; i < lPts.length; i++) {
        const lp = lPts[i];
        curPts.push({
          x: tPt.x + (lp.x - tPt.x) * curScale,
          y: Math.max(4.5, tPt.y + (lp.y - tPt.y) * curScale),
          z: tPt.z + (lp.z - tPt.z) * curScale
        });
      }
      if (inFreeze || act3Elapsed < pullDur) {
        const highTens = (inAct2 && expand >= 1.72);
        const peakTens = (inAct2 && expand >= 1.88);
        const strandColMain = inAct3 ? PAL.GOLD : (peakTens ? (((Math.floor(apexTimer * 28) & 1) === 0) ? PAL.GOLD : '#ffffff') : (highTens ? PAL.GOLD : '#d8b4fe'));
        const strandColAlt = inAct3 ? '#ffffff' : (highTens ? '#d8b4fe' : '#a78bfa');
        const vibAmp = inAct3 ? 0.50 : (peakTens ? 0.85 : (highTens ? 0.42 : 0.0));
        const vibPhase = apexTimer * 46.0;
        for (let i = 0; i < curPts.length; i++) {
          const sCol = (i & 1) ? strandColMain : strandColAlt;
          if (vibAmp > 0.01 && !inAct1) {
            drawElasticStrand3D({ x: px, y: py, z: pz }, curPts[i], 0.0, vibAmp, vibPhase + i * 1.1, inAct3 ? 3.2 : 2.6, sCol, '#ffffff');
          } else {
            draw3DThickBeam({ x: px, y: py, z: pz }, curPts[i], inAct1 ? 2.0 : 2.6, sCol, '#ffffff');
          }
          if (!inAct1) {
            draw3DThickBeam(curPts[i], curPts[(i + 1) % curPts.length], inAct3 ? 2.2 : 1.8, strandColAlt, '#ffffff');
          }
          if (apexSceneExtras.isDummy && !inAct1) drawDummyNode(curPts[i], strandColMain, false);
        }
        // 한계 쪼기 피크 시 중앙 텐션 글로우
        if (highTens) {
          drawCrossFlash(tPt, peakTens ? 26 : 16, strandColMain, true);
        }
        // Act 3 초고속 폭축(0.22s): 화면 사방에서 중앙으로 빨려드는 24줄 집중 스피드라인!
        if (inAct3) {
          ctx.lineWidth = 1.4;
          for (let i = 0; i < 24; i++) {
            const ang = (i / 24) * Math.PI * 2 + uPull * 0.5;
            const rOut = 92 + ((i * 17) % 52);
            const rIn = Math.max(8, rOut * (1.0 - uPull * 0.82) - 24);
            ctx.strokeStyle = (i % 3 === 0) ? '#ffffff' : ((i & 1) ? PAL.GOLD : '#d8b4fe');
            ctx.beginPath();
            ctx.moveTo(LCD_W * 0.5 + Math.cos(ang) * rOut, LCD_H * 0.5 + Math.sin(ang) * rOut * 0.58);
            ctx.lineTo(LCD_W * 0.5 + Math.cos(ang) * rIn, LCD_H * 0.5 + Math.sin(ang) * rIn * 0.58);
            ctx.stroke();
          }
          drawCrossFlash(tPt, 24 + uPull * 34, PAL.GOLD, false);
        }
      } else if (inAct3) {
        const expT = Math.max(0.0, Math.min(1.0, (act3Elapsed - pullDur) / Math.max(0.1, act3Dur - pullDur)));
        for (let bi = 0; bi < 8; bi++) {
          const ba = (bi / 8) * Math.PI * 2 + 0.2;
          const elev = (bi & 1) ? 0.42 : -0.35;
          const lenB = 20.0 + expT * 74.0;
          draw3DThickBeam(
            tPt,
            { x: tPt.x + Math.cos(ba) * lenB, y: tPt.y + elev * lenB, z: tPt.z + Math.sin(ba) * lenB },
            5.2 * (1.0 - expT * 0.50),
            (bi & 1) ? PAL.GOLD : '#d8b4fe', '#ffffff'
          );
        }
        drawCrossFlash(tPt, Math.max(14, 78 * (1.0 - expT * 0.55)), PAL.GOLD, false);
        drawCrossFlash(tPt, Math.max(10, 56 * (1.0 - expT * 0.58)), '#d8b4fe', true);
        draw3DDebrisChunks(tPt, 53, 22, expT, 76.0, 30.0, '#a78bfa', PAL.GOLD, null);
      }
      if (apexSceneExtras.isDummy && inAct2) drawDummyNode(tPt, PAL.GOLD, true);
    } else if (apexId === 'chain_pinball' && apexSceneExtras.chainPts) {
      // #5 연쇄 핀볼 (다트판 링 0%): 5체 3D 분신 잔상 + Act 3 0.18s 간격 1->6 순차 번개 릴레이 + 최종점 대폭발(파편 20개)
      const cPts = apexSceneExtras.chainPts;
      const sparkIdx = apexSceneExtras.chainSparkIdx || -1;
      for (let i = 0; i < cPts.length - 1; i++) {
        const lit = inAct3 && i <= sparkIdx;
        draw3DThickBeam(cPts[i], cPts[i + 1], lit ? 6.0 : (inAct1 ? 2.0 : 2.8), lit ? PAL.GOLD : PAL.NEON_PINK, '#ffffff');
      }
      for (let i = 0; i < cPts.length; i++) {
        const vp = projectWorldPt(cPts[i].x, cPts[i].y, cPts[i].z, cb);
        if (vp) {
          ctx.fillStyle = PAL.INDIGO_OUTLINE; ctx.fillRect((vp.x - 3) | 0, (vp.y - 3) | 0, 6, 6);
          ctx.fillStyle = i === cPts.length - 1 ? PAL.GOLD : '#ffffff'; ctx.fillRect((vp.x - 2) | 0, (vp.y - 2) | 0, 4, 4);
        }
        if (inAct3 && i <= sparkIdx) {
          const localT = Math.max(0.0, Math.min(1.0, (act3Elapsed - i * 0.18) / 0.52));
          if (localT > 0.01 && localT < 1.0) {
            const isLast = (i === cPts.length - 1);
            const flashSz = (isLast ? 70 : 38) * (1.0 - localT * 0.62);
            drawCrossFlash(cPts[i], flashSz, isLast ? PAL.GOLD : PAL.NEON_PINK, (i & 1) === 1);
            if (isLast) {
              drawCrossFlash(cPts[i], flashSz * 0.85, PAL.NEON_PINK, false);
              draw3DDebrisChunks(cPts[i], 79, 20, localT, 62.0, 26.0, PAL.NEON_PINK, PAL.GOLD, null);
            }
          }
        }
      }
    } else if (apexId === 'elastic') {
      // #6 탄성 반발 (벽 0%, 다트판 링 0%, 80m 화면 밖 스케일 + 어깨 너머 초원근 구도):
      // Act 1-A(0.00~0.42s) 1차 공중 충돌 각인 -> Act 1-B(0.42~0.90s) ±33m 폭발 튕김 + 스피드라인 -> Act 2(0.90~2.35s) 80m 화면 밖 한계 쪼기 -> Act 3 0.18s 미사일 수축 2차 정면 대충돌!
      const mp = apexSceneExtras.midPt || { x: px, y: py, z: pz };
      const rd = apexSceneExtras.recoilDir || { x: 1, y: 0, z: 0 };
      const eVis = apexSceneExtras.enemyVisPt || mp;
      const pVis = { x: px + apexPlayerDrawOff.x, y: py + apexPlayerDrawOff.y, z: pz + apexPlayerDrawOff.z };
      const stretch = apexSceneExtras.elasticStretch || 0.0;
      const c1Dur = apexSceneExtras.clash1Dur || 0.42;
      const clashT = apexSceneExtras.clash2Time || 0.18;

      if (inFreeze || (inAct3 && act3Elapsed < clashT)) {
        // Act 1-A (0.00~0.42s): "쾅!" 1차 공중 충돌 임팩트 확실한 각인!
        if (inAct1 && apexTimer < c1Dur) {
          const p1a = apexTimer / c1Dur;
          const f1 = 1.0 - p1a * 0.45;
          // 1차 충돌 6가닥 충격 스파이크
          for (let si = 0; si < 6; si++) {
            const sa = (si / 6) * Math.PI * 2 + 0.35;
            const sLen = 9.0 + p1a * 14.0;
            draw3DThickBeam(
              mp,
              { x: mp.x + Math.cos(sa) * sLen, y: mp.y + ((si & 1) ? 0.45 : -0.38) * sLen, z: mp.z + Math.sin(sa) * sLen },
              2.6 * f1, (si & 1) ? PAL.EMERALD : '#ffffff', '#ffffff'
            );
          }
          drawCrossFlash(mp, 64 * f1, PAL.EMERALD, false);
          drawCrossFlash(mp, 44 * f1, '#ffffff', true);
        }

        // Act 1-B (0.42~0.90s): "펑! 슈우욱!!" 폭발적 양방향 튕김 발사 스피드라인(22줄) + 중앙 반발 잔광!
        if (inAct1 && apexTimer >= c1Dur) {
          const rProg = Math.min(1.0, (apexTimer - c1Dur) / 0.44);
          if (rProg < 0.72) {
            const rf = 1.0 - rProg / 0.72;
            drawCrossFlash(mp, 50 * rf, PAL.EMERALD, true);
          }
          ctx.lineWidth = 1.3;
          for (let i = 0; i < 22; i++) {
            const ang = (i / 22) * Math.PI * 2 + rProg * 0.35;
            const rIn = 42 + ((i * 19) % 26) - rProg * 14;
            const rOut = rIn + 60 + ((i * 23) % 42);
            ctx.strokeStyle = (i % 3 === 0) ? '#ffffff' : ((i & 1) ? PAL.EMERALD : PAL.GOLD);
            ctx.beginPath();
            ctx.moveTo(LCD_W * 0.5 + Math.cos(ang) * rIn, LCD_H * 0.5 + Math.sin(ang) * rIn * 0.55);
            ctx.lineTo(LCD_W * 0.5 + Math.cos(ang) * rOut, LCD_H * 0.5 + Math.sin(ang) * rOut * 0.55);
            ctx.stroke();
          }
        }

        // 탄성 한계 장력 단계별 색상·굵기·고주파 진동
        let strandCol = PAL.EMERALD;
        let coreCol = '#ffffff';
        let vibAmp = 0.0;
        let strandW = 2.8;
        if (inAct3) {
          // 0.18s 미사일 수축 단계: 황금/화이트 광채 수축선 + 22줄 초고속 수축 스피드라인!
          strandCol = PAL.GOLD;
          strandW = 4.2;
          vibAmp = 0.65;
          const uSnap = Math.max(0.0, Math.min(1.0, act3Elapsed / clashT));
          ctx.lineWidth = 1.5;
          for (let i = 0; i < 22; i++) {
            const ang = (i / 22) * Math.PI * 2 - uSnap * 0.6;
            const rOut = 98 + ((i * 17) % 48);
            const rIn = Math.max(6, rOut * (1.0 - uSnap * 0.88) - 22);
            ctx.strokeStyle = (i % 3 === 0) ? '#ffffff' : ((i & 1) ? PAL.GOLD : PAL.EMERALD);
            ctx.beginPath();
            ctx.moveTo(LCD_W * 0.5 + Math.cos(ang) * rOut, LCD_H * 0.5 + Math.sin(ang) * rOut * 0.55);
            ctx.lineTo(LCD_W * 0.5 + Math.cos(ang) * rIn, LCD_H * 0.5 + Math.sin(ang) * rIn * 0.55);
            ctx.stroke();
          }
        } else if (stretch >= 0.96) {
          // 한계 정지 홀드("쪼기" 피크): 크림슨 <-> 화이트 고속 점멸 + 격렬한 고주파 진동
          strandCol = ((Math.floor(apexTimer * 30) & 1) === 0) ? PAL.CRIMSON : '#ffffff';
          coreCol = '#ffffff';
          strandW = 3.6;
          vibAmp = 1.15;
        } else if (stretch >= 0.87) {
          strandCol = PAL.GOLD;
          strandW = 3.2;
          vibAmp = 0.58;
        } else if (stretch >= 0.20) {
          vibAmp = 0.24;
        }

        const vibPhase = apexTimer * 54.0;
        if (stretch > 0.02) {
          // 2가닥 팽팽한 탄성 거미줄 스트랜드 (화면 전경 스파이더맨 <-> 화면 밖 저 멀리 적까지!)
          drawElasticStrand3D(pVis, eVis, 0.78, vibAmp, vibPhase, strandW, strandCol, coreCol);
          drawElasticStrand3D(pVis, eVis, -0.78, vibAmp, vibPhase + 2.3, strandW * 0.90, strandCol, coreCol);
        }
        // 한계 "쪼기" 피크 시 줄 앞쪽 & 중앙 텐션 섬광
        if (inAct2 && stretch >= 0.91) {
          const tensPulse = 18 + ((Math.floor(apexTimer * 26) & 1) ? 12 : 0);
          const nearPt = { x: pVis.x * 0.65 + mp.x * 0.35, y: pVis.y * 0.65 + mp.y * 0.35, z: pVis.z * 0.65 + mp.z * 0.35 };
          drawCrossFlash(nearPt, tensPulse, strandCol, true);
          drawCrossFlash(mp, tensPulse * 0.85, strandCol, false);
        }
        // 반대편 공중에서 1차 충돌 후 화면 밖으로 튕겨 나갔다가 끌려오는 적 실루엣 노드
        drawElasticEnemyNode(eVis, strandCol);
      } else if (p4Fade > 0.05) {
        // Act 3 2단계 (0.18s~1.50s) + Act 4 페이드: 2차 공중 정면 대충돌 대폭발!
        const expT = Math.max(0.0, Math.min(1.0, (act3Elapsed - clashT) / Math.max(0.1, act3Dur - clashT)));
        const beamLen = 36.0 + expT * 46.0;
        const beamW = Math.max(2.0, 15.0 * (1.0 - expT * 0.45)) * p4Fade;
        // 반발 축을 양쪽으로 관통하는 광폭 에메랄드/골드 충격 빔
        draw3DThickBeam(
          { x: mp.x - rd.x * beamLen, y: mp.y - rd.y * beamLen, z: mp.z - rd.z * beamLen },
          { x: mp.x + rd.x * beamLen, y: mp.y + rd.y * beamLen, z: mp.z + rd.z * beamLen },
          beamW, PAL.EMERALD, '#ffffff'
        );
        // 교차 수직 충격 빔
        draw3DThickBeam(
          { x: mp.x, y: Math.max(2.0, mp.y - beamLen * 0.55), z: mp.z },
          { x: mp.x, y: mp.y + beamLen * 0.68, z: mp.z },
          beamW * 0.68, PAL.GOLD, '#ffffff'
        );
        if (inAct3) {
          drawCrossFlash(mp, Math.max(16, 78 * (1.0 - expT * 0.48)), PAL.GOLD, false);
          drawCrossFlash(mp, Math.max(12, 60 * (1.0 - expT * 0.52)), PAL.EMERALD, true);
          draw3DDebrisChunks(mp, 97, 22, expT, 76.0, 30.0, PAL.EMERALD, PAL.GOLD, null);
        }
      }
    }
  }

  const handPos = (thirdPerson || openingCamBlend > 0.01 || apexCamBlend > 0.01)
    ? drawSpiderManSprite(cb, totalSpeed)
    : { x: LCD_W * 0.5, y: LCD_H - 1, x1: null, y1: null, x2: null, y2: null };

  if (strikeMode === 3 && strikeTarget && handPos) {
    const p = Math.max(0.05, Math.min(1.0, strikeWebProg));
    const wx = px + (strikeTarget.x - px) * p;
    const wy = py + (strikeTarget.y - py) * p;
    const wz = pz + (strikeTarget.z - pz) * p;
    const tipPt = projectWorldPt(wx, wy, wz, cb);
    if (tipPt) {
      const isTwin = (CARTOON_MOTIONS[strikeMotionIdx].twinWeb && handPos.x1 !== null && handPos.x2 !== null);
      const drawWebStrand = (hx, hy) => {
        ctx.strokeStyle = PAL.INDIGO_OUTLINE; ctx.lineWidth = 3.2;
        ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tipPt.x, tipPt.y); ctx.stroke();
        const strandCol = isChainRush ? PAL.NEON_PINK
          : ((strikeEntrySpd >= STRIKE_NO_FREEZE_SPEED)
          ? ((Math.floor(simTime * 28) & 1) ? PAL.NEON_CYAN : '#ffffff')
          : ((Math.floor(simTime * 30) & 1) ? '#ffffff' : PAL.GOLD));
        ctx.strokeStyle = strandCol; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tipPt.x, tipPt.y); ctx.stroke();
      };
      if (isTwin) {
        drawWebStrand(handPos.x1, handPos.y1);
        drawWebStrand(handPos.x2, handPos.y2);
      } else {
        drawWebStrand(handPos.x, handPos.y);
      }
      ctx.fillStyle = PAL.INDIGO_OUTLINE; ctx.fillRect((tipPt.x - 3) | 0, (tipPt.y - 3) | 0, 6, 6);
      ctx.fillStyle = p >= 1.0 ? PAL.GOLD : '#ffffff'; ctx.fillRect((tipPt.x - 2) | 0, (tipPt.y - 2) | 0, 4, 4);
    }
  } else if (!isSwinging && strikeMode === 0 && !isOpeningCutscene()) {
    const target = findWallAnchor(turnInput, forwardInput, nearbyBuildings, nearbyClouds);
    if (target) {
      const tp = projectWorldPt(target.wx, target.wy, target.wz, cb);
      const onScreen = tp && tp.x >= 6 && tp.x <= LCD_W - 6 && tp.y >= 6 && tp.y <= LCD_H - 6;
      if (onScreen) {
        ctx.strokeStyle = PAL.INDIGO_OUTLINE; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(tp.x, tp.y, 4.0, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = target.isCloud ? PAL.NEON_CYAN : PAL.CRIMSON; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(tp.x, tp.y, 4.0, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = target.isCloud ? '#ffffff' : PAL.GOLD; ctx.fillRect((tp.x - 1) | 0, (tp.y - 1) | 0, 2, 2);
      } else {
        // 화면 밖 앵커 테두리 방향 화살표 (320x170 초경량 벡터)
        const rawX = tp ? tp.x : (target.side > 0 ? LCD_W + 20 : -20);
        const rawY = tp ? tp.y : 14;
        const ex = Math.max(8, Math.min(LCD_W - 8, rawX)) | 0;
        const ey = Math.max(10, Math.min(LCD_H - 12, rawY)) | 0;
        const ang = Math.atan2(rawY - ey, rawX - ex);
        const ax1 = (ex + Math.cos(ang) * 4) | 0;
        const ay1 = (ey + Math.sin(ang) * 4) | 0;
        const ax2 = (ex + Math.cos(ang + 2.35) * 4) | 0;
        const ay2 = (ey + Math.sin(ang + 2.35) * 4) | 0;
        const ax3 = (ex + Math.cos(ang - 2.35) * 4) | 0;
        const ay3 = (ey + Math.sin(ang - 2.35) * 4) | 0;
        ctx.fillStyle = PAL.INDIGO_OUTLINE;
        ctx.beginPath(); ctx.moveTo(ax1, ay1); ctx.lineTo(ax2, ay2); ctx.lineTo(ax3, ay3); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = target.isCloud ? PAL.NEON_CYAN : PAL.GOLD;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(ax2, ay2); ctx.lineTo(ax1, ay1); ctx.lineTo(ax3, ay3); ctx.stroke();
      }
    }
  } else if (isSwinging && handPos) {
    const ap = projectWorldPt(ax, ay, az, cb);
    const isPerfectVisual = inPerfectWindow || perfectGraceTimer > 0;
    const webCol = isPerfectVisual ? ((Math.floor(simTime * 28) & 1) ? '#ffffff' : PAL.GOLD)
      : (passedBottom ? PAL.GOLD : (isRopeTaut ? '#ffffff' : '#b8e4ff'));
    const endPt = ap ? ap : { x: (LCD_W * 0.5 + anchorSide * 55) | 0, y: 0 };
    const shootProg = swingWebShootTimer > 0 ? Math.max(0.28, 1.0 - swingWebShootTimer / 0.05) : 1.0;
    const drawEndX = handPos.x + (endPt.x - handPos.x) * shootProg;
    const drawEndY = handPos.y + (endPt.y - handPos.y) * shootProg;
    const showSlackSag = !isRopeTaut && shootProg >= 1.0;
    const sagMidX = (handPos.x + drawEndX) * 0.5;
    const sagMidY = (handPos.y + drawEndY) * 0.5 + 6.5;

    ctx.strokeStyle = isPerfectVisual ? PAL.NEON_CYAN : PAL.INDIGO_OUTLINE;
    ctx.lineWidth = isPerfectVisual ? 3.5 : (isRopeTaut ? 3 : 2.2);
    ctx.beginPath();
    ctx.moveTo(handPos.x, handPos.y);
    if (showSlackSag) ctx.lineTo(sagMidX, sagMidY);
    ctx.lineTo(drawEndX, drawEndY);
    ctx.stroke();

    ctx.strokeStyle = webCol;
    ctx.lineWidth = isPerfectVisual ? 2.0 : (isRopeTaut ? 1.4 : 1.0);
    ctx.beginPath();
    ctx.moveTo(handPos.x, handPos.y);
    if (showSlackSag) ctx.lineTo(sagMidX, sagMidY);
    ctx.lineTo(drawEndX, drawEndY);
    ctx.stroke();

    if (ap && shootProg >= 0.95) {
      ctx.fillStyle = PAL.INDIGO_OUTLINE; ctx.fillRect((ap.x - 3) | 0, (ap.y - 3) | 0, 6, 6);
      ctx.fillStyle = isPerfectVisual ? PAL.GOLD : PAL.CRIMSON; ctx.fillRect((ap.x - 2) | 0, (ap.y - 2) | 0, 4, 4);
    }
  }

  // [올가미 스윙] 3D 근평면 클리핑 흰색 거미줄 선분 (카메라 뒤쪽 포획 적까지 끊김 없이 표시, 4명+ 각성 시 금색 점멸)
  if (lassoTargets.length > 0 && handPos) {
    const lSpecDraw = getLassoSpec();
    const lassoAwaken = lSpecDraw && lassoTargets.length >= lSpecDraw.awakenCount;
    const lassoCol = lassoAwaken
      ? ((Math.floor(simTime * 20) & 1) ? PAL.GOLD : '#ffffff')
      : '#ffffff';
    const is3rdView = (thirdPerson || openingCamBlend > 0.01 || apexCamBlend > 0.01);
    const pOrigin = is3rdView
      ? [px, py - 0.5, pz]
      : [px + cb.sinY * 1.4, py - 0.85, pz + cb.cosY * 1.4];
    for (let i = 0; i < lassoTargets.length; i++) {
      const te = lassoTargets[i];
      const ePt3 = [te.x, te.y, te.z];
      drawClippedLine3D(pOrigin, ePt3, cb, PAL.INDIGO_OUTLINE, lassoAwaken ? 2.6 : 2.2);
      drawClippedLine3D(pOrigin, ePt3, cb, lassoCol, lassoAwaken ? 1.4 : 1.15);
      const ep = projectWorldPt(te.x, te.y, te.z, cb);
      if (ep) {
        ctx.fillStyle = PAL.INDIGO_OUTLINE;
        ctx.fillRect((ep.x - 2) | 0, (ep.y - 2) | 0, 4, 4);
        ctx.fillStyle = lassoCol;
        ctx.fillRect((ep.x - 1) | 0, (ep.y - 1) | 0, 2, 2);
      }
    }
  }

  ctx.textAlign = 'center';
  for (const dn of damageNumbers) {
    const dp = projectWorldPt(dn.x, dn.y, dn.z, cb);
    if (!dp) continue;
    ctx.font = dn.big ? 'bold 10.5px Consolas, monospace' : 'bold 8.5px Consolas, monospace';
    ctx.fillStyle = '#000000';
    ctx.fillText(dn.text, Math.round(dp.x) + 1, Math.round(dp.y) + 1);
    ctx.fillStyle = dn.col;
    ctx.fillText(dn.text, Math.round(dp.x), Math.round(dp.y));
  }
  ctx.textAlign = 'left';

  if (wallSkimIntensity > 0.15) {
    const edgeX = wallSkimSide > 0 ? LCD_W - 2 : 2;
    const dir = wallSkimSide > 0 ? -1 : 1;
    const cnt = Math.ceil(wallSkimIntensity * 9);
    ctx.strokeStyle = wallSkimIntensity > 0.6 ? PAL.GOLD : '#b8e4ff';
    ctx.lineWidth = 1;
    for (let i = 0; i < cnt; i++) {
      const y0 = 20 + Math.random() * (LCD_H - 40);
      const len = 18 + Math.random() * 38 * wallSkimIntensity;
      ctx.beginPath(); ctx.moveTo(edgeX, y0); ctx.lineTo(edgeX + dir * len, y0 + (Math.random() - 0.5) * 10); ctx.stroke();
    }
  }
  // Cut 3: 구름층(495m->330m) 돌파 시 사전 베이크 2번 구름 스프라이트가 좌우 화면 끝을 스치며 위로 솟구치는 연출
  if (openingCloudRush > 0.04 && cloudSpr) {
    for (let ci = 0; ci < 6; ci++) {
      const side = (ci & 1) ? 1 : -1;
      const lanePhase = (simTime * (2.6 + (ci % 3) * 0.55) + ci * 0.37) % 1.0;
      const cw = Math.round(cloudSpr.width * (1.35 + (ci % 3) * 0.45));
      const ch = Math.round(cloudSpr.height * (1.35 + (ci % 3) * 0.45));
      const cxPos = side < 0
        ? Math.round(-cw * 0.35 + (ci % 3) * 18)
        : Math.round(LCD_W - cw * 0.65 - (ci % 3) * 18);
      const cyPos = Math.round((1.0 - lanePhase) * (LCD_H + ch * 2) - ch);
      ctx.drawImage(cloudSpr, cxPos, cyPos, cw, ch);
    }
  }

  // Cut 4: 스파이더버스 역방향 공중 포즈 컷 전용 방사형 코믹 집중선 (ESP32 초경량 1px 벡터)
  if (openingPoseRadial > 0.04) {
    const rayCnt = openingPoseRadial > 0.6 ? 16 : 10;
    const spinOff = simTime * 2.2;
    ctx.lineWidth = 1;
    for (let ri = 0; ri < rayCnt; ri++) {
      const ang = (ri / rayCnt) * Math.PI * 2 + spinOff;
      const rIn = 62 + ((ri & 1) ? 14 : 4);
      const rOut = rIn + 38 + ((ri % 3) * 14);
      ctx.strokeStyle = (ri % 3 === 0) ? PAL.GOLD : ((ri & 1) ? PAL.NEON_CYAN : '#ffffff');
      ctx.beginPath();
      ctx.moveTo(LCD_W * 0.5 + Math.cos(ang) * rIn, LCD_H * 0.5 + Math.sin(ang) * rIn * 0.62);
      ctx.lineTo(LCD_W * 0.5 + Math.cos(ang) * rOut, LCD_H * 0.5 + Math.sin(ang) * rOut * 0.62);
      ctx.stroke();
    }
  }

  if (isDiving || (openingPhase === 'DROP_INTRO' && openingTimer > (openingRetryDrop ? 0.0 : 1.15) && openingPoseRadial <= 0.04)) {
    const isDropChase = (openingPhase === 'DROP_INTRO' || openingPhase === 'DROP_CATCH');
    const lineCnt = isDropChase ? 11 : 6;
    ctx.strokeStyle = (openingPhase === 'DROP_CATCH' && py <= 95.0)
      ? PAL.GOLD
      : (diveCharge > 0.7 ? PAL.GOLD : PAL.NEON_CYAN);
    ctx.lineWidth = 1;
    for (let i = 0; i < lineCnt; i++) {
      const lx = isDropChase
        ? ((i & 1) ? (6 + Math.random() * 72) : (LCD_W - 78 + Math.random() * 72))
        : (24 + Math.random() * (LCD_W - 48));
      const ly = Math.random() * (LCD_H - 25);
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx, ly + 18 + (isDropChase ? 18 : diveCharge * 18)); ctx.stroke();
    }
  }
  if (!isApexFreezePhase() && ((totalSpeed > 82 && !isOpeningCutscene()) || (strikeMode !== 0 && strikePhase === 'RUSH') || groundSkimIntensity > 0.4)) {
    const cnt = Math.min(11, ((totalSpeed - 70) / 9) | 0) + (strikePhase === 'RUSH' ? 6 : 0);
    for (let i = 0; i < cnt; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r1 = 92 + Math.random() * 20, r2 = r1 + 24 + Math.random() * 28;
      ctx.strokeStyle = strikeMode === 1 ? PAL.ORANGE : (strikeMode === 3 ? (isChainRush ? PAL.NEON_PINK : PAL.NEON_CYAN) : (groundSkimIntensity > 0.5 ? PAL.GOLD : '#cceeff'));
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(LCD_W * 0.5 + Math.cos(ang) * r1, LCD_H * 0.5 + Math.sin(ang) * r1 * 0.55);
      ctx.lineTo(LCD_W * 0.5 + Math.cos(ang) * r2, LCD_H * 0.5 + Math.sin(ang) * r2 * 0.55);
      ctx.stroke();
    }
  }

  // [Step 4] 컷 전환 2프레임 임팩트 스냅 (초경량 벡터 플래시)
  if (apexActive && apexFlashTimer > 0.0) {
    const defF = APEX_CUT_DEFS[apexId];
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, LCD_W - 3, LCD_H - 3);
    ctx.strokeStyle = defF ? defF.col : PAL.GOLD;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, LCD_H * 0.25); ctx.lineTo(LCD_W, LCD_H * 0.75);
    ctx.moveTo(LCD_W, LCD_H * 0.25); ctx.lineTo(0, LCD_H * 0.75);
    ctx.stroke();
  }

  return { cb, totalSpeed };
}
