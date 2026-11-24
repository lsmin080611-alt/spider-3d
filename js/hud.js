'use strict';
// Spider 3D — Radar, Offscreen Markers & 320x170 PC-98 HUD/Overlay Renderer

function drawEnemyRadarHUD() {
  if (enemies.length === 0) return;
  let focusTarget = strikeTarget || homingTarget;
  if (!focusTarget) {
    if (bossActive && bossEntity && enemies.indexOf(bossEntity) !== -1) {
      focusTarget = bossEntity;
    } else {
      let near = enemies[0], minD = 99999;
      for (const e of enemies) {
        const d = Math.hypot(e.x - px, e.y - py, e.z - pz) - (e.tier === 'ELITE' ? 30.0 : 0);
        if (d < minD) { minD = d; near = e; }
      }
      focusTarget = near;
    }
  }

  const dx = focusTarget.x - px, dy = focusTarget.y - py, dz = focusTarget.z - pz;
  const dist = Math.hypot(dx, dy, dz);
  const targetYaw = Math.atan2(dx, dz);
  let relYaw = (targetYaw - camLagYaw + Math.PI) % (2 * Math.PI) - Math.PI;
  if (relYaw < -Math.PI) relYaw += 2 * Math.PI;

  const yOff = bossActive ? 14 : 0;
  const axC = 156, ayC = 29 + yOff + Math.round(Math.sin(simTime * 7) * 1.1);
  const arrowCol = (strikeTarget || homingTarget) ? PAL.NEON_CYAN : ((focusTarget.tier === 'BOSS' || focusTarget.tier === 'ELITE') ? PAL.GOLD : PAL.CRIMSON);

  ctx.save();
  ctx.translate(axC, ayC);
  ctx.rotate(relYaw);
  ctx.fillStyle = PAL.INDIGO_OUTLINE;
  ctx.beginPath();
  ctx.moveTo(0, -8.5); ctx.lineTo(7.5, 0); ctx.lineTo(3.8, 0);
  ctx.lineTo(3.8, 7); ctx.lineTo(-3.8, 7); ctx.lineTo(-3.8, 0); ctx.lineTo(-7.5, 0);
  ctx.closePath(); ctx.fill();

  ctx.fillStyle = arrowCol;
  ctx.beginPath();
  ctx.moveTo(0, -7); ctx.lineTo(6, -1); ctx.lineTo(2.5, -1);
  ctx.lineTo(2.5, 5.5); ctx.lineTo(-2.5, 5.5); ctx.lineTo(-2.5, -1); ctx.lineTo(-6, -1);
  ctx.closePath(); ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -7); ctx.lineTo(0, 5.5); ctx.lineTo(-2.5, 5.5); ctx.lineTo(-2.5, -1); ctx.lineTo(-6, -1);
  ctx.closePath(); ctx.fill();
  ctx.restore();

  const vert = dy > 22 ? '▲' : (dy < -22 ? '▼' : '●');
  const distStr = Math.round(dist) + 'm' + vert;
  ctx.font = 'bold 8px Consolas, monospace';
  const tw = ctx.measureText(distStr).width;
  const bx = Math.round(axC - tw * 0.5 - 3);
  ctx.fillStyle = '#121936';
  ctx.fillRect(bx, 38 + yOff, Math.round(tw + 6), 10);
  ctx.strokeStyle = arrowCol;
  ctx.lineWidth = 1;
  ctx.strokeRect(bx + 0.5, 38.5 + yOff, Math.round(tw + 5), 9);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(distStr, bx + 3, 46 + yOff);
}

// 화면 밖 주요 적 테두리 방향 마커 (최대 3개: BOSS/ELITE > 최인접 MEDIUM > 최인접 SWARM, ESP32-S3 초경량 벡터)
function drawOffscreenEnemyMarkers(cb) {
  if (enemies.length === 0) return;

  const elites = [];
  const mediums = [];
  let nearestSwarm = null;
  let nearestSwarmDist = 99999;

  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    const c = worldToCam(e.x, e.y, e.z, cb);
    let sx = 0, sy = 0;
    if (c.z > NEAR_Z) {
      sx = (c.x / c.z) * cb.d + LCD_W * 0.5 + cb.sx;
      sy = (-c.y / c.z) * cb.d + LCD_H * 0.5 + cb.sy;
      if (sx >= 8 && sx <= LCD_W - 14 && sy >= 12 && sy <= LCD_H - 14) continue;
    }

    const dist = Math.hypot(e.x - px, e.y - py, e.z - pz);
    const entry = { e, c, sx, sy, dist: e.isBoss ? -1 : dist };
    if (e.tier === 'BOSS' || e.tier === 'ELITE') {
      elites.push(entry);
    } else if (e.tier === 'MEDIUM') {
      mediums.push(entry);
    } else if (dist < nearestSwarmDist) {
      nearestSwarmDist = dist;
      nearestSwarm = entry;
    }
  }

  elites.sort((a, b) => a.dist - b.dist);
  mediums.sort((a, b) => a.dist - b.dist);

  const markers = [];
  for (let i = 0; i < elites.length && markers.length < 2; i++) markers.push(elites[i]);
  for (let i = 0; i < mediums.length && markers.length < 3; i++) markers.push(mediums[i]);
  if (nearestSwarm && markers.length < 3) markers.push(nearestSwarm);
  if (markers.length === 0) return;

  const cx0 = LCD_W * 0.5, cy0 = LCD_H * 0.5;
  const minX = 9, maxX = LCD_W - 17, minY = 12, maxY = LCD_H - 14;

  for (let i = 0; i < markers.length; i++) {
    const m = markers[i];
    let dirX, dirY;
    if (m.c.z > NEAR_Z) {
      dirX = m.sx - cx0;
      dirY = m.sy - cy0;
    } else {
      dirX = m.c.x;
      dirY = -m.c.y;
      if (Math.abs(dirX) < 10) dirX = (dirX >= 0 ? 1 : -1) * 10;
    }
    if (Math.abs(dirX) < 0.001 && Math.abs(dirY) < 0.001) dirY = 1.0;

    const tx = dirX > 0 ? (maxX - cx0) / dirX : (dirX < 0 ? (minX - cx0) / dirX : 1e9);
    const ty = dirY > 0 ? (maxY - cy0) / dirY : (dirY < 0 ? (minY - cy0) / dirY : 1e9);
    const t = Math.min(tx, ty);
    const ex = Math.max(minX, Math.min(maxX, Math.round(cx0 + dirX * t)));
    let ey = Math.max(minY, Math.min(maxY, Math.round(cy0 + dirY * t)));

    // 상단 좌/우 HUD 박스 영역 침범 방지
    if (ey < 56 && ex < 122) ey = 56;
    if (ey < 52 && ex > LCD_W - 130) ey = 52;

    const ang = Math.atan2(dirY, dirX);
    const isElite = m.e.tier === 'ELITE';
    const isSwarm = m.e.tier === 'SWARM';
    const sz = isElite ? 5.0 : (isSwarm ? 3.2 : 4.0);
    const col = isElite ? PAL.GOLD
      : (isSwarm ? PAL.NEON_CYAN : (m.e.type === 'WALL_TURRET' ? PAL.ORANGE : PAL.NEON_PINK));

    const x1 = (ex + Math.cos(ang) * sz) | 0;
    const y1 = (ey + Math.sin(ang) * sz) | 0;
    const x2 = (ex + Math.cos(ang + 2.35) * sz) | 0;
    const y2 = (ey + Math.sin(ang + 2.35) * sz) | 0;
    const x3 = (ex + Math.cos(ang - 2.35) * sz) | 0;
    const y3 = (ey + Math.sin(ang - 2.35) * sz) | 0;

    ctx.fillStyle = PAL.INDIGO_OUTLINE;
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3);
    ctx.closePath(); ctx.fill();

    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo((ex + Math.cos(ang) * (sz - 1)) | 0, (ey + Math.sin(ang) * (sz - 1)) | 0);
    ctx.lineTo((ex + Math.cos(ang + 2.35) * (sz - 1.2)) | 0, (ey + Math.sin(ang + 2.35) * (sz - 1.2)) | 0);
    ctx.lineTo((ex + Math.cos(ang - 2.35) * (sz - 1.2)) | 0, (ey + Math.sin(ang - 2.35) * (sz - 1.2)) | 0);
    ctx.closePath(); ctx.fill();
  }
}


function renderHUD(cb, totalSpeed) {
  const lbBlend = Math.max(strikeCamBlend, openingLetterbox, apexLetterbox);
  if (lbBlend > 0.04) {
    const isApexBar = apexLetterbox >= openingLetterbox && apexLetterbox >= strikeCamBlend && apexLetterbox > 0.04;
    const barH = Math.round(lbBlend * (openingLetterbox > strikeCamBlend && openingLetterbox > apexLetterbox ? 14 : (isApexBar ? 15 : 11)));
    ctx.fillStyle = PAL.INDIGO_OUTLINE;
    ctx.fillRect(0, 0, LCD_W, barH);
    ctx.fillRect(0, LCD_H - barH, LCD_W, barH);

    // [Step 4] 레터박스 내부 미니멀 각성 라벨 (중앙 3D 시야 방해 0%)
    if (isApexBar && barH >= 10) {
      const defBar = APEX_CUT_DEFS[apexId];
      const trimCol = defBar ? defBar.col : PAL.GOLD;
      ctx.fillStyle = trimCol;
      ctx.fillRect(0, barH - 1, LCD_W, 1);
      ctx.fillRect(0, LCD_H - barH, LCD_W, 1);
      ctx.font = 'bold 7.5px Consolas, monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = PAL.GOLD;
      ctx.fillText(apexIsTest ? ('★ ' + apexTestLabel) : '★ APEX CUT', 6, barH - 4);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(defBar ? defBar.title : 'AWAKENED', LCD_W - 6, barH - 4);
      ctx.textAlign = 'left';
    }
  }

  if (damageFlash > 0) {
    ctx.strokeStyle = 'rgba(232, 40, 72, ' + Math.min(0.85, damageFlash * 2.4).toFixed(2) + ')';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, LCD_W - 6, LCD_H - 6);
  }

  if (!augmentDraftOpen && !gameOver && openingPhase === 'ACTIVE' && apexLetterbox <= 0.35) {
    drawOffscreenEnemyMarkers(cb);
  }

  const drawPC98Box = (x, y, w, h, accent = '#68b0f0') => {
    ctx.fillStyle = '#121936';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = PAL.INDIGO_OUTLINE;
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
    ctx.strokeStyle = accent;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  };

  if (!isOpeningCutscene() && apexLetterbox <= 0.35) {
    const hpCol = hp > 55 ? PAL.EMERALD : (hp > 25 ? PAL.GOLD : PAL.CRIMSON);
    const hudBorder = strikeMode === 1 ? PAL.ORANGE : (strikeMode === 3 ? (isChainRush ? PAL.NEON_PINK : PAL.NEON_CYAN) : '#68b0f0');
    drawPC98Box(4, 4, 114, 38, hudBorder);

    ctx.font = 'bold 8px Consolas, monospace';
    ctx.fillStyle = hpCol;
    ctx.fillText('HP' + String(hp).padStart(3, ' '), 7, 13);
    ctx.fillStyle = '#20142a';
    ctx.fillRect(36, 7, 77, 6);
    ctx.fillStyle = hpCol;
    ctx.fillRect(36, 7, Math.round((hp / MAX_HP) * 77), 6);
    ctx.strokeStyle = '#cceeff';
    ctx.strokeRect(35.5, 6.5, 78, 7);

    const spdLabel = strikeMode === 1 ? 'C1!' : (strikeMode === 3 ? 'C3!' : (isGliding ? 'GLD' : 'SPD'));
    ctx.fillStyle = strikeMode !== 0 ? hudBorder : (isGliding ? PAL.EMERALD : '#b8e4ff');
    ctx.fillText(spdLabel, 7, 24);
    const gLen = Math.min(77, ((totalSpeed / 180.0) * 77) | 0);
    ctx.fillStyle = '#1c2440';
    ctx.fillRect(36, 18, 77, 6);
    ctx.fillStyle = strikeMode !== 0 ? hudBorder : (totalSpeed >= STRIKE_NO_FREEZE_SPEED ? PAL.NEON_CYAN : PAL.NEON_PINK);
    ctx.fillRect(36, 18, gLen, 6);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(36 + Math.round((STRIKE_NO_FREEZE_SPEED / 180.0) * 77), 18, 1, 6);
    ctx.strokeStyle = '#cceeff';
    ctx.strokeRect(35.5, 17.5, 78, 7);

    const altStr = String(py | 0).padStart(3, ' ');
    const spdStr = String(totalSpeed | 0).padStart(3, ' ');
    ctx.fillStyle = '#ffffff';
    ctx.fillText('ALT:' + altStr + 'm SPD:' + spdStr, 7, 37);

    // LV / XP 성장 게이지 (12픽 만렙 도달 시 MAX 금색 강조)
    const isBuildMax = totalAugmentsPicked >= MAX_AUG_SLOTS * MAX_AUG_LEVEL;
    const xpRatio = Math.max(0, Math.min(1, playerXp / Math.max(1, xpToNext)));
    drawPC98Box(4, 44, 114, 11, isBuildMax ? PAL.GOLD : PAL.NEON_CYAN);
    ctx.font = 'bold 7.5px Consolas, monospace';
    ctx.fillStyle = PAL.GOLD;
    ctx.fillText(isBuildMax ? 'MAX' : ('LV' + playerLevel), 7, 52);
    ctx.fillStyle = '#18203c';
    ctx.fillRect(28, 47, 85, 5);
    ctx.fillStyle = isBuildMax ? PAL.GOLD : PAL.NEON_CYAN;
    ctx.fillRect(28, 47, Math.round(xpRatio * 85), 5);
    ctx.strokeStyle = isBuildMax ? PAL.GOLD : '#68b0f0';
    ctx.strokeRect(27.5, 46.5, 86, 6);

    if (diveCharge > 0.02) {
      drawPC98Box(4, 57, 114, 10, diveCharge > 0.7 ? PAL.GOLD : PAL.NEON_CYAN);
      ctx.fillStyle = '#cceeff';
      ctx.font = 'bold 7px Consolas, monospace';
      ctx.fillText('DIVE', 7, 64);
      ctx.fillStyle = diveCharge > 0.7 ? PAL.GOLD : PAL.NEON_CYAN;
      ctx.fillRect(28, 60, Math.round(diveCharge * 84), 4);
    }

    // 중앙 상단: 평소 6분(06:00) 타이머 / 보스전 중 보스 HP + EVADE/GROGGY 턴 게이지 (x=120..196 무겹침)
    if (bossActive && bossPhase !== 'DEFEATED') {
      const bHp = bossEntity ? bossEntity.hp : 0;
      const bMax = bossEntity ? bossEntity.maxHp : BOSS_MAX_HP;
      const hpRatioB = Math.max(0.0, Math.min(1.0, bHp / Math.max(1, bMax)));
      const isGroggyH = (bossPhase === 'GROGGY');
      const isEvadeFlash = (bossEvadeFlash > 0 && ((Math.floor(performance.now() / 80) & 1) === 0));
      const boxBorder = isGroggyH ? PAL.GOLD : (isEvadeFlash ? PAL.GOLD : (bossStage >= 2 ? PAL.CRIMSON : PAL.ORANGE));

      drawPC98Box(120, 4, 76, 28, boxBorder);

      // Row 1: BOSS HP BAR
      ctx.fillStyle = '#201024';
      ctx.fillRect(123, 7, 70, 5);
      ctx.fillStyle = isGroggyH ? PAL.GOLD : (bossStage >= 2 ? PAL.CRIMSON : '#ff4d6d');
      ctx.fillRect(123, 7, Math.round(hpRatioB * 70), 5);
      ctx.strokeStyle = '#ffd0e0';
      ctx.strokeRect(122.5, 6.5, 71, 6);

      // Row 2: 턴 상태 텍스트 + 진행 바
      ctx.textAlign = 'center';
      ctx.font = 'bold 7.5px Consolas, monospace';
      if (bossPhase === 'INTRO') {
        const wBlink = (Math.floor(performance.now() / 160) & 1) === 0;
        ctx.fillStyle = wBlink ? PAL.GOLD : PAL.CRIMSON;
        ctx.fillText('WARNING!!', 158, 22);
      } else if (bossPhase === 'EVADE') {
        const evRatio = Math.max(0.0, Math.min(1.0, bossPhaseTimer / BOSS_EVADE_DURATION));
        ctx.fillStyle = isEvadeFlash ? PAL.GOLD : '#ffd599';
        const evTxt = bossEvadeFlash > 0.15
          ? ('-' + bossLastCutSec.toFixed(1) + 's CUT!')
          : ('EVD ' + bossPhaseTimer.toFixed(1) + 's');
        ctx.fillText(evTxt, 158, 21);
        ctx.fillStyle = '#1d1430';
        ctx.fillRect(123, 24, 70, 4);
        ctx.fillStyle = isEvadeFlash ? PAL.GOLD : (bossStage >= 2 ? PAL.CRIMSON : PAL.ORANGE);
        ctx.fillRect(123, 24, Math.round(evRatio * 70), 4);
      } else if (bossPhase === 'GROGGY') {
        const grRatio = Math.max(0.0, Math.min(1.0, bossPhaseTimer / BOSS_GROGGY_DURATION));
        const remHits = Math.max(0, BOSS_GROGGY_MAX_HITS - bossGroggyHits);
        const pips = '◆'.repeat(remHits) + '◇'.repeat(Math.max(0, BOSS_GROGGY_MAX_HITS - remHits));
        ctx.fillStyle = PAL.GOLD;
        ctx.fillText(bossPhaseTimer.toFixed(1) + 's ' + pips, 158, 21);
        ctx.fillStyle = '#241c10';
        ctx.fillRect(123, 24, 70, 4);
        ctx.fillStyle = PAL.GOLD;
        ctx.fillRect(123, 24, Math.round(grRatio * 70), 4);
      }
      ctx.textAlign = 'left';

      // INTRO 중앙 경고 배너
      if (bossPhase === 'INTRO') {
        const bBlink = (Math.floor(performance.now() / 180) & 1) === 0;
        drawPC98Box(66, 72, 188, 24, bBlink ? PAL.CRIMSON : PAL.GOLD);
        ctx.textAlign = 'center';
        ctx.font = 'bold 10px Consolas, monospace';
        ctx.fillStyle = bBlink ? PAL.GOLD : '#ffffff';
        ctx.fillText('WARNING!! BOSS APPROACHING', LCD_W * 0.5, 83);
        ctx.font = 'bold 7.5px Consolas, monospace';
        ctx.fillStyle = PAL.CRIMSON;
        ctx.fillText('OMEGA SOVEREIGN · STRIKE TO CUT EVADE', LCD_W * 0.5, 92);
        ctx.textAlign = 'left';
      }
    } else {
      const timerWarn = runTimeRemaining <= 20.0 && runTimeRemaining > 0.0;
      const timerBlink = timerWarn && ((Math.floor(performance.now() / 220) & 1) === 0);
      const timerCol = runTimeRemaining <= 0.0 ? PAL.GOLD : (timerWarn ? (timerBlink ? '#ffffff' : PAL.CRIMSON) : (runTimeRemaining <= 60.0 ? PAL.GOLD : '#ffffff'));
      const timerBorder = runTimeRemaining <= 0.0 ? PAL.GOLD : (timerWarn ? PAL.CRIMSON : (runTimeRemaining <= 60.0 ? PAL.GOLD : PAL.NEON_CYAN));
      drawPC98Box(127, 4, 58, 15, timerBorder);
      ctx.textAlign = 'center';
      ctx.font = 'bold 10px Consolas, monospace';
      ctx.fillStyle = timerCol;
      ctx.fillText(formatRunTimer(runTimeRemaining), 156, 15);
      ctx.textAlign = 'left';
    }

    drawEnemyRadarHUD();

    // 우측 상단 컴팩트 웨이브·콤보·픽 정보 박스 (24px 높이로 축소해 우측 대형 랭크 엠블럼 공간 확보)
    const rankInfo = STYLE_RANKS[styleRankIdx] || STYLE_RANKS[0];
    const rankProgress = Math.max(0.0, Math.min(1.0, (stylePoints - rankInfo.minPts) / 20.0));
    drawPC98Box(LCD_W - 122, 4, 106, 24, styleRankIdx >= 2 ? rankInfo.col : '#8fb8e6');
    ctx.font = 'bold 8px Consolas, monospace';
    ctx.fillStyle = PAL.NEON_CYAN;
    ctx.fillText('W' + wave + ' FOES:' + String(enemies.length).padStart(2, ' ') + ' K:' + kills, LCD_W - 118, 13);
    const pickTxt = overpowerStacks > 0
      ? ('PWR+' + (overpowerStacks * 5) + '%')
      : ('PK ' + Math.min(12, totalAugmentsPicked) + '/12');
    ctx.fillStyle = swingCombo > 0 ? '#cceeff' : '#8fb8e6';
    ctx.fillText('CMB x' + String(swingCombo).padEnd(2, ' ') + ' ' + pickTxt, LCD_W - 118, 23);

    // 우측 중앙: DMC / 사미라 스타일 대형 알파벳 랭크 엠블럼 (320x170 초경량 스프라이트 + 원형 링 게이지)
    if (!augmentDraftOpen && !gameOver) {
      const cx = 274;
      const cy = 62;
      const ringR = 23;
      const isSRank = styleRankIdx >= 4;

      // 랭크업 탄성 팝업 스케일 / 강등 진동 / 액션 펄스
      let sprScale = 1.24;
      let shakeX = 0, shakeY = 0;
      if (stylePopTimer > 0) {
        const t = stylePopTimer / 0.34;
        if (stylePopDir > 0) {
          sprScale = 1.24 + t * 0.44;
        } else {
          shakeX = Math.round(((Math.floor(performance.now() / 40) & 1) ? 1 : -1) * 3 * t);
          shakeY = Math.round(((Math.floor(performance.now() / 55) & 1) ? 1 : -1) * 2 * t);
        }
      } else if (stylePulseTimer > 0) {
        sprScale = 1.24 + (stylePulseTimer / 0.14) * 0.10;
      } else if (isSRank) {
        // S랭크 각성 미세 고동
        sprScale = 1.26 + Math.sin(simTime * 11.0) * 0.04;
      }

      const rcx = cx + shakeX;
      const rcy = cy + shakeY;

      // 1) 어두운 원형 백플레이트 + 외곽선
      ctx.beginPath();
      ctx.arc(rcx, rcy, ringR + 2, 0, Math.PI * 2);
      ctx.fillStyle = stylePoints > 0 ? 'rgba(10, 14, 30, 0.78)' : 'rgba(10, 14, 30, 0.48)';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = PAL.INDIGO_OUTLINE;
      ctx.stroke();

      // 2) 외곽 트랙 링 + 시계 방향 스타일 랭크 게이지 아크
      ctx.beginPath();
      ctx.arc(rcx, rcy, ringR, 0, Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#1e2948';
      ctx.stroke();

      const arcRatio = isSRank ? Math.max(0.15, rankProgress) : rankProgress;
      if (arcRatio > 0.01) {
        ctx.beginPath();
        ctx.arc(rcx, rcy, ringR, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * arcRatio);
        ctx.lineWidth = 3;
        ctx.strokeStyle = rankInfo.col;
        ctx.stroke();
      }

      // 3) 내부 콤보 유지 타이머 얇은 링 (시간 감쇠 직관 표시)
      if (comboTimer > 0 && stylePoints > 0) {
        const holdRatio = Math.max(0.0, Math.min(1.0, comboTimer / 4.6));
        ctx.beginPath();
        ctx.arc(rcx, rcy, ringR - 4, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * holdRatio);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = isSRank ? PAL.CRIMSON : '#cceeff';
        ctx.stroke();
      }

      // 4) 랭크업 순간 6방향 방사형 벡터 버스트 라인
      if (stylePopTimer > 0 && stylePopDir > 0) {
        const burstProg = 1.0 - (stylePopTimer / 0.34);
        const rIn = ringR + 2 + burstProg * 4;
        const rOut = ringR + 8 + burstProg * 8;
        ctx.strokeStyle = rankInfo.col;
        ctx.lineWidth = 1.5;
        for (let bi = 0; bi < 6; bi++) {
          const ang = (bi / 6) * Math.PI * 2 + 0.35;
          ctx.beginPath();
          ctx.moveTo(rcx + Math.cos(ang) * rIn, rcy + Math.sin(ang) * rIn);
          ctx.lineTo(rcx + Math.cos(ang) * rOut, rcy + Math.sin(ang) * rOut);
          ctx.stroke();
        }
      }

      // 5) S랭크 전용 불꽃 도트 스파크 글린트 (ESP32-S3 초경량 fillRect)
      if (isSRank) {
        const tickPhase = Math.floor(performance.now() / 110);
        for (let si = 0; si < 4; si++) {
          const ang = ((tickPhase * 0.45) + si * (Math.PI * 0.5));
          const sx = Math.round(rcx + Math.cos(ang) * (ringR + 3));
          const sy = Math.round(rcy + Math.sin(ang) * (ringR + 3));
          ctx.fillStyle = ((tickPhase + si) & 1) ? PAL.GOLD : PAL.ORANGE;
          ctx.fillRect(sx - 1, sy - 1, 2, 2);
        }
      }

      // 6) 사전 베이크 28x32 DMC/사미라 샤프 세리프 픽셀 알파벳 스프라이트 블릿
      const rSpr = styleRankSprites[styleRankIdx];
      if (rSpr) {
        const dw = Math.round(rSpr.width * sprScale);
        const dh = Math.round(rSpr.height * sprScale);
        ctx.drawImage(rSpr, Math.round(rcx - dw * 0.5), Math.round(rcy - dh * 0.5 + 1), dw, dh);
      }

      // 7) 엠블럼 하단 스타일 태그라인(DISMAL/CRAZY!/BADASS!/AMAZING!/SAVAGE!!) & 화력 배율 뱃지
      ctx.textAlign = 'center';
      const wordTxt = rankInfo.word || ('RANK ' + rankInfo.label);
      ctx.font = 'bold 8px Consolas, monospace';
      const wBoxW = 58;
      const wBoxX = cx - (wBoxW >> 1);
      ctx.fillStyle = '#0c1228';
      ctx.fillRect(wBoxX, 88, wBoxW, 11);
      ctx.strokeStyle = styleRankIdx >= 2 ? rankInfo.col : '#475569';
      ctx.lineWidth = 1;
      ctx.strokeRect(wBoxX + 0.5, 88.5, wBoxW - 1, 10);
      ctx.fillStyle = rankInfo.col;
      ctx.fillText(wordTxt, cx, 96);

      // 화력 배율 뱃지 (고수 보상 직관 확인)
      const dmgTxt = 'DMG ' + rankInfo.dmgMult.toFixed(2) + 'x';
      ctx.fillStyle = '#0c1228';
      ctx.fillRect(wBoxX, 100, wBoxW, 10);
      ctx.strokeStyle = isSRank ? PAL.GOLD : '#334155';
      ctx.strokeRect(wBoxX + 0.5, 100.5, wBoxW - 1, 9);
      ctx.font = 'bold 7.5px Consolas, monospace';
      ctx.fillStyle = styleRankIdx >= 1 ? '#ffffff' : '#94a3b8';
      ctx.fillText(dmgTxt, cx, 108);
      ctx.textAlign = 'left';

      drawActiveAugmentsHUD(totalSpeed, isSwinging);
    }

    for (let i = 0; i < popups.length; i++) {
      const pop = popups[i];
      ctx.font = 'bold 10px Consolas, monospace';
      const tw = ctx.measureText(pop.text).width;
      const pyText = 60 + i * 14;
      drawPC98Box((LCD_W * 0.5 - tw * 0.5 - 5) | 0, pyText - 10, (tw + 10) | 0, 13, pop.color);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, (LCD_W * 0.5 - tw * 0.5) | 0, pyText);
    }

    drawPC98Box(LCD_W - 11, 18, 7, 134, '#b8e4ff');
    ctx.fillStyle = PAL.CRIMSON;
    ctx.fillRect(LCD_W - 10, 141, 5, 10);
    const trackEnemy = strikeTarget || homingTarget;
    if (trackEnemy) {
      const eAltY = 149 - Math.min(1.0, trackEnemy.y / GAME_MAX_ALTITUDE) * 127;
      ctx.fillStyle = PAL.NEON_PINK;
      ctx.fillRect(LCD_W - 12, (eAltY - 1) | 0, 9, 3);
    }
    const altY = 149 - Math.min(1.0, py / GAME_MAX_ALTITUDE) * 127;
    ctx.fillStyle = PAL.INDIGO_OUTLINE;
    ctx.fillRect(LCD_W - 13, (altY - 3) | 0, 11, 6);
    ctx.fillStyle = py < 24 ? PAL.GOLD : (py >= 300 ? PAL.NEON_CYAN : '#b8e4ff');
    ctx.fillRect(LCD_W - 12, (altY - 2) | 0, 9, 4);
  }

  // Step 2 오프닝 시네마틱 오버레이 & 자유낙하 스윙 타이밍 안내
  if (!gameOver && !augmentDraftOpen) {
    if (openingPhase === 'ROOF_WAIT') {
      drawPC98Box(74, 16, 172, 16, PAL.GOLD);
      ctx.textAlign = 'center';
      ctx.font = 'bold 9.5px Consolas, monospace';
      ctx.fillStyle = PAL.GOLD;
      ctx.fillText('SPIDER 3D · MANHATTAN', LCD_W * 0.5, 27);

      if (Math.floor(performance.now() / 460) & 1) {
        drawPC98Box(54, LCD_H - 32, 212, 16, PAL.NEON_CYAN);
        ctx.font = 'bold 9px Consolas, monospace';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('PRESS ANY BUTTON TO START', LCD_W * 0.5, LCD_H - 21);
      }
      ctx.textAlign = 'left';
    } else if (openingPhase === 'DROP_CATCH') {
      ctx.textAlign = 'center';
      if (py <= 95.0) {
        const fastBlink = (Math.floor(performance.now() / 130) & 1) === 0;
        const borderCol = fastBlink ? PAL.GOLD : PAL.CRIMSON;
        drawPC98Box(62, LCD_H - 42, 196, 26, borderCol);
        ctx.font = 'bold 10.5px Consolas, monospace';
        ctx.fillStyle = fastBlink ? PAL.GOLD : '#ffffff';
        ctx.fillText('[ LAST CHANCE! SWING!! ]', LCD_W * 0.5, LCD_H - 29);
        ctx.font = 'bold 7.5px Consolas, monospace';
        ctx.fillStyle = PAL.CRIMSON;
        ctx.fillText('DAREBLITZ BONUS · SPACE / SWING', LCD_W * 0.5, LCD_H - 19);
      } else if (py <= 200.0) {
        const blink = (Math.floor(performance.now() / 220) & 1) === 0;
        drawPC98Box(78, LCD_H - 40, 164, 24, blink ? PAL.NEON_CYAN : '#ffffff');
        ctx.font = 'bold 10.5px Consolas, monospace';
        ctx.fillStyle = blink ? PAL.NEON_CYAN : '#ffffff';
        ctx.fillText('[ SWING NOW! ]', LCD_W * 0.5, LCD_H - 27);
        ctx.font = 'bold 7.5px Consolas, monospace';
        ctx.fillStyle = '#cceeff';
        ctx.fillText('PRESS SPACE / SWING BTN', LCD_W * 0.5, LCD_H - 18);
      } else {
        drawPC98Box(96, LCD_H - 32, 128, 15, '#68b0f0');
        ctx.font = 'bold 8.5px Consolas, monospace';
        ctx.fillStyle = '#b8e4ff';
        ctx.fillText('GET READY TO SWING...', LCD_W * 0.5, LCD_H - 22);
      }
      ctx.textAlign = 'left';
    }
  }

  if (augmentDraftOpen) {
    drawAugmentDraftUI(drawPC98Box);
  }

  if (gameOver) {
    ctx.fillStyle = runCleared ? 'rgba(10, 18, 36, 0.66)' : 'rgba(10, 14, 30, 0.62)';
    ctx.fillRect(0, 0, LCD_W, LCD_H);

    const bw = 224, bh = 106;
    const bx = (LCD_W - bw) >> 1, by = (LCD_H - bh) >> 1;
    drawPC98Box(bx, by, bw, bh, runCleared ? PAL.GOLD : PAL.CRIMSON);
    ctx.strokeStyle = runCleared ? PAL.NEON_CYAN : PAL.GOLD;
    ctx.strokeRect(bx + 2.5, by + 2.5, bw - 5, bh - 5);

    ctx.textAlign = 'center';
    ctx.font = 'bold 13px Consolas, monospace';
    ctx.fillStyle = runCleared ? PAL.GOLD : PAL.CRIMSON;
    ctx.fillText(runCleared ? 'RUN CLEAR!!' : (gameOverReason || 'SYSTEM DOWN!'), LCD_W * 0.5, by + 20);

    const peakInfo = STYLE_RANKS[peakStyleRankIdx] || STYLE_RANKS[0];
    ctx.font = 'bold 9px Consolas, monospace';
    ctx.fillStyle = '#ffffff';
    if (runCleared) {
      ctx.fillText('BOSS TIME: ' + formatRunTimer(bossBattleTime) + '   WAVE: ' + wave, LCD_W * 0.5, by + 38);
    } else if (bossActive && bossEntity) {
      const remPct = Math.max(1, Math.ceil((bossEntity.hp / Math.max(1, bossEntity.maxHp)) * 100));
      ctx.fillText('BOSS HP LEFT: ' + remPct + '%   STAGE: P' + bossStage, LCD_W * 0.5, by + 38);
    } else {
      ctx.fillText('TIME LEFT: ' + formatRunTimer(runTimeRemaining) + '   WAVE: ' + wave, LCD_W * 0.5, by + 38);
    }
    ctx.fillStyle = PAL.NEON_CYAN;
    ctx.fillText('LV.' + playerLevel + ' (' + Math.min(12, totalAugmentsPicked) + '/12)   KILLS: ' + kills, LCD_W * 0.5, by + 53);
    ctx.fillStyle = peakInfo.col;
    const pwrSuffix = overpowerStacks > 0 ? ('  PWR+' + (overpowerStacks * 5) + '%') : '';
    ctx.fillText('PEAK RANK: ' + peakInfo.label + pwrSuffix, LCD_W * 0.5, by + 68);

    if (Math.floor(performance.now() / 420) & 1) {
      ctx.font = 'bold 9px Consolas, monospace';
      ctx.fillStyle = PAL.GOLD;
      ctx.fillText(runCleared ? 'PRESS SPACE / TAP TO PLAY AGAIN' : 'PRESS SPACE / TAP TO RETRY', LCD_W * 0.5, by + 92);
    }
    ctx.textAlign = 'left';
  }

  if (scanlineOn && scanlinePattern) {
    ctx.fillStyle = scanlinePattern;
    ctx.fillRect(0, 0, LCD_W, LCD_H);
  }

}
