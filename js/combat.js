'use strict';
// Spider 3D — 3-Case STRIKE, Speed Scaling, Enemy AI & Combat Engine

// Unified Enemy Damage & Kill Handler (Supports 3 Tiers, Damage Numbers, Pure Fixed XP & Domino Chain!)
function applyEnemyDamage(e, dmg, col, isCrit = false, dominoDepth = 0, showOneShot = false) {
  const idx = enemies.indexOf(e);
  if (idx === -1) return false;

  if (e.isBoss) {
    if (bossPhase === 'INTRO' || bossPhase === 'DEFEATED') return false;
    let bossMult = 1.0;
    let bossCrit = isCrit;
    if (bossPhase === 'EVADE') {
      bossMult = 0.50;
    } else if (bossPhase === 'GROGGY') {
      bossMult = 1.65;
      bossCrit = true;
    }
    const finalDmg = Math.max(1, Math.round(dmg * bossMult));
    e.hp = Math.max(0, e.hp - finalDmg);
    e.hitFlash = 0.24;
    e.lastDealtDmg = finalDmg;
    spawnDamageNumber(e.x, e.y + 8.0, e.z, finalDmg, bossPhase === 'GROGGY' ? PAL.GOLD : col, bossCrit);

    // 페이즈 2 전환 (HP 50% 이하 -> OVERDRIVE)
    if (bossStage === 1 && e.hp > 0 && e.hp <= e.maxHp * 0.5) {
      bossStage = 2;
      projectiles = [];
      shakeMag = Math.max(shakeMag, 6.0);
      shockwaves.push({ x: e.x, y: e.y, z: e.z, r: 10, maxR: 150, life: 0.45, maxLife: 0.45, col: PAL.CRIMSON });
      spawnExplosion(e.x, e.y, e.z, PAL.CRIMSON, PAL.GOLD, 32);
      addPopup('PHASE 2: OVERDRIVE!!', PAL.CRIMSON, 3);
    }

    // 보스 격파 -> 1.1초 연쇄 폭발 컷신 후 RUN CLEAR!
    if (e.hp <= 0) {
      bossDeathX = e.x;
      bossDeathY = e.y;
      bossDeathZ = e.z;
      bossPhase = 'DEFEATED';
      bossPhaseTimer = BOSS_DEATH_DURATION;
      bossDeathBoomTimer = 0.0;
      enemies = [];
      projectiles = [];
      bossMines = [];
      bossBombZones = [];
      bossSkyRings = [];
      bossSweep = null;
      bossPatternType = 'NONE';
      bossPatternStage = 'IDLE';
      bossPlayerInDanger = false;
      lassoTargets = [];
      bossEntity = null;
      bossPulseState = 'IDLE';
      clearStrikeState();
      kills++;
      hitStopTimer = 0.14;
      shakeMag = 8.0;
      spawnExplosion(bossDeathX, bossDeathY, bossDeathZ, PAL.GOLD, PAL.CRIMSON, 48);
      shockwaves.push({ x: bossDeathX, y: bossDeathY, z: bossDeathZ, r: 12, maxR: 185, life: 0.55, maxLife: 0.55, col: PAL.GOLD });
      addPopup('OMEGA SOVEREIGN DOWN!!', PAL.GOLD, 3);
      if (typeof playSfx === 'function') playSfx('boss_clear');
      return true;
    }

    spawnSparks(e.x, e.y, e.z, bossPhase === 'GROGGY' ? PAL.GOLD : col, 8, 28);
    if (typeof playSfx === 'function') {
      const bSfx = bossCrit ? 'hit_crit' : ((finalDmg >= 65 || strikeMode === 1) ? 'hit_heavy' : 'hit');
      playSfx(bSfx, bossPhase === 'GROGGY' ? 1.18 : 0.94);
    }
    return false;
  }

  const wasFullHp = (e.hp >= e.maxHp);
  const finalDmg = Math.max(1, Math.round(dmg));
  e.hp -= finalDmg;
  e.hitFlash = 0.22;
  spawnDamageNumber(e.x, e.y, e.z, finalDmg, col, isCrit);

  if (e.hp <= 0) {
    enemies.splice(idx, 1);
    const lassoIdx = lassoTargets.indexOf(e);
    if (lassoIdx !== -1) lassoTargets.splice(lassoIdx, 1);
    kills++;
    multiKillCount++;
    multiKillWindow = 0.65;

    // 티어별 회복량(Track 4 절반 하향), 스타일 포인트, 고정 경험치(1.0x 고정) 지급
    const heal = e.tier === 'ELITE' ? 6 : (e.tier === 'MEDIUM' ? 2 : 1);
    hp = Math.min(MAX_HP, hp + heal);

    const killStyle = e.tier === 'ELITE' ? 20 : (e.tier === 'MEDIUM' ? 10 : 3);
    addStylePoints(killStyle, 4.4);

    const earnedXp = e.tier === 'ELITE' ? 135 : (e.tier === 'MEDIUM' ? 46 : 15);
    gainXp(earnedXp);

    const expColA = e.tier === 'ELITE' ? PAL.GOLD
      : (e.type === 'SKY_CORE' ? PAL.NEON_PINK
      : (e.type === 'WALL_TURRET' ? PAL.CRIMSON : PAL.NEON_CYAN));
    spawnExplosion(e.x, e.y, e.z, expColA, PAL.GOLD, e.tier === 'ELITE' ? 34 : (e.tier === 'SWARM' ? 12 : 22));
    if (typeof playSfx === 'function') playSfx('enemy_kill', e.tier === 'ELITE' ? 0.85 : (e.tier === 'SWARM' ? 1.2 : 1.0));

    if (e.tier === 'ELITE') {
      shakeMag = Math.max(shakeMag, 5.5);
      addPopup('ELITE DOWN!! +' + earnedXp + 'XP', PAL.GOLD, 3);
    } else if (showOneShot && wasFullHp && e.tier === 'MEDIUM') {
      addPopup('ONE-SHOT!! +' + earnedXp + 'XP', PAL.GOLD, 3);
    } else if (multiKillCount >= 3) {
      addPopup('MULTI KILL x' + multiKillCount + '!!', PAL.NEON_CYAN, 3);
    }

    // [도미노 폭발]: Lv.1~3 단계별 반경/피해/연쇄 횟수 + Lv.3 연쇄당 +20% 증폭
    const dSpec = getDominoSpec();
    if (dSpec && dominoDepth < dSpec.maxDepth) {
      const ampMult = 1.0 + dominoDepth * dSpec.depthAmp;
      pendingExplosions.push({
        x: e.x, y: e.y, z: e.z,
        radius: dSpec.radius,
        dmg: Math.round(dSpec.dmg * ampMult),
        col: dominoDepth % 2 === 0 ? PAL.ORANGE : PAL.GOLD,
        delay: 0.07,
        depth: dominoDepth + 1
      });
    }
    return true;
  } else {
    spawnSparks(e.x, e.y, e.z, col, 6, 22);
    if (typeof playSfx === 'function') {
      const hSfx = isCrit ? 'hit_crit' : ((finalDmg >= 65 || strikeMode === 1) ? 'hit_heavy' : 'hit');
      playSfx(hSfx, 0.96 + Math.min(0.32, finalDmg / 200));
    }
    return false;
  }
}

// 광역 충격파 헬퍼 (초중력 C1 / 마찰 과열 / 탄성 반발 / 도미노 폭발 / 낙하 운동량 공용)
function triggerShockwave(cx, cy, cz, radius, dmg, col, ignoreEnemy = null, dominoDepth = 0) {
  shockwaves.push({ x: cx, y: cy, z: cz, r: 5, maxR: radius, life: 0.34, maxLife: 0.34, col });
  if (typeof playSfx === 'function') playSfx('shockwave');
  clearProjectilesInRadius(cx, cy, cz, radius, col);

  const targets = [];
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (e === ignoreEnemy) continue;
    if (Math.hypot(e.x - cx, e.y - cy, e.z - cz) <= radius + e.radius * 0.5) {
      targets.push(e);
    }
  }
  for (let i = 0; i < targets.length; i++) {
    applyEnemyDamage(targets[i], dmg, col, false, dominoDepth, false);
  }
}


// =========================================================================
// 5. MANUAL 2-CASE STRIKE SYSTEM, TARGET SCANNER & OBSTACLE PROBE
// =========================================================================
function classifyStrikeCase() {
  const spd = Math.hypot(vx, vy, vz);
  if (py >= CASE1_MIN_ALTITUDE && vy < -22.0 && (spd >= 52.0 || vy < -34.0 || diveCharge >= 0.25)) {
    return 1;
  }
  return 3;
}

function getCase3FreezeDuration(spd) {
  if (spd >= STRIKE_NO_FREEZE_SPEED) return 0.0;
  const t = Math.max(0, Math.min(1, (spd - CASE3_MIN_SPEED) / (STRIKE_NO_FREEZE_SPEED - CASE3_MIN_SPEED)));
  return CASE3_MAX_FREEZE_DUR - (CASE3_MAX_FREEZE_DUR - CASE3_MIN_FREEZE_DUR) * t;
}

// 전 STRIKE 공용 속도 데미지 스케일링 (상한 캡 없음: 저속 SHIFT 난타 억제 + 초고속 무한 확장)
// SPD 0~45: 0.70x~1.00x / SPD 45~95: 1.00x~3.20x / SPD 95+: +0.028x per SPD
function getSpeedDamageMult(spd) {
  const s = Math.max(0.0, spd);
  if (s <= 45.0) {
    return 0.70 + (s / 45.0) * 0.30;
  }
  if (s <= 95.0) {
    const t = (s - 45.0) / 50.0;
    return 1.00 + Math.pow(t, 1.35) * 2.20;
  }
  return 3.20 + (s - 95.0) * 0.028;
}

// 전 STRIKE(Case1/Case2/Case3/핀볼) 통합 속도·스타일 랭크 데미지 중앙 계산 (타격 판정 및 1-HIT 예고 공용)
function computeStrikeDamage(mode, entrySpd, entryDist, downVy, isChain, impactSpd = 0, chainTargetMult = 1.0) {
  const aug = getAugStats();
  const rankInfo = STYLE_RANKS[styleRankIdx] || STYLE_RANKS[0];
  let rawDmg = 26.0;
  let skillMult = 1.0;
  let isCrit = false;

  if (mode === 1) {
    // Case 1 (SLAM!): 고고도 저속 진입 후 낙하 가속하므로 적중 직전 실제 속도(impactSpd/fallSpd) 기준 적용
    const fallSpd = Math.max(24.0, downVy, peakFallSpeed);
    const liveSpd = impactSpd > 0 ? impactSpd : entrySpd;
    const effSpd = Math.max(liveSpd, fallSpd * 1.15);
    rawDmg = 26.0 * getSpeedDamageMult(effSpd) * (1.15 + diveCharge * 0.25);
    isCrit = effSpd >= 92.0 || getLv('heavy_suit') >= 3;
  } else if (isChain) {
    // 연쇄 핀볼: 진입 속도 비례 스케일링 적용 (Lv.1~3 기본 계수 16/22/28)
    const cSpec = getChainSpec();
    const baseChain = cSpec ? cSpec.baseDmg : 16.0;
    rawDmg = baseChain * getSpeedDamageMult(entrySpd);
    if (entrySpd >= 95.0) isCrit = true;
  } else {
    // Case 2 / Case 3: Shift 직전 진짜 속도(entrySpd) 기준 통합 속도 배율 적용 (저속 SHIFT 난타 18~26 dmg)
    rawDmg = 26.0 * getSpeedDamageMult(entrySpd);
    if (entrySpd >= 95.0) isCrit = true;
    if (entryDist >= 75.0) {
      skillMult *= 1.15;
    }
  }

  // 초반 노증강 실력 기술 화력 보너스 (퍼펙트 릴리즈 / 벽·바닥 스침 직후 타격)
  if (perfectBuffTimer > 0) {
    skillMult *= 1.35;
    isCrit = true;
  }
  if (skimTechTimer > 0) {
    skillMult *= 1.25;
  }

  // 스타일 랭크 화력 배율 (D:1.00x / C:1.10x / B:1.22x / A:1.38x / S:1.60x)
  rawDmg *= skillMult * rankInfo.dmgMult * aug.baseDmgMult;
  if (styleRankIdx >= 4) isCrit = true;

  // [체공 예열]: 순수 단일 STRIKE 극딜 (광역 충격파 제거)
  const airSpec = getAirHeatSpec();
  if (airSpec && airTimeStack > 0.25) {
    const effAir = Math.min(airSpec.maxSec, airTimeStack);
    rawDmg *= (1.0 + effAir * airSpec.perSec);
    if (airSpec.fullCrit && effAir >= (airSpec.maxSec - 0.5)) isCrit = true;
  }

  // [낙하 운동량]: 직전 최대 하강 속도 비례 증폭 (Lv.1~3: +45% / +85% / +140%)
  const fallSpec = getFallMomSpec();
  if (fallSpec && peakFallSpeed > 22.0) {
    const fallRatio = Math.min(1.0, (peakFallSpeed - 22.0) / 68.0);
    rawDmg *= (1.0 + fallRatio * fallSpec.maxBonus);
    if (peakFallSpeed > 80.0) isCrit = true;
  }

  // [연속 돌격]: 저스트 리듬 체인 / 연쇄 핀볼 스택 비례 증폭 + 타겟 전환/동일 표적 보정
  const rushSpec = getStrikeRushSpec();
  if (rushSpec && strikeRushStack > 0 && strikeRushTimer > 0) {
    rawDmg *= (1.0 + strikeRushStack * rushSpec.dmgPerStack);
    if (strikeRushStack >= rushSpec.critAt) isCrit = true;
  }
  if (chainTargetMult !== 1.0 && !isChain) {
    rawDmg *= chainTargetMult;
  }

  // [탄성 반발 Lv.3 각성]: 벽 반사 후 2.5초 내 다음 STRIKE 치명타(1.35x)
  if (elasticCritTimer > 0) {
    rawDmg *= 1.35;
    isCrit = true;
  }

  // [올가미 스윙 Lv.2~3]: 포획된 적 무게만큼 STRIKE 본타 피해 증폭
  const lassoSpec = getLassoSpec();
  if (lassoSpec && lassoTargets.length > 0 && lassoSpec.hitMultPer > 0) {
    rawDmg *= (1.0 + lassoTargets.length * lassoSpec.hitMultPer);
    if (lassoTargets.length >= lassoSpec.awakenCount) isCrit = true;
  }

  return {
    dmg: Math.max(10, Math.round(rawDmg)),
    isCrit: isCrit
  };
}

function findCase1Target() {
  if (enemies.length === 0) return null;
  const aug = getAugStats();
  const maxDist = 275.0 * aug.lockRangeMult;
  const minVelDot = Math.max(0.22, 0.48 - aug.lockDotBonus);
  const minFwdDot = Math.max(0.18, 0.38 - aug.lockDotBonus);

  const spd = Math.hypot(vx, vy, vz) || 1.0;
  const dvx = vx / spd, dvy = vy / spd, dvz = vz / spd;
  const sinY = Math.sin(camLagYaw), cosY = Math.cos(camLagYaw);

  let best = null;
  let bestScore = 99999;
  for (const e of enemies) {
    if (lassoTargets.indexOf(e) !== -1) continue;
    const dx = e.x - px, dy = e.y - py, dz = e.z - pz;
    const dist = Math.hypot(dx, dy, dz);
    if (dist > maxDist || dist < 4.0) continue;
    if (dy > 16.0) continue;

    const hDist = Math.hypot(dx, dz) || 1.0;
    const nx = dx / dist, ny = dy / dist, nz = dz / dist;
    const velDot = nx * dvx + ny * dvy + nz * dvz;
    const fwdDot = (dx * sinY + dz * cosY) / hDist;

    // 고공 급강하 시 바로 발밑 원뿔 구간은 수평 fwdDot 흔들림 없이 자연스럽게 포착
    const inUnderCone = (dy < -10.0 && hDist < Math.max(48.0, -dy * 0.72));
    if (inUnderCone) {
      if (velDot < Math.max(0.26, minVelDot - 0.14)) continue;
    } else {
      if (velDot < minVelDot || fwdDot < minFwdDot) continue;
    }

    const sc = dist + (1.0 - velDot) * 185.0 - (inUnderCone ? 24.0 : 0) - (e.tier === 'ELITE' ? 28.0 : 0);
    if (sc < bestScore) {
      bestScore = sc;
      best = e;
    }
  }
  return best;
}

function findBestLockTarget() {
  if (enemies.length === 0) return null;
  const aug = getAugStats();
  const maxDist = 255.0 * aug.lockRangeMult;
  const minFwdDot = Math.max(0.16, 0.36 - aug.lockDotBonus);

  const sinY = Math.sin(camLagYaw), cosY = Math.cos(camLagYaw);
  let best = null;
  let bestScore = 99999;

  for (const e of enemies) {
    if (lassoTargets.indexOf(e) !== -1) continue;
    const dx = e.x - px, dy = e.y - py, dz = e.z - pz;
    const dist = Math.hypot(dx, dy, dz);
    if (dist > maxDist || dist < 3.0) continue;

    const hDist = Math.hypot(dx, dz) || 1.0;
    const forwardDot = (dx * sinY + dz * cosY) / hDist;
    if (forwardDot < minFwdDot) continue;

    const alignPenalty = (1.0 - forwardDot) * 180.0;
    const altPenalty = Math.abs(dy) * 0.22;
    const sc = dist + alignPenalty + altPenalty;
    if (sc < bestScore) {
      bestScore = sc;
      best = e;
    }
  }
  return best;
}

// 연쇄 핀볼 다음 타겟 탐색 (Lv.1: 95m / Lv.2: 120m / Lv.3: 150m 내 가장 가까운 적)
function findNextChainTarget(fromX, fromY, fromZ, visited, maxRadius = 0) {
  const cSpec = getChainSpec();
  let best = null;
  let minDist = maxRadius > 0 ? maxRadius : (cSpec ? cSpec.radius : 95.0);
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (visited.indexOf(e) !== -1) continue;
    const d = Math.hypot(e.x - fromX, e.y - fromY, e.z - fromZ);
    if (d < minDist) {
      minDist = d;
      best = e;
    }
  }
  return best;
}

function hasObstacleBehindTarget(target, dirX, dirY, dirZ, bList) {
  const steps = [8.0, 16.0, 24.0, 34.0, 44.0];
  for (let i = 0; i < steps.length; i++) {
    const d = steps[i];
    const tx = target.x + dirX * d;
    const ty = target.y + dirY * d;
    const tz = target.z + dirZ * d;
    if (ty < 10.0) return true;
    for (let j = 0; j < bList.length; j++) {
      const b = bList[j];
      if (ty < b.bh + 4.0) {
        const hw = b.bw * 0.5 + 6.5;
        const hd = b.bd * 0.5 + 6.5;
        if (tx > b.bx - hw && tx < b.bx + hw && tz > b.bz - hd && tz < b.bz + hd) {
          return true;
        }
      }
    }
  }
  return false;
}

// [올가미 스윙] 전원 포획 또는 전방 락온 부재 시 즉시 전방 자가 기폭 (소프트락 해소)
let _lassoAllTiedNotified = false;

function detonateLassoSelf(cdMult, overReset) {
  const lassoSpec = getLassoSpec();
  if (!lassoSpec || lassoTargets.length === 0) return false;

  const tiedSnap = lassoTargets.slice();
  lassoTargets = [];
  _lassoAllTiedNotified = false;
  const tiedCount = tiedSnap.length;

  let lassoPtsSnap = null;
  if (tiedCount >= 6 && getLv('lasso_swing') >= 3) {
    lassoPtsSnap = [];
    for (let k = 0; k < tiedSnap.length; k++) {
      lassoPtsSnap.push({ x: tiedSnap[k].x, y: tiedSnap[k].y, z: tiedSnap[k].z });
    }
  }

  const fSin = Math.sin(camYaw), fCos = Math.cos(camYaw);
  const detX = px + fSin * 16.0;
  const detY = Math.max(8.0, py + 1.5);
  const detZ = pz + fCos * 16.0;

  isSwinging = false;
  inPerfectWindow = false;
  isGliding = false;
  isDiving = false;
  autoCatchAfterJump = false;
  strikeCooldown = overReset ? 0.0 : (0.28 * cdMult);
  strikeGraceTimer = Math.max(strikeGraceTimer, 0.20);

  const awakened = tiedCount >= lassoSpec.awakenCount;
  const boomR = (52.0 + tiedCount * 7.0) * (awakened ? 1.5 : 1.0);
  const boomDmg = Math.round(tiedCount * lassoSpec.detonatePer * (awakened ? 1.35 : 1.0));
  const boomCol = awakened ? PAL.GOLD : '#a78bfa';

  for (let k = 0; k < tiedSnap.length; k++) {
    const te = tiedSnap[k];
    if (enemies.indexOf(te) === -1) continue;
    te.x = detX + (Math.random() - 0.5) * 6.0;
    te.y = detY + (Math.random() - 0.5) * 6.0;
    te.z = detZ + (Math.random() - 0.5) * 6.0;
    applyEnemyDamage(te, boomDmg, boomCol, awakened, 0, false);
  }

  triggerShockwave(detX, detY, detZ, Math.min(160.0, boomR), boomDmg, boomCol, null, 0);
  spawnExplosion(detX, detY, detZ, awakened ? PAL.GOLD : '#d8b4fe', '#ffffff', awakened ? 22 : 14);
  vy = Math.max(vy, awakened ? 46.0 : 28.0);
  shakeMag = Math.max(shakeMag, awakened ? 6.0 : 4.2);
  addPopup('LASSO SNAP BOOM x' + tiedCount + '!!', awakened ? PAL.GOLD : '#d8b4fe', 3);

  if (tiedCount >= 6 && getLv('lasso_swing') >= 3) {
    const apexTriggered = tryTriggerApexCut('lasso_swing', {
      targetPt: { x: detX, y: detY, z: detZ },
      lassoPts: lassoPtsSnap
    });
    if (apexTriggered) hitStopTimer = 0.0;
  }
  return true;
}

function onStrikePress() {
  if (augmentDraftOpen) { confirmAugment(draftCursor); return; }
  if (gameOver) { resetGame(); return; }
  if (handleOpeningAnyInput()) return;
  if (isOpeningActive()) return;
  if (isApexInputLocked()) return;
  if (strikeMode !== 0) return;

  const aug = getAugStats();
  const rushSpec = getStrikeRushSpec();
  const totalSpd = Math.hypot(vx, vy, vz);
  const overReset = (getLv('overdrive') >= 3 && totalSpd >= 115.0);

  // [Track 3] 공중 2회전 텀블링 리커버리 중 STRIKE 봉인 (연속 돌격 저스트 리듬 창 0.20~0.46s만 캔슬 허용)
  let pendingJustChain = false;
  if (strikeTumbleTimer > 0 && !overReset) {
    if (rushSpec && justChainElapsed >= 0.0) {
      if (justChainElapsed < JUST_CHAIN_MIN) {
        // 조기 광클 페널티: 스택 초기화 + 리커버리 연장
        strikeRushStack = 0;
        strikeRushTimer = 0.0;
        justChainElapsed = -1.0;
        strikeTumbleTimer = Math.min(2.0, strikeTumbleTimer + 0.35);
        strikeTumbleDur = Math.max(strikeTumbleDur, strikeTumbleTimer);
        addPopup('TOO EARLY!', PAL.CRIMSON, 2);
        if (typeof playSfx === 'function') playSfx('hit');
        return;
      }
      if (justChainElapsed <= JUST_CHAIN_MAX) {
        pendingJustChain = true;
      } else {
        return;
      }
    } else {
      return;
    }
  } else {
    if (strikeCooldown > 0 && !overReset) return;
    if (rushSpec && justChainElapsed >= JUST_CHAIN_MIN && justChainElapsed <= JUST_CHAIN_MAX) {
      pendingJustChain = true;
    }
  }

  const cdMult = rushSpec ? rushSpec.cdMult : 1.0;
  const caseType = classifyStrikeCase();

  const commitJustChain = (tgt) => {
    strikeTumbleTimer = 0.0;
    doingFlip = false;
    flipAngle = 0.0;
    justChainElapsed = -1.0;
    if (pendingJustChain && rushSpec) {
      strikeIsJustChain = true;
      strikeRushStack = Math.min(rushSpec.maxStack, strikeRushStack + 1);
      strikeRushTimer = 2.8;
      justChainParryTimer = 0.18;
      justChainFlashTimer = 0.26;
      const switched = (justChainLastTarget !== null && tgt !== null && tgt !== justChainLastTarget);
      const sameTgt = (justChainLastTarget !== null && tgt !== null && tgt === justChainLastTarget);
      justChainTargetMult = switched ? 1.15 : (sameTgt ? 0.75 : 1.0);
      addPopup(
        switched ? 'JUST SWITCH!! +15%' : (sameTgt ? 'JUST CHAIN! -25%' : 'JUST CHAIN!!'),
        switched ? PAL.GOLD : PAL.NEON_CYAN,
        2
      );
      if (typeof playSfx === 'function') playSfx('perfect_release');
    } else {
      strikeIsJustChain = false;
      justChainTargetMult = 1.0;
    }
  };

  chainBouncesLeft = getChainBounceCount();
  chainVisited = [];
  chainPathPts = [];
  isChainRush = false;

  if (caseType === 1) {
    const target = findCase1Target();
    if (!target && lassoTargets.length > 0 && lassoTargets.length >= enemies.length) {
      commitJustChain(null);
      if (detonateLassoSelf(cdMult, overReset)) return;
    }
    commitJustChain(target);
    isSwinging = false;
    inPerfectWindow = false;
    isGliding = false;
    autoCatchAfterJump = false;

    strikeMode = 1;
    strikePhase = 'RUSH';
    strikeTarget = target;
    strikeTimer = 1.25;
    strikeEntrySpd = totalSpd;
    strikeEntryDist = target ? Math.hypot(target.x - px, target.y - py, target.z - pz) : 80.0;
    strikeCooldown = overReset ? 0.0 : (0.25 * cdMult);
    afterimageTimer = 0.7;

    const boost = (18.0 + diveCharge * 28.0) * aug.maxSpeedMult;
    const curSpd = Math.hypot(vx, vy, vz) || 1.0;
    vx += (vx / curSpd) * boost * 0.45;
    vy -= Math.max(18.0, boost * 0.85);
    vz += (vz / curSpd) * boost * 0.45;
    diveCharge = 0;

    shakeMag = Math.max(shakeMag, 2.2);
    spawnSparks(px, py, pz, PAL.ORANGE, 10, 28);
    if (!strikeIsJustChain) {
      addPopup(target ? 'DIVE SLAM LOCK!' : 'METEOR SLAM!', PAL.ORANGE, 2);
    }
    if (typeof playSfx === 'function') playSfx('strike_dive');
    return;
  }

  let target = homingTarget || findBestLockTarget();
  if (target && lassoTargets.indexOf(target) !== -1) {
    target = findBestLockTarget();
  }
  if (!target) {
    if (lassoTargets.length > 0) {
      commitJustChain(null);
      if (detonateLassoSelf(cdMult, overReset)) return;
    }
    addPopup('NO TARGET', '#94a3b8', 1);
    return;
  }

  commitJustChain(target);
  isSwinging = false;
  inPerfectWindow = false;
  isGliding = false;
  isDiving = false;
  autoCatchAfterJump = false;
  strikeCooldown = overReset ? 0.0 : (0.28 * cdMult);
  strikeTarget = target;
  strikeEntrySpd = totalSpd;
  strikeEntryDist = Math.hypot(target.x - px, target.y - py, target.z - pz);

  const freezeDur = getCase3FreezeDuration(totalSpd);
  strikeMode = 3;
  strikeMotionIdx = Math.floor(Math.random() * CARTOON_MOTIONS.length);
  strikeCamSide = Math.random() < 0.5 ? -1 : 1;

  if (freezeDur <= 0.0) {
    strikePhase = 'RUSH';
    strikeWebProg = 1.0;
    strikeTimer = 1.65;
    const dx = target.x - px, dy = target.y - py, dz = target.z - pz;
    const dist = Math.hypot(dx, dy, dz) || 1.0;
    const rushSpd = Math.min(215.0 * aug.maxSpeedMult, Math.max(172.0, totalSpd * 1.18));
    vx = (dx / dist) * rushSpd;
    vy = (dy / dist) * rushSpd;
    vz = (dz / dist) * rushSpd;
    camYaw = Math.atan2(dx, dz);
    flipAngle = 0.0;
    afterimageTimer = 0.85;
    shakeMag = Math.max(shakeMag, 2.8);
    spawnSparks(px, py, pz, PAL.NEON_CYAN, 10, 30);
    spawnSparks(target.x, target.y, target.z, PAL.GOLD, 10, 32);
    if (!strikeIsJustChain) addPopup('HYPER SNAP!!', PAL.NEON_CYAN, 2);
    if (typeof playSfx === 'function') playSfx('strike_hyper');
  } else {
    strikePhase = 'HANG_SHOOT';
    strikePhaseDur = freezeDur;
    strikePhaseTimer = freezeDur;
    strikeWebProg = 0.0;
    strikeTimer = 1.85 + freezeDur;

    vx *= 0.06;
    vy = 0.0;
    vz *= 0.06;

    const dx = target.x - px, dz = target.z - pz;
    camYaw = Math.atan2(dx, dz);

    shakeMag = Math.max(shakeMag, 1.8);
    spawnSparks(px, py, pz, PAL.NEON_PINK, 10, 26);
    if (!strikeIsJustChain) addPopup(CARTOON_MOTIONS[strikeMotionIdx].word, PAL.NEON_PINK, 2);
    if (typeof playSfx === 'function') playSfx('strike_pull');
  }
}


// =========================================================================
// 8. COMBAT ENGINE: SWARM CHASE AI, RANGED KITING TIER 2/3, GIMMICKS & STRIKE
// =========================================================================
function pointToSegmentDist3D(qx, qy, qz, x1, y1, z1, x2, y2, z2) {
  const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
  const lenSq = dx * dx + dy * dy + dz * dz;
  let t = 0;
  if (lenSq > 0.0001) {
    t = ((qx - x1) * dx + (qy - y1) * dy + (qz - z1) * dz) / lenSq;
    t = Math.max(0, Math.min(1, t));
  }
  return Math.hypot(qx - (x1 + dx * t), qy - (y1 + dy * t), qz - (z1 + dz * t));
}

// 1단계(전방 궤도 요격형) / 2~3단계(고도층 분리 + 전방 시야 선회형) 이동 AI 업데이트
function updateEnemyMovementAI(e, dt, bList) {
  e.phase += dt * 1.9;
  if (e.hitFlash > 0) e.hitFlash -= dt;
  if (e.isBoss) return;

  const dxFromP = e.x - px;
  const dyFromP = e.y - py;
  const dzFromP = e.z - pz;
  const dist3D = Math.hypot(dxFromP, dyFromP, dzFromP) || 1.0;

  const hSpd = Math.hypot(vx, vz);
  const camSin = Math.sin(camYaw), camCos = Math.cos(camYaw);
  const moveSin = hSpd > 8.0 ? (vx / hSpd) : camSin;
  const moveCos = hSpd > 8.0 ? (vz / hSpd) : camCos;
  const fwdProj = dxFromP * moveSin + dzFromP * moveCos;

  if (e.tier === 'SWARM') {
    // === 1단계 잡몹: 플레이어 등 뒤가 아닌 진행 방향 전방 궤도로 요격 유입 ===
    if (dist3D > 315.0 || (hSpd > 38.0 && fwdProj < -135.0)) {
      const pullYaw = Math.atan2(moveSin, moveCos) + (Math.random() - 0.5) * 0.95;
      const pullDist = 110.0 + Math.random() * 68.0;
      const targetY = (e.lowBias || py < 42.0)
        ? (15.0 + Math.random() * 32.0)
        : Math.max(18.0, Math.min(240.0, py + (Math.random() - 0.5) * 42.0));
      const safe = pushOutOfBuildings(px + Math.sin(pullYaw) * pullDist, targetY, pz + Math.cos(pullYaw) * pullDist, 12.0, bList);
      e.x = safe.x; e.y = targetY; e.z = safe.z;
      e.vx = 0; e.vy = 0; e.vz = 0;
      return;
    }

    // 멀리 있을수록 진행 방향 앞쪽(리드)으로 가로막고, 가까워지면 본체를 감싸며 조여옴
    const leadBlend = Math.max(0.0, Math.min(1.0, (dist3D - 28.0) / 48.0));
    const leadDist = Math.min(82.0, hSpd * 0.85) * leadBlend;
    const swirlAng = e.flockAngle + e.phase * 0.65;
    const goalX = px + moveSin * leadDist + Math.cos(swirlAng) * e.flockDist;
    const goalZ = pz + moveCos * leadDist + Math.sin(swirlAng) * e.flockDist;
    const baseGoalY = e.lowBias
      ? Math.max(14.0, Math.min(62.0, py * 0.45 + 16.0))
      : Math.max(14.0, Math.min(260.0, py + vy * 0.22));
    const goalY = Math.max(12.0, Math.min(GAME_MAX_ALTITUDE - 30.0, baseGoalY + Math.sin(e.phase * 1.3) * 6.5));

    const gx = goalX - e.x, gy = goalY - e.y, gz = goalZ - e.z;
    const gDist = Math.hypot(gx, gy, gz) || 1.0;

    const baseChaseSpd = 38.0 + Math.min(20.0, wave * 2.4);
    const catchUpBoost = dist3D > 85.0 ? Math.min(48.0, (dist3D - 85.0) * 0.34) : 0.0;
    const chaseSpd = baseChaseSpd + catchUpBoost;

    const desVx = (gx / gDist) * chaseSpd;
    const desVy = (gy / gDist) * chaseSpd;
    const desVz = (gz / gDist) * chaseSpd;

    const steer = Math.min(1.0, 4.2 * dt);
    e.vx += (desVx - e.vx) * steer;
    e.vy += (desVy - e.vy) * steer;
    e.vz += (desVz - e.vz) * steer;

    e.x += e.vx * dt;
    e.y = Math.max(11.0, Math.min(GAME_MAX_ALTITUDE - 20.0, e.y + e.vy * dt));
    e.z += e.vz * dt;

    const safe = pushOutOfBuildings(e.x, e.y, e.z, 9.5, bList);
    e.x = safe.x;
    e.z = safe.z;
  } else {
    // === 2단계(MEDIUM) & 3단계(ELITE): 고도층 분리 + 전방 시야 안쪽 우선 선회 ===
    const anchorY = e.anchorAlt !== undefined ? e.anchorAlt : ((e.altMin + e.altMax) * 0.5);
    if (dist3D > 385.0 || (hSpd > 40.0 && fwdProj < -175.0)) {
      const pullYaw = Math.atan2(moveSin, moveCos) + (Math.random() - 0.5) * 1.15;
      const pullDist = (e.minRange + e.maxRange) * 0.5 + 24.0;
      const targetY = e.type === 'WALL_TURRET'
        ? Math.max(e.altMin, Math.min(e.altMax, anchorY))
        : Math.max(e.altMin, Math.min(e.altMax, py > 135.0 ? Math.min(anchorY + 20.0, py - 24.0) : anchorY));
      const safe = pushOutOfBuildings(px + Math.sin(pullYaw) * pullDist, targetY, pz + Math.cos(pullYaw) * pullDist, 20.0, bList);
      e.x = safe.x; e.y = targetY; e.z = safe.z;
      e.vx = 0; e.vy = 0; e.vz = 0;
      return;
    }

    const hDist = Math.hypot(dxFromP, dzFromP) || 1.0;
    const rx = dxFromP / hDist;
    const rz = dzFromP / hDist;

    // 플레이어 등 뒤로 도망치지 않도록 시야 밖(fwdDot < 0.45)이면 전방 시야 쪽으로 선회 방향 보정
    const fwdDot = rx * camSin + rz * camCos;
    const tDotF = (-rz * e.orbitDir) * camSin + (rx * e.orbitDir) * camCos;
    if (fwdDot < 0.45 && tDotF < 0) {
      e.orbitDir = -e.orbitDir;
    }

    const tx = -rz * e.orbitDir;
    const tz = rx * e.orbitDir;

    let radialSpd = 0.0;
    let strafeSpd = (e.tier === 'ELITE' ? 16.0 : 20.0) * (fwdDot < 0.45 ? 1.45 : 1.0);

    if (hDist < e.minRange) {
      const closeRatio = Math.min(1.0, (e.minRange - hDist) / 55.0);
      radialSpd = 18.0 + closeRatio * 22.0;
      strafeSpd = Math.max(strafeSpd, 18.0);
    } else if (hDist > e.maxRange) {
      const farRatio = Math.min(1.0, (hDist - e.maxRange) / 90.0);
      radialSpd = -(24.0 + farRatio * 36.0);
    }

    // 고도층 분리: WALL_TURRET은 저공(16~68m) 고정, SKY/ELITE는 고공 플레이어 아래에 남아 SLAM 표적 제공
    let baseY;
    if (e.type === 'WALL_TURRET') {
      baseY = anchorY;
    } else if (py > 135.0) {
      baseY = Math.max(e.altMin, Math.min(e.altMax, Math.min(anchorY + 25.0, py - 24.0)));
    } else {
      baseY = Math.max(e.altMin, Math.min(e.altMax, anchorY * 0.65 + (py + e.altOffset) * 0.35));
    }
    const desiredY = baseY + Math.sin(e.phase * 1.05) * 5.0;
    const desVx = rx * radialSpd + tx * strafeSpd;
    const desVz = rz * radialSpd + tz * strafeSpd;
    const desVy = Math.max(-28.0, Math.min(28.0, (desiredY - e.y) * 1.4));

    const steer = Math.min(1.0, 2.8 * dt);
    e.vx += (desVx - e.vx) * steer;
    e.vy += (desVy - e.vy) * steer;
    e.vz += (desVz - e.vz) * steer;

    e.x += e.vx * dt;
    e.y = Math.max(14.0, Math.min(GAME_MAX_ALTITUDE - 25.0, e.y + e.vy * dt));
    e.z += e.vz * dt;

    const safe = pushOutOfBuildings(e.x, e.y, e.z, 16.0, bList);
    e.x = safe.x;
    e.z = safe.z;
  }
}

function updateCombat(dt, oldX, oldY, oldZ, bList, totalSpeed) {
  if (multiKillWindow > 0) {
    multiKillWindow -= dt;
    if (multiKillWindow <= 0) multiKillCount = 0;
  }

  // [도미노 폭발] 예약된 연쇄 폭발 순차 처리
  for (let i = pendingExplosions.length - 1; i >= 0; i--) {
    const pe = pendingExplosions[i];
    pe.delay -= dt;
    if (pe.delay <= 0) {
      pendingExplosions.splice(i, 1);
      shakeMag = Math.max(shakeMag, 2.4);
      triggerShockwave(pe.x, pe.y, pe.z, pe.radius, pe.dmg, pe.col, null, pe.depth);
    }
  }

  // 웨이브 클리어 체크 (보스전 중에는 일반 웨이브 진행 중단)
  if (!bossActive && enemies.length === 0) {
    if (waveClearDelay <= 0) {
      waveClearDelay = 1.25;
      hp = Math.min(MAX_HP, hp + 8);
      const clearXp = 90 + wave * 25;
      gainXp(clearXp);
      addPopup('WAVE ' + wave + ' CLEAR! +' + clearXp + 'XP', PAL.EMERALD, 3);
      spawnExplosion(px, py + 4, pz, PAL.GOLD, PAL.NEON_CYAN, 24);
    } else {
      waveClearDelay -= dt;
      if (waveClearDelay <= 0) {
        waveClearDelay = 0;
        wave++;
        spawnWave(wave);
      }
    }
    return;
  }

  // [기믹 1: 전격 오라 — 완전 고속 주행 리워크]
  const auraSpec = getSwingAuraSpec();
  if (auraSpec && isSwingAuraActive(totalSpeed, isSwinging)) {
    // Lv.2+: 오라 범위 내 적 투사체 상시 감전 소거
    if (auraSpec.clearProj) {
      clearProjectilesInRadius(px, py, pz, auraSpec.radius, PAL.NEON_CYAN);
    }
    auraTickTimer -= dt;
    if (auraTickTimer <= 0) {
      auraTickTimer = auraSpec.tick;
      const spdBonus = Math.max(0, totalSpeed - auraSpec.minSpd) * 0.25;
      const baseAuraDmg = auraSpec.dmg + Math.round(spdBonus);
      const overcharge = auraSpec.chainArc && totalSpeed >= 95.0;
      const hits = [];
      for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        const swarmBonus = e.tier === 'SWARM' ? 6.0 : 0.0;
        if (Math.hypot(e.x - px, e.y - py, e.z - pz) <= auraSpec.radius + e.radius + swarmBonus) {
          hits.push(e);
        }
      }
      let auraKills = 0;
      for (let i = 0; i < hits.length; i++) {
        const targetE = hits[i];
        if (enemies.indexOf(targetE) === -1) continue;
        const dmg = targetE.tier === 'SWARM' ? (baseAuraDmg * 2) : baseAuraDmg;
        const boltCol = overcharge ? PAL.GOLD : PAL.NEON_CYAN;
        spawnLightningBolt(px, py, pz, targetE.x, targetE.y, targetE.z, boltCol, 0.16);
        const killed = applyEnemyDamage(targetE, dmg, boltCol, overcharge, 0, false);
        if (killed) auraKills++;

        // Lv.3 각성: 초고속(95+) 시 피격 적에서 반경 65m 주변 2기에게 연쇄 번개 방전
        if (overcharge) {
          let arcCount = 0;
          const arcDmg = Math.round(baseAuraDmg * 0.70);
          for (let j = enemies.length - 1; j >= 0 && arcCount < 2; j--) {
            const sub = enemies[j];
            if (!sub || sub === targetE) continue;
            if (Math.hypot(sub.x - targetE.x, sub.y - targetE.y, sub.z - targetE.z) <= 65.0) {
              arcCount++;
              spawnLightningBolt(targetE.x, targetE.y, targetE.z, sub.x, sub.y, sub.z, PAL.GOLD, 0.16);
              if (applyEnemyDamage(sub, sub.tier === 'SWARM' ? arcDmg * 2 : arcDmg, PAL.GOLD, false, 0, false)) {
                auraKills++;
              }
            }
          }
        }
      }
      // Lv.2+: 오라 처치 시 전방 가속(+10/+12 SPD)으로 노-STRIKE 주행 속도 유지
      if (auraKills > 0 && auraSpec.killBoost > 0) {
        const augNow = getAugStats();
        const capSpd = (BASE_SWING_MAX_SPD + 18.0) * augNow.maxSpeedMult;
        const hNow = Math.hypot(vx, vz);
        if (hNow > 1.0 && hNow < capSpd) {
          const add = Math.min(auraSpec.killBoost, capSpd - hNow);
          vx += (vx / hNow) * add;
          vz += (vz / hNow) * add;
        }
        comboTimer = Math.max(comboTimer, 4.6);
      }
    }
  }

  // [기믹 2: 올가미 스윙] 스윙 중 주변 비-엘리트 적 포획 및 저속 정체 시 해제
  const lassoSpec = getLassoSpec();
  for (let i = lassoTargets.length - 1; i >= 0; i--) {
    if (enemies.indexOf(lassoTargets[i]) === -1) lassoTargets.splice(i, 1);
  }
  if (!lassoSpec && lassoTargets.length > 0) {
    lassoTargets = [];
  } else if (lassoSpec) {
    if (lassoTargets.length > 0 && strikeMode === 0 && !isSwinging && totalSpeed < 22.0) {
      releaseLassoTargets('LASSO SLIPPED!');
    }
    if (isSwinging && lassoTargets.length < lassoSpec.maxTied) {
      for (let i = 0; i < enemies.length && lassoTargets.length < lassoSpec.maxTied; i++) {
        const e = enemies[i];
        if (e.tier === 'ELITE' || e.tier === 'BOSS' || lassoTargets.indexOf(e) !== -1) continue;
        if (Math.hypot(e.x - px, e.y - py, e.z - pz) <= lassoSpec.radius + e.radius) {
          lassoTargets.push(e);
          spawnSparks(e.x, e.y, e.z, '#ffffff', 6, 20);
          if (!(enemies.length > 0 && lassoTargets.length >= enemies.length)) {
            addPopup('TIED ' + lassoTargets.length + '/' + lassoSpec.maxTied, lassoTargets.length >= lassoSpec.awakenCount ? PAL.GOLD : '#d8b4fe', 1);
          }
        }
      }
    }
    const allEnemiesTiedNow = (lassoTargets.length > 0 && enemies.length > 0 && lassoTargets.length >= enemies.length);
    if (allEnemiesTiedNow && !_lassoAllTiedNotified) {
      _lassoAllTiedNotified = true;
      addPopup('ALL TIED! PRESS STRIKE!', PAL.GOLD, 2);
    } else if (!allEnemiesTiedNow) {
      _lassoAllTiedNotified = false;
    }
  }

  const segDx = px - oldX, segDy = py - oldY, segDz = pz - oldZ;
  const segLenSq = segDx * segDx + segDy * segDy + segDz * segDz;
  const isActiveAttack = (strikeMode !== 0 && strikePhase === 'RUSH');
  // HANG_SHOOT(공중 정지 조준) 중 무적 제거: RUSH 돌진 중 또는 짧은 유예(0.20s)에만 보호
  let isStrikeProtected = isActiveAttack || (strikeGraceTimer > 0);
  const curSpdNow = Math.hypot(vx, vy, vz);
  const canDeflectProj = (isActiveAttack && (strikeEntrySpd >= 95.0 || (strikeMode === 1 && curSpdNow >= 95.0))) || (justChainParryTimer > 0);
  const hMoveSpd = Math.hypot(vx, vz);
  const backSin = hMoveSpd > 4.0 ? (vx / hMoveSpd) : Math.sin(camYaw);
  const backCos = hMoveSpd > 4.0 ? (vz / hMoveSpd) : Math.cos(camYaw);

  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (!e) continue;

    const tiedIdx = lassoTargets.indexOf(e);
    if (tiedIdx !== -1) {
      // 초경량 관성 밧줄: 고속 스윙 시 시야 뒤로 팽팽하게 끌려오다 감속·선회 시 관성으로 옆/앞으로 밀려 나옴
      const trailDist = 11.0 + (tiedIdx % 4) * 3.2;
      const sideSign = (tiedIdx & 1) ? 1 : -1;
      const sideMag = 2.8 + Math.floor(tiedIdx / 2) * 2.0;
      const rightX = backCos, rightZ = -backSin;
      const gx = px - backSin * trailDist + rightX * sideSign * sideMag;
      const gy = Math.max(7.0, py - 2.2 - (tiedIdx % 3) * 1.8);
      const gz = pz - backCos * trailDist + rightZ * sideSign * sideMag;

      const kSpring = 15.0;
      const damp = Math.max(0.0, 1.0 - 3.4 * dt);
      e.vx = (e.vx + (gx - e.x) * kSpring * dt) * damp;
      e.vy = (e.vy + (gy - e.y) * kSpring * dt) * damp;
      e.vz = (e.vz + (gz - e.z) * kSpring * dt) * damp;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.z += e.vz * dt;

      const rdx = e.x - px, rdy = e.y - py, rdz = e.z - pz;
      const maxRope = 28.0 + (tiedIdx % 4) * 3.0;
      const rDistSq = rdx * rdx + rdy * rdy + rdz * rdz;
      if (rDistSq > maxRope * maxRope) {
        const rDist = Math.sqrt(rDistSq) || 1.0;
        const nx = rdx / rDist, ny = rdy / rDist, nz = rdz / rDist;
        const excess = rDist - maxRope;
        const pullStep = Math.min(excess, Math.max(180.0, totalSpeed * 1.6) * dt);
        e.x -= nx * pullStep;
        e.y = Math.max(5.0, e.y - ny * pullStep);
        e.z -= nz * pullStep;
        const relOut = (e.vx - vx) * nx + (e.vy - vy) * ny + (e.vz - vz) * nz;
        if (relOut > 0.0) {
          e.vx -= nx * relOut;
          e.vy -= ny * relOut;
          e.vz -= nz * relOut;
        }
      } else if (e.y < 5.0) {
        e.y = 5.0;
        if (e.vy < 0) e.vy *= -0.3;
      }
      if (e.hitFlash > 0) e.hitFlash -= dt;
      continue;
    }

    // 1) 티어별 이동 AI 업데이트 (SWARM 전방 요격 / MEDIUM·ELITE 고도층 분리 선회)
    updateEnemyMovementAI(e, dt, bList);

    // 2) 2단계 이상(MEDIUM / ELITE) 전용 원거리 플라즈마 공격
    const dxToP = px - e.x, dyToP = py - e.y, dzToP = pz - e.z;
    const distToP = Math.hypot(dxToP, dyToP, dzToP) || 1.0;
    const isLockedByActiveStrike = (strikeMode !== 0 && strikeTarget === e);

    if (!e.isBoss && e.tier !== 'SWARM' && !isLockedByActiveStrike && distToP < 275.0 && distToP > 42.0 && projectiles.length < (bossActive ? 24 : 16)) {
      e.fireTimer -= dt;
      if (e.fireTimer <= 0) {
        const baseCd = e.tier === 'ELITE' ? 2.2 : 2.7;
        e.fireTimer = Math.max(1.4, baseCd - wave * 0.10) + Math.random() * 1.1;

        const pSpd = 58.0 + Math.min(28.0, wave * 3.0);
        const aimX = (px + vx * 0.20) - e.x;
        const aimY = (py + vy * 0.16) - e.y;
        const aimZ = (pz + vz * 0.20) - e.z;
        const aimDist = Math.hypot(aimX, aimY, aimZ) || 1.0;
        const baseDx = aimX / aimDist, baseDy = aimY / aimDist, baseDz = aimZ / aimDist;

        const pCol = e.tier === 'ELITE' ? PAL.GOLD
          : (e.type === 'SKY_CORE' ? PAL.NEON_PINK : PAL.CRIMSON);

        if (e.tier === 'ELITE') {
          const angles = [-0.15, 0.0, 0.15];
          for (let k = 0; k < angles.length; k++) {
            const cA = Math.cos(angles[k]), sA = Math.sin(angles[k]);
            const fx = baseDx * cA - baseDz * sA;
            const fz = baseDx * sA + baseDz * cA;
            projectiles.push({
              x: e.x, y: e.y, z: e.z,
              vx: fx * pSpd, vy: baseDy * pSpd, vz: fz * pSpd,
              life: 4.5, col: pCol
            });
          }
        } else {
          projectiles.push({
            x: e.x, y: e.y, z: e.z,
            vx: baseDx * pSpd, vy: baseDy * pSpd, vz: baseDz * pSpd,
            life: 4.5, col: pCol
          });
        }
      }
    }

    // 3) Swept segment-to-sphere 충돌 판정
    let t = 0;
    if (segLenSq > 0.0001) {
      t = ((e.x - oldX) * segDx + (e.y - oldY) * segDy + (e.z - oldZ) * segDz) / segLenSq;
      t = Math.max(0, Math.min(1, t));
    }
    const closestDist = Math.hypot(
      (oldX + segDx * t) - e.x,
      (oldY + segDy * t) - e.y,
      (oldZ + segDz * t) - e.z
    );

    const hitRadius = (isActiveAttack && (strikeTarget === e || strikeMode === 1))
      ? (e.radius + 9.5)
      : (e.radius + 3.0);

    if (closestDist <= hitRadius) {
      if (isActiveAttack) {
        // === MANUAL STRIKE IMPACT (속도·기술 비례 데미지 & XP 성장 가속) ===
        const aug = getAugStats();
        const curMode = strikeMode;
        const preSpd = Math.hypot(vx, vy, vz) || 1.0;
        const dirX = vx / preSpd, dirY = vy / preSpd, dirZ = vz / preSpd;

        const calc = computeStrikeDamage(curMode, strikeEntrySpd, strikeEntryDist, Math.max(0, -vy), isChainRush, preSpd, justChainTargetMult);
        const dmg = calc.dmg;
        const isCrit = calc.isCrit;
        const impactCol = curMode === 1 ? PAL.ORANGE : (isChainRush ? PAL.NEON_PINK : (isCrit ? PAL.GOLD : (dmg <= 30 ? '#cbd5e1' : PAL.NEON_CYAN)));

        hitStopTimer = curMode === 1 ? 0.055 : (isCrit ? 0.052 : (isChainRush ? 0.032 : 0.038));
        shakeMag = Math.max(shakeMag, curMode === 1 ? 4.8 : (isCrit ? 4.4 : 3.2));
        swingCombo = Math.min(12, swingCombo + 1);
        addStylePoints((curMode === 1 || strikeEntrySpd >= 95.0) ? 12 : 8, 5.0);
        afterimageTimer = 0.75;

        // 타격 직후 0.20초 짧은 몸체 보호 유예 + 타격 지점 영거리 투사체 소거 (초중력 Lv.3 SLAM은 95m 광역 소거!)
        strikeGraceTimer = 0.20;
        isStrikeProtected = true;

        const targetX = e.x, targetY = e.y, targetZ = e.z;
        const lvHeavy = getLv('heavy_suit');
        const projClearR = (curMode === 1 && lvHeavy >= 3) ? 95.0 : 28.0;
        clearProjectilesInRadius(targetX, targetY, targetZ, projClearR, impactCol);

        const killed = applyEnemyDamage(e, dmg, impactCol, isCrit, 0, true);
        if (refillElasticCharges()) {
          spawnSparks(targetX, targetY, targetZ, PAL.EMERALD, 6, 26);
        }

        // [Step 3 보스전] 수동 STRIKE 직접 타격 전용 턴 기믹 (EVADE -5~10초 단축 / GROGGY 최대 3히트)
        let bossForceRebound = false;
        if (e.isBoss && !killed && !isChainRush) {
          if (bossPhase === 'EVADE') {
            const cutSec = Math.min(10.0, 5.0 + (e.lastDealtDmg || 0) / 120.0);
            bossPhaseTimer = Math.max(0.0, bossPhaseTimer - cutSec);
            bossEvadeFlash = 0.75;
            bossLastCutSec = cutSec;
            invulnTimer = Math.max(invulnTimer, 0.55);
            bossForceRebound = true;
            addPopup('SHIELD PIERCE! -' + cutSec.toFixed(1) + 's', PAL.GOLD, 3);
            if (bossPhaseTimer <= 0.0) {
              startBossGroggyTurn();
            }
          } else if (bossPhase === 'GROGGY') {
            bossGroggyHits++;
            if (bossGroggyHits >= BOSS_GROGGY_MAX_HITS) {
              const finKilled = applyEnemyDamage(e, Math.round(dmg * 0.20), PAL.GOLD, true, 0, false);
              hitStopTimer = Math.max(hitStopTimer, 0.11);
              shakeMag = Math.max(shakeMag, 6.2);
              shockwaves.push({ x: targetX, y: targetY, z: targetZ, r: 10, maxR: 130, life: 0.40, maxLife: 0.40, col: PAL.GOLD });
              invulnTimer = Math.max(invulnTimer, 0.65);
              bossForceRebound = true;
              addPopup('CORE FINISHER!!', PAL.GOLD, 3);
              if (!finKilled && bossPhase === 'GROGGY') {
                startBossEvadeTurn();
              }
            } else {
              addPopup('CORE HIT ' + bossGroggyHits + '/' + BOSS_GROGGY_MAX_HITS + '!', PAL.GOLD, 2);
            }
          }
        }

        // [연속 돌격] 저스트 체인은 발동 시 누적, 연쇄 핀볼은 적중 시 누적, 일반 타격은 기존 유지시간만 갱신
        const rushSpec = getStrikeRushSpec();
        if (rushSpec) {
          if (isChainRush) {
            strikeRushStack = Math.min(rushSpec.maxStack, strikeRushStack + 1);
            strikeRushTimer = 2.8;
          } else if (strikeRushStack > 0) {
            strikeRushTimer = 2.8;
          }
        }

        // [올가미 스윙] 포획된 적 전원 일괄 기폭!
        let lassoAwakenBounce = false;
        let lassoTiedCount = 0;
        let lassoPtsSnap = null;
        if (lassoSpec && lassoTargets.length > 0) {
          const tiedSnap = lassoTargets.slice();
          lassoTargets = [];
          const tiedCount = tiedSnap.length;
          lassoTiedCount = tiedCount;
          if (tiedCount >= 6 && getLv('lasso_swing') >= 3) {
            lassoPtsSnap = [];
            for (let k = 0; k < tiedSnap.length; k++) {
              lassoPtsSnap.push({ x: tiedSnap[k].x, y: tiedSnap[k].y, z: tiedSnap[k].z });
            }
          }
          const awakened = tiedCount >= lassoSpec.awakenCount;
          lassoAwakenBounce = awakened;
          const boomR = (52.0 + tiedCount * 7.0) * (awakened ? 1.5 : 1.0);
          const boomDmg = Math.round(tiedCount * lassoSpec.detonatePer * (awakened ? 1.35 : 1.0));
          for (let k = 0; k < tiedSnap.length; k++) {
            const te = tiedSnap[k];
            if (enemies.indexOf(te) === -1) continue;
            te.x = targetX + (Math.random() - 0.5) * 6.0;
            te.y = targetY + (Math.random() - 0.5) * 6.0;
            te.z = targetZ + (Math.random() - 0.5) * 6.0;
            if (te !== e) {
              applyEnemyDamage(te, boomDmg, awakened ? PAL.GOLD : '#a78bfa', awakened, 0, false);
            }
          }
          triggerShockwave(targetX, targetY, targetZ, Math.min(160.0, boomR), boomDmg, awakened ? PAL.GOLD : '#a78bfa', e, 0);
          shakeMag = Math.max(shakeMag, awakened ? 6.0 : 4.2);
          addPopup('LASSO BOOM x' + tiedCount + '!!', awakened ? PAL.GOLD : '#d8b4fe', 3);
        }

        // 광역 충격파 계산 (체공 예열 범위 제거 -> 마찰 과열 / 초중력 C1 / 낙하 운동량 Lv.3)
        const fricSpec = getFricHeatSpec();
        const fallSpec = getFallMomSpec();
        let splashR = 0;
        let splashDmg = Math.round(dmg * 0.65);
        let splashCol = PAL.GOLD;
        if (fricSpec && frictionCharge >= 0.22) {
          splashR += fricSpec.shockR;
          splashDmg = Math.max(splashDmg, Math.round(dmg * fricSpec.shockDmgRatio));
          splashCol = PAL.CRIMSON;
        }
        if (curMode === 1 && lvHeavy > 0) {
          splashR += (lvHeavy === 1 ? 40.0 : (lvHeavy === 2 ? 60.0 : 85.0));
          splashCol = PAL.ORANGE;
        }
        if (fallSpec && fallSpec.shockR > 0 && peakFallSpeed > 30.0) {
          splashR += fallSpec.shockR;
          splashCol = PAL.ORANGE;
        }
        if (splashR > 18.0) {
          triggerShockwave(targetX, targetY, targetZ, Math.min(155.0, splashR), splashDmg, splashCol, e, 0);
        }

        // [기믹 3: 연쇄 핀볼] 적중 후 레벨별 반경(95/120/150m) 내 다음 적에게 자동 튕겨 연속 타격
        const chainSpec = getChainSpec();
        if (chainVisited.indexOf(e) === -1) chainVisited.push(e);
        chainPathPts.push({ x: targetX, y: targetY, z: targetZ });
        if (chainBouncesLeft > 0) {
          const nextTarget = findNextChainTarget(targetX, targetY, targetZ, chainVisited, chainSpec ? chainSpec.radius : 95.0);
          if (nextTarget) {
            chainBouncesLeft--;
            chainVisited.push(nextTarget);
            isChainRush = true;
            strikeMode = 3;
            strikePhase = 'RUSH';
            strikeTarget = nextTarget;
            strikeTimer = 0.85;
            strikeWebProg = 1.0;

            const nx = nextTarget.x - px, ny = nextTarget.y - py, nz = nextTarget.z - pz;
            const nd = Math.hypot(nx, ny, nz) || 1.0;
            const chainSpd = Math.min(205.0 * aug.maxSpeedMult, Math.max(158.0, preSpd * 1.12));
            vx = (nx / nd) * chainSpd;
            vy = (ny / nd) * chainSpd;
            vz = (nz / nd) * chainSpd;
            camYaw = Math.atan2(nx, nz);

            spawnLightningBolt(targetX, targetY, targetZ, nextTarget.x, nextTarget.y, nextTarget.z, PAL.NEON_PINK, 0.26);
            addPopup('PINBALL CHAIN!!', PAL.NEON_PINK, 2);
            break;
          }
        }

        const wasChainRush = isChainRush;
        const chainPathSnap = chainPathPts.slice();
        const peakFallBeforeReset = Math.max(peakFallSpeed, Math.max(0, -vy));
        const elasticCritBeforeReset = elasticCritTimer;

        // 연쇄 종료 -> 정상 반동/관통 마무리
        clearStrikeState();
        chainPathPts = [];

        let impactLabel = '';
        if (curMode === 1) {
          vx = vx * 0.68;
          vz = vz * 0.68;
          vy = Math.min(58.0, Math.max(36.0, preSpd * 0.36));
          doingFlip = true;
          flipAngle = 0.0;
          impactLabel = 'SLAM REBOUND!';
        } else {
          const blockedBehind = bossForceRebound || hasObstacleBehindTarget(e, dirX, dirY, dirZ, bList);
          if (blockedBehind) {
            // Case 2/3 반동 속도는 Shift 직전 진짜 속도(strikeEntrySpd) 기준 엄수
            const rebSpd = Math.max(26.0, Math.min(54.0, strikeEntrySpd * 0.58));
            vx = -dirX * rebSpd * 0.78;
            vz = -dirZ * rebSpd * 0.78;
            vy = Math.max(28.0, Math.min(50.0, -dirY * rebSpd * 0.40 + 26.0));
            doingFlip = true;
            flipAngle = 0.0;
            impactLabel = 'SAFE REBOUND!';
          } else {
            // Case 2/3 관통 속도는 Shift 직전 진짜 속도(strikeEntrySpd) 기준 엄수 (저속 공짜 가속 차단)
            const pierceSpd = Math.min(115.0 * aug.maxSpeedMult, Math.max(32.0, strikeEntrySpd * 0.88));
            vx = dirX * pierceSpd;
            vz = dirZ * pierceSpd;
            vy = Math.max(16.0, Math.min(56.0, dirY * pierceSpd * 0.65 + 14.0));
            doingFlip = true;
            flipAngle = 0.0;
            impactLabel = 'PIERCE THROUGH!!';
          }
        }

        // [연속 돌격] 벡터가 바뀌어도 타격 후 속력 보존(85%/95%/105%) -> 저스트 리듬 고속 연계!
        if (rushSpec) {
          const outSpd = Math.hypot(vx, vy, vz);
          const wantSpd = Math.min(185.0 * aug.maxSpeedMult, strikeEntrySpd * rushSpec.keepSpdRatio);
          if (outSpd > 1.0 && wantSpd > outSpd) {
            const sc = wantSpd / outSpd;
            vx *= sc;
            vy = Math.min(62.0, vy * sc);
            vz *= sc;
          }
        }

        // [연쇄 핀볼 Lv.3 각성] 종료 후 쿨다운 0 & 반동 가속 1.2x
        if (chainSpec && chainSpec.endBonus) {
          vx *= 1.20;
          vy = Math.max(vy, 40.0);
          vz *= 1.20;
          strikeCooldown = 0;
        }
        // [올가미 스윙 Lv.3 각성] 4명+ 기폭 시 안전 상향 반동
        if (lassoAwakenBounce) {
          vy = Math.max(vy, 46.0);
        }

        // [Track 3] 공중 2회전 텀블링 리커버리(1.35s, STRIKE 봉인 / 이동·스윙 가능) + 연속 돌격 저스트 리듬 창 오픈
        const skipTumble = (chainSpec && chainSpec.endBonus) || (getLv('overdrive') >= 3 && Math.hypot(vx, vy, vz) >= 115.0);
        if (!skipTumble) {
          strikeTumbleDur = STRIKE_TUMBLE_DUR;
          strikeTumbleTimer = strikeTumbleDur;
          doingFlip = true;
          flipAngle = 0.0;
        } else {
          strikeTumbleTimer = 0.0;
        }
        if (rushSpec) {
          justChainElapsed = 0.0;
          justChainLastTarget = e;
        } else {
          justChainElapsed = -1.0;
          justChainLastTarget = null;
        }

        // 체공 예열 / 낙하 운동량 스택 후처리 (Lv.3 각성 50% 유지 및 핀볼 Lv.2+ 체공 유지)
        const airSpec = getAirHeatSpec();
        if (!(chainSpec && chainSpec.keepAir)) {
          airTimeStack = (airSpec && airSpec.keepRatio > 0) ? (airTimeStack * airSpec.keepRatio) : 0.0;
        }
        peakFallSpeed = (fallSpec && fallSpec.keepRatio > 0) ? (peakFallSpeed * fallSpec.keepRatio) : 0.0;
        const bungeeApexBeforeReset = bungeeApexTimer;
        frictionCharge = 0.0;
        perfectBuffTimer = 0.0;
        skimTechTimer = 0.0;
        elasticCritTimer = 0.0;
        bungeeApexTimer = 0.0;

        // [Step 4] 플레이 방식 변혁 6종 Lv.3(★각성) 100% 수동 STRIKE(Shift) 적중 트리거 (추가 딜 0)
        const apexTargetPt = { x: targetX, y: targetY, z: targetZ };
        let apexTriggered = false;
        if (!apexTriggered && lassoTiedCount >= 6 && getLv('lasso_swing') >= 3) {
          apexTriggered = tryTriggerApexCut('lasso_swing', { targetPt: apexTargetPt, lassoPts: lassoPtsSnap });
        }
        if (!apexTriggered && wasChainRush && getLv('chain_pinball') >= 3 && chainPathSnap.length >= 6 && chainBouncesLeft === 0) {
          apexTriggered = tryTriggerApexCut('chain_pinball', { targetPt: apexTargetPt, chainPts: chainPathSnap });
        }
        if (!apexTriggered && curMode === 1 && lvHeavy >= 3 && peakFallBeforeReset >= 135.0) {
          apexTriggered = tryTriggerApexCut('heavy_suit', { targetPt: apexTargetPt });
        }
        if (!apexTriggered && !wasChainRush && getLv('overdrive') >= 3 && strikeEntrySpd >= 165.0) {
          apexTriggered = tryTriggerApexCut('overdrive', { targetPt: apexTargetPt });
        }
        if (!apexTriggered && !wasChainRush && getLv('bungee_web') >= 3 && bungeeApexBeforeReset > 0.0) {
          apexTriggered = tryTriggerApexCut('bungee_web', { targetPt: apexTargetPt, anchorPt: lastBungeeAnchorPt });
        }
        if (!apexTriggered && !wasChainRush && getLv('elastic') >= 3 && elasticCritBeforeReset > 0.0 && strikeEntrySpd >= 100.0) {
          apexTriggered = tryTriggerApexCut('elastic', { targetPt: apexTargetPt, wallPt: lastElasticWallPt });
        }
        if (apexTriggered) {
          hitStopTimer = 0.0;
        }

        if (!killed) {
          addPopup(impactLabel, impactCol, 1);
        }
        break;
      } else if (isStrikeProtected) {
        continue;
      } else {
        // 비공격 상태에서 적에게 부딪혔을 때 몸체 충돌 피해 + 스웜 넉백
        const pushX = px - e.x, pushZ = pz - e.z;
        const pLen = Math.hypot(pushX, pushZ) || 1.0;
        vx = (pushX / pLen) * 28.0;
        vz = (pushZ / pLen) * 28.0;
        vy = Math.max(16.0, vy * 0.4);
        if (e.tier === 'SWARM') {
          e.vx = -(pushX / pLen) * 32.0;
          e.vz = -(pushZ / pLen) * 32.0;
        }
        takeDamage(e.tier === 'SWARM' ? 14 : 20, e.tier === 'SWARM' ? 'SWARM BITE!' : 'BODY COLLISION!');
      }
    }
  }

  // 적 직선 투사체 처리 (상대 선분 충돌 판정 + 고속(SPD 95+) RUSH / 저스트 패링 시에만 자동 DEFLECT)
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const pr = projectiles[i];
    const oldPrX = pr.x, oldPrY = pr.y, oldPrZ = pr.z;
    pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.z += pr.vz * dt;
    pr.life -= dt;
    if (pr.life <= 0 || pr.y < 1.0) { projectiles.splice(i, 1); continue; }

    const relOldX = oldX - oldPrX, relOldY = oldY - oldPrY, relOldZ = oldZ - oldPrZ;
    const relNewX = px - pr.x,     relNewY = py - pr.y,     relNewZ = pz - pr.z;
    const d = pointToSegmentDist3D(0, 0, 0, relOldX, relOldY, relOldZ, relNewX, relNewY, relNewZ);

    const checkR = canDeflectProj ? 12.5 : 6.8;
    if (d < checkR) {
      if (canDeflectProj) {
        addStylePoints(10, 3.8);
        spawnSparks(pr.x, pr.y, pr.z, PAL.NEON_CYAN, 10, 32);
        addPopup('DEFLECT!', PAL.NEON_CYAN, 1);
        projectiles.splice(i, 1);
      } else {
        spawnSparks(pr.x, pr.y, pr.z, PAL.CRIMSON, 12, 28);
        projectiles.splice(i, 1);
        takeDamage(18, 'PLASMA HIT!');
      }
    }
  }

  if (bossActive) {
    updateBossSystem(dt, bList, oldX, oldY, oldZ, isStrikeProtected);
  }
}
