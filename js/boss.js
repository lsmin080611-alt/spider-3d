'use strict';
// Spider 3D — 6-Minute Boss Battle (OMEGA SOVEREIGN)

function clearBossHazards() {
  bossMines = [];
  bossBombZones = [];
  bossSkyRings = [];
  bossSweep = null;
  bossPatternType = 'NONE';
  bossPatternStage = 'IDLE';
  bossPatternTimer = 0.0;
  bossPatternDuration = 1.0;
  bossHoverLockTimer = 0.0;
  bossPulseState = 'IDLE';
  bossPulseTimer = 0.0;
  bossPlayerInDanger = false;
}

function resetBossState() {
  bossActive = false;
  bossPhase = 'NONE';
  bossEntity = null;
  bossStage = 1;
  bossPhaseTimer = 0.0;
  bossBattleTime = 0.0;
  bossGroggyHits = 0;
  bossEvadeFlash = 0.0;
  bossLastCutSec = 0.0;
  bossEscortTimer = 0.0;
  bossArenaX = 0.0;
  bossArenaZ = 0.0;
  bossCruiseTime = 0.0;
  bossCruiseDir = 1;
  bossPatternCd = 2.2;
  bossLastPattern = '';
  bossPulseCd = 3.5;
  clearBossHazards();
  runCleared = false;
}

function spawnBossMines(stage) {
  bossMines = [];
  if (!bossEntity) return;
  // 비행 경로 랜덤 부유 기뢰 폐지 -> 보스 코어 주변 공전 실드 기뢰(4기 -> P2 6기)만 배치
  const orbitCount = stage >= 2 ? 6 : 4;
  for (let i = 0; i < orbitCount; i++) {
    const ang = (i / orbitCount) * Math.PI * 2;
    const orbitR = 42.0 + (i % 2) * 10.0;
    const yOff = ((i % 3) - 1) * 11.0;
    bossMines.push({
      x: bossEntity.x + Math.cos(ang) * orbitR,
      y: Math.max(24.0, bossEntity.y + yOff),
      z: bossEntity.z + Math.sin(ang) * orbitR,
      radius: 7.4,
      orbitMode: true,
      orbitAngle: ang,
      orbitR,
      orbitYOff: yOff,
      orbitSpd: (stage >= 2 ? 1.40 : 1.05) * ((i & 1) ? 1 : -1),
      phase: i * 1.1,
      respawnTimer: 0.0
    });
  }
}

function spawnBossEscorts(stage, isReinforce = false) {
  const world = getNearbyWorld();
  const spawnOne = (tier, type, spread, dist, ey, hpVal, rad) => {
    const yaw = camYaw + spread;
    const safe = pushOutOfBuildings(px + Math.sin(yaw) * dist, ey, pz + Math.cos(yaw) * dist, 18.0, world.buildings);
    enemies.push({
      tier, type,
      x: safe.x, y: ey, z: safe.z,
      vx: 0, vy: 0, vz: 0,
      orbitDir: Math.random() < 0.5 ? 1 : -1,
      minRange: tier === 'ELITE' ? 105.0 : (type === 'SKY_CORE' ? 85.0 : 70.0),
      maxRange: tier === 'ELITE' ? 170.0 : 142.0,
      altMin: type === 'WALL_TURRET' ? 18.0 : 75.0,
      altMax: type === 'WALL_TURRET' ? 66.0 : 195.0,
      anchorAlt: ey,
      altOffset: type === 'WALL_TURRET' ? 0.0 : 10.0,
      flockAngle: Math.random() * Math.PI * 2,
      flockDist: 12.0,
      lowBias: false,
      hp: hpVal, maxHp: hpVal,
      radius: rad,
      phase: Math.random() * Math.PI * 2,
      fireTimer: tier === 'SWARM' ? 999.0 : (1.7 + Math.random() * 1.4),
      hitFlash: 0
    });
  };

  if (isReinforce) {
    spawnOne('MEDIUM', 'WALL_TURRET', -0.40, 115.0, 38.0, 130, 10.0);
    spawnOne('MEDIUM', 'SKY_CORE', 0.40, 125.0, 118.0, 145, 11.0);
    return;
  }

  // 고티어 호위 몹 투입 (회피턴 압박 전담)
  spawnOne('MEDIUM', 'WALL_TURRET', -0.48, 115.0, 36.0, 130, 10.0);
  spawnOne('MEDIUM', 'SKY_CORE', 0.48, 128.0, 116.0, 145, 11.0);
  if (stage >= 2) {
    spawnOne('ELITE', 'ELITE_CORE', 0.08, 148.0, 132.0, 380, 15.5);
  } else {
    spawnOne('MEDIUM', 'SKY_CORE', -0.18, 138.0, 96.0, 140, 11.0);
  }
  for (let s = 0; s < 3; s++) {
    spawnOne('SWARM', 'SWARM_DRONE', (s - 1) * 0.34, 96.0 + s * 14.0, 68.0 + s * 16.0, 32, 7.6);
  }
}

function spawnBossSynergyDrones() {
  if (!bossEntity) return;
  let nonBossCount = 0;
  for (let i = 0; i < enemies.length; i++) {
    if (!enemies[i].isBoss) nonBossCount++;
  }
  const need = Math.max(0, 3 - nonBossCount);
  for (let i = 0; i < need; i++) {
    const ang = (i / Math.max(1, need)) * Math.PI * 2 + simTime;
    enemies.push({
      tier: 'SWARM',
      type: 'SWARM_DRONE',
      x: bossEntity.x + Math.cos(ang) * 32.0,
      y: Math.max(30.0, bossEntity.y + ((i & 1) ? 8.0 : -8.0)),
      z: bossEntity.z + Math.sin(ang) * 32.0,
      vx: 0, vy: 0, vz: 0,
      flockAngle: ang,
      flockDist: 14.0,
      lowBias: false,
      hp: 20, maxHp: 20,
      radius: 7.6,
      phase: i * 2.1,
      fireTimer: 999.0,
      hitFlash: 0
    });
  }
}

function startBossEvadeTurn() {
  if (!bossEntity) return;
  bossPhase = 'EVADE';
  bossPhaseTimer = BOSS_EVADE_DURATION;
  bossGroggyHits = 0;
  clearBossHazards();
  bossPatternCd = 1.9;
  bossPulseCd = 3.2;
  bossEscortTimer = 14.0;
  spawnBossMines(bossStage);
  spawnBossEscorts(bossStage, false);
  shakeMag = Math.max(shakeMag, 4.0);
  shockwaves.push({ x: bossEntity.x, y: bossEntity.y, z: bossEntity.z, r: 10, maxR: 115, life: 0.42, maxLife: 0.42, col: PAL.CRIMSON });
  addPopup('SHIELD UP! EVADE 40s (STRIKE TO CUT!)', PAL.CRIMSON, 3);
  if (typeof playSfx === 'function') playSfx('boss_alarm');
}

function startBossGroggyTurn() {
  if (!bossEntity) return;
  bossPhase = 'GROGGY';
  bossPhaseTimer = BOSS_GROGGY_DURATION;
  bossGroggyHits = 0;
  projectiles = [];
  clearBossHazards();
  spawnBossSynergyDrones();
  hitStopTimer = Math.max(hitStopTimer, 0.065);
  shakeMag = Math.max(shakeMag, 5.5);
  shockwaves.push({ x: bossEntity.x, y: bossEntity.y, z: bossEntity.z, r: 12, maxR: 165, life: 0.48, maxLife: 0.48, col: PAL.GOLD });
  spawnExplosion(bossEntity.x, bossEntity.y, bossEntity.z, PAL.GOLD, PAL.NEON_CYAN, 34);
  addPopup('CORE EXPOSED!! 6.5s BREAK!', PAL.GOLD, 3);
  if (typeof playSfx === 'function') playSfx('boss_groggy');
}

function startBossPattern(type) {
  if (!bossEntity) return;
  const b = bossEntity;
  bossPatternType = type;
  bossLastPattern = type;

  if (type === 'SWEEP') {
    const baseYaw = Math.atan2(px - b.x, pz - b.z);
    const dir = Math.random() < 0.5 ? 1 : -1;
    const halfArc = 0.663; // ±38 deg
    const warnDur = bossStage >= 2 ? 1.00 : 1.25;
    bossSweep = {
      baseYaw,
      startAngle: baseYaw - dir * halfArc,
      endAngle: baseYaw + dir * halfArc,
      curAngle: baseYaw - dir * halfArc,
      targetY: Math.max(24.0, Math.min(185.0, py)),
      tiltY: 0.0,
      length: 295.0,
      dir,
      pass: 1,
      maxPasses: bossStage >= 2 ? 2 : 1
    };
    bossPatternStage = 'WARN';
    bossPatternTimer = warnDur;
    bossPatternDuration = warnDur;
    bossHoverLockTimer = warnDur + 1.0;
    addPopup('SOLAR SWEEP! DODGE UP/DOWN!', PAL.GOLD, 2);
    if (typeof playSfx === 'function') playSfx('boss_alarm', 1.25);
  } else if (type === 'BOMB') {
    bossBombZones = [];
    const count = bossStage >= 2 ? 5 : 3;
    const baseWarn = bossStage >= 2 ? 1.10 : 1.35;
    const spdH = Math.hypot(vx, vz);
    const dirX = spdH > 6.0 ? (vx / spdH) : Math.sin(camYaw);
    const dirZ = spdH > 6.0 ? (vz / spdH) : Math.cos(camYaw);
    const perpX = dirZ, perpZ = -dirX;
    for (let k = 0; k < count; k++) {
      const lead = 18.0 + k * 40.0;
      const side = (k === 0) ? 0.0 : (((k & 1) ? 1 : -1) * (24.0 + (k % 2) * 14.0));
      const altOff = (k === 0) ? 0.0 : (((k % 3) - 1) * 18.0);
      const zx = px + dirX * lead + perpX * side;
      const zz = pz + dirZ * lead + perpZ * side;
      const zy = Math.max(24.0, Math.min(195.0, py + vy * 0.25 + altOff));
      const tMax = baseWarn + k * 0.28;
      bossBombZones.push({
        x: zx, y: zy, z: zz,
        r: 28.0,
        timer: tMax,
        maxTimer: tMax,
        detonated: false
      });
    }
    bossPatternStage = 'ACTIVE';
    bossPatternTimer = baseWarn + count * 0.30;
    bossPatternDuration = bossPatternTimer;
    bossHoverLockTimer = 1.45;
    addPopup('ORBITAL LOCK-ON! CLEAR ZONES!', PAL.ORANGE, 2);
    if (typeof playSfx === 'function') playSfx('boss_alarm', 1.35);
  } else if (type === 'RING') {
    bossSkyRings = [];
    const y1 = Math.max(24.0, Math.min(180.0, py));
    const warn1 = bossStage >= 2 ? 1.00 : 1.15;
    bossSkyRings.push({
      x: b.x, y: y1, z: b.z,
      r: 22.0, maxR: 280.0,
      bandH: 14.0,
      warnTimer: warn1, maxWarn: warn1,
      active: false, hitDone: false
    });
    if (bossStage >= 2) {
      const y2 = (y1 > 96.0) ? Math.max(26.0, y1 - 46.0) : Math.min(182.0, y1 + 46.0);
      bossSkyRings.push({
        x: b.x, y: y2, z: b.z,
        r: 22.0, maxR: 280.0,
        bandH: 14.0,
        warnTimer: 1.55, maxWarn: 1.55,
        active: false, hitDone: false
      });
    }
    bossPatternStage = 'ACTIVE';
    bossPatternTimer = 3.2;
    bossPatternDuration = 3.2;
    bossHoverLockTimer = 2.4;
    addPopup('SKY RING! CLIMB OR DIVE!', PAL.GOLD, 2);
    if (typeof playSfx === 'function') playSfx('boss_alarm', 1.12);
  }
}

// Step 3 보스전 진입 훅 (06:00 카운트다운 종료 시 1회 발동)
function onRunTimerZero() {
  runTimerZeroTriggered = true;
  if (typeof playSfx === 'function') playSfx('boss_alarm');
  bossActive = true;
  bossPhase = 'INTRO';
  bossPhaseTimer = BOSS_INTRO_DURATION;
  bossStage = 1;
  bossBattleTime = 0.0;
  bossGroggyHits = 0;
  bossEvadeFlash = 0.0;
  bossLastCutSec = 0.0;
  waveClearDelay = 0.0;
  enemies = [];
  projectiles = [];
  pendingExplosions = [];
  lassoTargets = [];
  clearBossHazards();
  clearStrikeState();
  hp = Math.min(MAX_HP, hp + 25);

  const sinY = Math.sin(camYaw), cosY = Math.cos(camYaw);
  const world = getNearbyWorld();
  const bx = px + sinY * 155.0;
  const bz = pz + cosY * 155.0;
  const safe = pushOutOfBuildings(bx, 105.0, bz, 28.0, world.buildings);
  bossArenaX = safe.x;
  bossArenaZ = safe.z;
  bossCruiseTime = 0.0;
  bossCruiseDir = Math.random() < 0.5 ? 1 : -1;
  bossEntity = {
    tier: 'BOSS',
    type: 'BOSS_SOVEREIGN',
    isBoss: true,
    x: safe.x, y: Math.max(210.0, py + 115.0), z: safe.z,
    vx: 0, vy: 0, vz: 0,
    hp: BOSS_MAX_HP, maxHp: BOSS_MAX_HP,
    radius: BOSS_CORE_RADIUS,
    phase: 0.0,
    fireTimer: 999.0,
    hitFlash: 0,
    lastDealtDmg: 0
  };
  enemies.push(bossEntity);

  shakeMag = Math.max(shakeMag, 5.5);
  spawnSparks(px, py, pz, PAL.GOLD, 24, 45);
  addPopup('WARNING!! OMEGA SOVEREIGN (+25HP)', PAL.GOLD, 3);
}

function updateBossSystem(dt, bList, oldX, oldY, oldZ, isStrikeProtected) {
  if (!bossActive) return;
  if (bossEvadeFlash > 0) bossEvadeFlash = Math.max(0, bossEvadeFlash - dt);
  bossPlayerInDanger = false;

  // 격파 후 1.1초 연쇄 폭발 컷신 -> RUN CLEAR!
  if (bossPhase === 'DEFEATED') {
    bossPhaseTimer -= dt;
    bossDeathBoomTimer -= dt;
    if (bossDeathBoomTimer <= 0) {
      bossDeathBoomTimer = 0.16;
      const ox = (Math.random() - 0.5) * 36.0;
      const oy = (Math.random() - 0.5) * 28.0;
      const oz = (Math.random() - 0.5) * 36.0;
      spawnExplosion(bossDeathX + ox, bossDeathY + oy, bossDeathZ + oz, PAL.GOLD, PAL.CRIMSON, 20);
      shakeMag = Math.max(shakeMag, 4.5);
    }
    if (bossPhaseTimer <= 0) {
      runCleared = true;
      gameOver = true;
      gameOverReason = 'RUN CLEAR!!';
      isSwinging = false;
      inPerfectWindow = false;
      lassoTargets = [];
    }
    return;
  }

  if (!bossEntity || enemies.indexOf(bossEntity) === -1) return;
  const b = bossEntity;
  if (b.hitFlash > 0) b.hitFlash = Math.max(0, b.hitFlash - dt);

  // INTRO: 2.2초간 아레나 중심 상공에서 중간 고도(105m)로 수직 강하
  if (bossPhase === 'INTRO') {
    bossPhaseTimer -= dt;
    const safe = pushOutOfBuildings(bossArenaX, 105.0, bossArenaZ, 28.0, bList);
    b.x += (safe.x - b.x) * Math.min(1.0, 3.0 * dt);
    b.z += (safe.z - b.z) * Math.min(1.0, 3.0 * dt);
    b.y += (105.0 - b.y) * Math.min(1.0, 3.2 * dt);
    if (bossPhaseTimer <= 0) {
      startBossEvadeTurn();
    }
    return;
  }

  bossBattleTime += dt;

  const sinY = Math.sin(camYaw), cosY = Math.cos(camYaw);
  const dxP = px - b.x, dyP = py - b.y, dzP = pz - b.z;
  const horizDist = Math.hypot(dxP, dzP) || 1.0;
  const distToP = Math.hypot(dxP, dyP, dzP) || 1.0;

  if (bossPhase === 'GROGGY') {
    const safeG = pushOutOfBuildings(b.x, 95.0, b.z, 26.0, bList);
    b.x += (safeG.x - b.x) * Math.min(1.0, 4.0 * dt);
    b.z += (safeG.z - b.z) * Math.min(1.0, 4.0 * dt);
    b.y += ((95.0 + Math.sin(simTime * 3.5) * 1.8) - b.y) * Math.min(1.0, 4.5 * dt);
    if (!apexActive) bossPhaseTimer -= dt;
    if (bossPhaseTimer <= 0) {
      startBossEvadeTurn();
    }
    return;
  }

  // === EVADE TURN (40초: 독립 아레나 순항 + 텔레그래프 4종 패턴) ===
  if (!apexActive) bossPhaseTimer -= dt;
  if (bossHoverLockTimer > 0) bossHoverLockTimer = Math.max(0, bossHoverLockTimer - dt);

  // 0) 독립 아레나 순항 AI (Track 4 #8): 고무줄 추적 폐지 -> 400m+ 완전 이탈 시에만 재배치
  if (horizDist > 400.0) {
    bossArenaX = px + sinY * 165.0;
    bossArenaZ = pz + cosY * 165.0;
    bossCruiseTime = 0.0;
    bossHoverLockTimer = 0.0;
    addPopup('BOSS RELOCATING!', PAL.GOLD, 2);
  }

  const isHoverLocked = (bossPatternStage !== 'IDLE' || bossHoverLockTimer > 0.0 || bossPulseState === 'WARN');
  if (isHoverLocked) {
    // 패턴 예고·발동·후딜 중 위치 고정(호버링) -> 측면/상단 대아크 스윙 공략 빈틈 제공
    b.vx = 0; b.vz = 0;
    const hoverY = Math.max(78.0, Math.min(125.0, b.y + Math.sin(simTime * 3.2) * 3.0 * dt));
    b.y = hoverY;
  } else {
    // 스폰 아레나 중심 반경 180~240m 8자(리사주) 저속 순항 (25~38 m/s)
    const omega = (bossStage >= 2 ? 0.175 : 0.140) * bossCruiseDir;
    bossCruiseTime += dt * omega;
    const targetX = bossArenaX + Math.sin(bossCruiseTime) * 210.0;
    const targetZ = bossArenaZ + Math.sin(bossCruiseTime * 2.0) * 115.0;
    const targetY = 102.0 + Math.sin(bossCruiseTime * 2.2) * 20.0;

    const toX = targetX - b.x;
    const toZ = targetZ - b.z;
    const toDist = Math.hypot(toX, toZ) || 1.0;
    const maxCruiseSpd = (horizDist > 330.0) ? 84.0 : (bossStage >= 2 ? 36.0 : 28.0);
    const step = Math.min(toDist, maxCruiseSpd * dt);
    b.x += (toX / toDist) * step;
    b.z += (toZ / toDist) * step;
    b.y += (targetY - b.y) * Math.min(1.0, 1.8 * dt);
    const safeB = pushOutOfBuildings(b.x, b.y, b.z, 26.0, bList);
    b.x = safeB.x; b.z = safeB.z;
  }

  // 1) 보스 공전 실드 기뢰 업데이트 + 충돌 판정 (22 HP, 탄성 반발 시 반사 역전)
  const lvElastic = getLv('elastic');
  for (let i = 0; i < bossMines.length; i++) {
    const m = bossMines[i];
    if (m.respawnTimer > 0) {
      m.respawnTimer = Math.max(0, m.respawnTimer - dt);
      continue;
    }
    m.orbitAngle += m.orbitSpd * dt;
    m.x = b.x + Math.cos(m.orbitAngle) * m.orbitR;
    m.z = b.z + Math.sin(m.orbitAngle) * m.orbitR;
    m.y = Math.max(22.0, b.y + m.orbitYOff + Math.sin(simTime * 2.2 + m.phase) * 5.5);

    const dMine = pointToSegmentDist3D(m.x, m.y, m.z, oldX, oldY, oldZ, px, py, pz);
    if (dMine < m.radius + 3.4) {
      if (lvElastic > 0 && elasticChargesLeft > 0) {
        elasticChargesLeft--;
        const bounceMult = getElasticBounceMult();
        const eShock = getElasticShockSpec();
        const nx = px - m.x, ny = py - m.y, nz = pz - m.z;
        const nl = Math.hypot(nx, ny, nz) || 1.0;
        const curSpd = Math.max(68.0, Math.hypot(vx, vy, vz));
        vx = (nx / nl) * curSpd * bounceMult;
        vy = Math.max(24.0, (ny / nl) * curSpd * 0.6 + 22.0);
        vz = (nz / nl) * curSpd * bounceMult;
        if (lvElastic >= 3) elasticCritTimer = 2.5;
        if (eShock) triggerShockwave(m.x, m.y, m.z, eShock.radius, eShock.dmg, PAL.EMERALD, null, 0);
        m.respawnTimer = 4.0;
        addPopup('MINE BOUNCE!!', PAL.EMERALD, 2);
      } else if (invulnTimer <= 0) {
        const nx = px - m.x, nz = pz - m.z;
        const nl = Math.hypot(nx, nz) || 1.0;
        vx = (nx / nl) * 34.0;
        vz = (nz / nl) * 34.0;
        vy = Math.max(18.0, vy * 0.35);
        m.respawnTimer = 3.5;
        spawnExplosion(m.x, m.y, m.z, PAL.CRIMSON, PAL.GOLD, 16);
        takeDamage(22, 'SKY MINE!');
      }
    }
  }

  // 2) 패턴 D: REPULSOR DOME (근접 95m 이내 접근 시 0.95s 3D 구형 예고 -> 62m 폭발 26 HP)
  if (bossPulseState === 'IDLE') {
    bossPulseCd -= dt;
    if (bossPulseCd <= 0 && distToP < 95.0) {
      bossPulseState = 'WARN';
      bossPulseTimer = 0.95;
      addPopup('REPULSOR DOME! GET OUT!', PAL.CRIMSON, 2);
    }
  } else if (bossPulseState === 'WARN') {
    bossPulseTimer -= dt;
    if (distToP < 62.0) bossPlayerInDanger = true;
    if (bossPulseTimer <= 0) {
      bossPulseState = 'IDLE';
      bossPulseCd = bossStage >= 2 ? 4.2 : 5.0;
      shockwaves.push({ x: b.x, y: b.y, z: b.z, r: 8, maxR: 66, life: 0.36, maxLife: 0.36, col: PAL.CRIMSON });
      shakeMag = Math.max(shakeMag, 4.5);
      if (typeof playSfx === 'function') playSfx('shockwave', 0.92);
      if (distToP < 62.0 && invulnTimer <= 0) {
        const nl = Math.hypot(dxP, dzP) || 1.0;
        vx = (dxP / nl) * 52.0;
        vz = (dzP / nl) * 52.0;
        vy = Math.max(22.0, vy * 0.4 + 16.0);
        takeDamage(26, 'REPULSOR DOME!');
      }
    }
  }

  // 3) 메인 시그니처 텔레그래프 패턴 상태 머신 (A: SOLAR SWEEP / B: ORBITAL LOCK-ON / C: SKY RING)
  if (bossPatternStage === 'IDLE') {
    bossPatternCd -= dt;
    if (bossPatternCd <= 0 && horizDist < 340.0) {
      const pool = ['SWEEP', 'BOMB', 'RING'].filter((p) => p !== bossLastPattern);
      const nextType = pool[Math.floor(Math.random() * pool.length)];
      startBossPattern(nextType);
    }
  } else if (bossPatternStage === 'RECOVER') {
    bossPatternTimer -= dt;
    if (bossPatternTimer <= 0) {
      bossPatternStage = 'IDLE';
      bossPatternType = 'NONE';
      bossPatternCd = bossStage >= 2 ? 2.1 : 2.7;
    }
  } else if (bossPatternType === 'SWEEP' && bossSweep) {
    // 패턴 A: SOLAR SWEEP (예고 부채꼴 평면 휩쓸기 빔, 35 HP)
    const sw = bossSweep;
    bossPatternTimer -= dt;
    if (bossPatternStage === 'WARN') {
      // 예고 부채꼴 고도대·각도 안에 있으면 위험 경고
      const pYaw = Math.atan2(px - b.x, pz - b.z);
      let dYaw = (pYaw - sw.baseYaw + Math.PI) % (2 * Math.PI) - Math.PI;
      if (dYaw < -Math.PI) dYaw += 2 * Math.PI;
      if (Math.abs(dYaw) < 0.72 && Math.abs(py - sw.targetY) < 28.0 && horizDist < sw.length) {
        bossPlayerInDanger = true;
      }
      if (bossPatternTimer <= 0) {
        bossPatternStage = 'ACTIVE';
        bossPatternDuration = (sw.pass === 2) ? 0.75 : 0.85;
        bossPatternTimer = bossPatternDuration;
        shakeMag = Math.max(shakeMag, 3.8);
        if (typeof playSfx === 'function') playSfx('shockwave', 1.32);
      }
    } else if (bossPatternStage === 'ACTIVE') {
      const prog = 1.0 - Math.max(0.0, bossPatternTimer / Math.max(0.01, bossPatternDuration));
      sw.curAngle = sw.startAngle + (sw.endAngle - sw.startAngle) * prog;
      const bx2 = b.x + Math.sin(sw.curAngle) * sw.length;
      const by2 = sw.targetY + (prog - 0.5) * 2.0 * sw.tiltY;
      const bz2 = b.z + Math.cos(sw.curAngle) * sw.length;
      const dBeam = pointToSegmentDist3D(px, py, pz, b.x, b.y, b.z, bx2, by2, bz2);
      if (dBeam < 12.0 && invulnTimer <= 0) {
        takeDamage(35, 'SOLAR SWEEP!');
      }
      if (bossPatternTimer <= 0) {
        if (sw.pass < sw.maxPasses) {
          // P2 2차 대각 교차 스윕
          sw.pass++;
          sw.dir = -sw.dir;
          sw.baseYaw = Math.atan2(px - b.x, pz - b.z);
          sw.startAngle = sw.baseYaw - sw.dir * 0.663;
          sw.endAngle = sw.baseYaw + sw.dir * 0.663;
          sw.curAngle = sw.startAngle;
          sw.targetY = Math.max(24.0, Math.min(185.0, py));
          sw.tiltY = sw.dir * 52.0;
          bossPatternStage = 'WARN';
          bossPatternTimer = 0.72;
          bossPatternDuration = 0.72;
          bossHoverLockTimer = 1.6;
        } else {
          bossSweep = null;
          bossPatternStage = 'RECOVER';
          bossPatternTimer = 0.90;
          bossHoverLockTimer = 0.90;
        }
      }
    }
  } else if (bossPatternType === 'BOMB') {
    // 패턴 B: ORBITAL LOCK-ON (3D 공중 폭격 구역 연쇄 기폭, 28 HP)
    let anyPending = false;
    for (let i = 0; i < bossBombZones.length; i++) {
      const z = bossBombZones[i];
      if (z.detonated) continue;
      anyPending = true;
      z.timer -= dt;
      const zd = Math.hypot(px - z.x, py - z.y, pz - z.z);
      if (zd < z.r + 3.0) bossPlayerInDanger = true;
      if (z.timer <= 0) {
        z.detonated = true;
        shockwaves.push({ x: z.x, y: z.y, z: z.z, r: 6, maxR: z.r * 1.15, life: 0.34, maxLife: 0.34, col: PAL.ORANGE });
        spawnExplosion(z.x, z.y, z.z, PAL.CRIMSON, PAL.GOLD, 18);
        shakeMag = Math.max(shakeMag, 3.4);
        if (typeof playSfx === 'function') playSfx('shockwave', 1.15);
        if (zd < z.r + 3.0 && invulnTimer <= 0) {
          takeDamage(28, 'ORBITAL BLAST!');
        }
      }
    }
    if (!anyPending) {
      bossBombZones = [];
      bossPatternStage = 'RECOVER';
      bossPatternTimer = 0.90;
      bossHoverLockTimer = 0.90;
    }
  } else if (bossPatternType === 'RING') {
    // 패턴 C: SKY RING (고도층 확장 에너지 링 파동, 24 HP)
    let anyAlive = false;
    for (let i = 0; i < bossSkyRings.length; i++) {
      const rg = bossSkyRings[i];
      if (rg.r >= rg.maxR) continue;
      anyAlive = true;
      rg.x = b.x; rg.z = b.z;
      const inBand = (Math.abs(py - rg.y) < rg.bandH);
      if (!rg.active) {
        rg.warnTimer -= dt;
        if (inBand) bossPlayerInDanger = true;
        if (rg.warnTimer <= 0) {
          rg.active = true;
          shakeMag = Math.max(shakeMag, 3.0);
          if (typeof playSfx === 'function') playSfx('shockwave', 1.05);
        }
      } else {
        rg.r += 172.0 * dt;
        const hd = Math.hypot(px - rg.x, pz - rg.z);
        if (inBand && Math.abs(hd - rg.r) < 28.0) bossPlayerInDanger = true;
        if (!rg.hitDone && inBand && Math.abs(hd - rg.r) < 12.0 && invulnTimer <= 0) {
          rg.hitDone = true;
          takeDamage(24, 'SKY RING!');
        }
      }
    }
    if (!anyAlive) {
      bossSkyRings = [];
      bossPatternStage = 'RECOVER';
      bossPatternTimer = 0.90;
      bossHoverLockTimer = 0.90;
    }
  }

  // 4) 40초 회피턴 중 호위 몹 전멸 시 소규모 증원
  let escortCount = 0;
  for (let i = 0; i < enemies.length; i++) {
    if (!enemies[i].isBoss) escortCount++;
  }
  if (escortCount <= 1 && bossPhaseTimer > 12.0) {
    bossEscortTimer -= dt;
    if (bossEscortTimer <= 0) {
      bossEscortTimer = 14.0;
      spawnBossEscorts(bossStage, true);
    }
  }

  // 5) 회피턴 시간 종료 -> 그로기 턴 진입
  if (bossPhaseTimer <= 0) {
    startBossGroggyTurn();
  }
}
