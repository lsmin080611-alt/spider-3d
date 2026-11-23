'use strict';
// Spider 3D — 6-Minute Boss Battle (OMEGA SOVEREIGN)

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
  bossFireTimer = 0.0;
  bossPulseState = 'IDLE';
  bossPulseTimer = 0.0;
  bossPulseCd = 3.5;
  bossLaserState = 'IDLE';
  bossLaserTimer = 0.0;
  bossLaserCd = 5.0;
  bossMines = [];
  runCleared = false;
}

function spawnBossMines(stage) {
  bossMines = [];
  if (!bossEntity) return;
  const orbitCount = stage >= 2 ? 7 : 5;
  for (let i = 0; i < orbitCount; i++) {
    const ang = (i / orbitCount) * Math.PI * 2;
    const orbitR = 40.0 + (i % 2) * 11.0;
    const yOff = ((i % 3) - 1) * 12.0;
    bossMines.push({
      x: bossEntity.x + Math.cos(ang) * orbitR,
      y: Math.max(24.0, bossEntity.y + yOff),
      z: bossEntity.z + Math.sin(ang) * orbitR,
      radius: 7.2,
      orbitMode: true,
      orbitAngle: ang,
      orbitR,
      orbitYOff: yOff,
      orbitSpd: (stage >= 2 ? 1.45 : 1.10) * ((i & 1) ? 1 : -1),
      phase: i * 1.1,
      respawnTimer: 0.0
    });
  }
  const corridorCount = stage >= 2 ? 3 : 2;
  const world = getNearbyWorld();
  for (let j = 0; j < corridorCount; j++) {
    const spread = ((j / Math.max(1, corridorCount - 1)) - 0.5) * 0.72;
    const yaw = camYaw + spread;
    const dist = 78.0 + j * 36.0;
    const my = 52.0 + j * 28.0;
    const safe = pushOutOfBuildings(px + Math.sin(yaw) * dist, my, pz + Math.cos(yaw) * dist, 18.0, world.buildings);
    bossMines.push({
      x: safe.x, y: my, z: safe.z,
      radius: 8.2,
      orbitMode: false,
      orbitAngle: 0,
      orbitR: 0,
      orbitYOff: 0,
      orbitSpd: 0,
      phase: j * 1.9,
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
  bossFireTimer = 2.0;
  bossPulseState = 'IDLE';
  bossPulseCd = 3.2;
  bossLaserState = 'IDLE';
  bossLaserCd = 4.6;
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
  bossMines = [];
  bossPulseState = 'IDLE';
  bossLaserState = 'IDLE';
  spawnBossSynergyDrones();
  hitStopTimer = Math.max(hitStopTimer, 0.065);
  shakeMag = Math.max(shakeMag, 5.5);
  shockwaves.push({ x: bossEntity.x, y: bossEntity.y, z: bossEntity.z, r: 12, maxR: 165, life: 0.48, maxLife: 0.48, col: PAL.GOLD });
  spawnExplosion(bossEntity.x, bossEntity.y, bossEntity.z, PAL.GOLD, PAL.NEON_CYAN, 34);
  addPopup('CORE EXPOSED!! 6.5s BREAK!', PAL.GOLD, 3);
  if (typeof playSfx === 'function') playSfx('boss_groggy');
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
  bossMines = [];
  clearStrikeState();
  hp = Math.min(MAX_HP, hp + 25);

  const sinY = Math.sin(camYaw), cosY = Math.cos(camYaw);
  const world = getNearbyWorld();
  const bx = px + sinY * 135.0;
  const bz = pz + cosY * 135.0;
  const safe = pushOutOfBuildings(bx, 105.0, bz, 28.0, world.buildings);
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

  // INTRO: 2.2초간 상공에서 중간 고도(105m)로 강하 (플레이어 스윙 유지)
  if (bossPhase === 'INTRO') {
    bossPhaseTimer -= dt;
    const sinY = Math.sin(camYaw), cosY = Math.cos(camYaw);
    const desiredX = px + sinY * 130.0;
    const desiredZ = pz + cosY * 130.0;
    const safe = pushOutOfBuildings(desiredX, 105.0, desiredZ, 28.0, bList);
    const lerpT = Math.min(1.0, 2.8 * dt);
    b.x += (safe.x - b.x) * lerpT;
    b.z += (safe.z - b.z) * lerpT;
    b.y += (105.0 - b.y) * Math.min(1.0, 3.2 * dt);
    if (bossPhaseTimer <= 0) {
      startBossEvadeTurn();
    }
    return;
  }

  bossBattleTime += dt;

  // 보스 위치 제어: 모든 빌드 유불리 최소화를 위해 중간 고도(78~125m, 그로기 95m) + 전방 복도 유지
  const sinY = Math.sin(camYaw), cosY = Math.cos(camYaw);
  const rightX = cosY, rightZ = -sinY;
  const dxP = px - b.x, dyP = py - b.y, dzP = pz - b.z;
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

  // === EVADE TURN (40초 압박 + 접근 방해 기믹) ===
  if (!apexActive) bossPhaseTimer -= dt;

  const sideSwing = Math.sin(simTime * 0.72) * 34.0;
  const desiredDist = bossStage >= 2 ? 128.0 : 120.0;
  const desiredX = px + sinY * desiredDist + rightX * sideSwing;
  const desiredZ = pz + cosY * desiredDist + rightZ * sideSwing;
  const desiredY = Math.max(78.0, Math.min(125.0, 102.0 + Math.sin(simTime * 0.95) * 20.0));
  const moveSpd = distToP > 210.0 ? 2.6 : 1.15;
  b.x += (desiredX - b.x) * Math.min(1.0, moveSpd * dt);
  b.z += (desiredZ - b.z) * Math.min(1.0, moveSpd * dt);
  b.y += (desiredY - b.y) * Math.min(1.0, 2.2 * dt);
  const safeB = pushOutOfBuildings(b.x, b.y, b.z, 26.0, bList);
  b.x = safeB.x; b.z = safeB.z;

  // 1) 보스 공전 기뢰 & 비행 경로 부유 기뢰 업데이트 + 충돌 판정
  const lvElastic = getLv('elastic');
  for (let i = 0; i < bossMines.length; i++) {
    const m = bossMines[i];
    if (m.respawnTimer > 0) {
      m.respawnTimer = Math.max(0, m.respawnTimer - dt);
      continue;
    }
    if (m.orbitMode) {
      m.orbitAngle += m.orbitSpd * dt;
      m.x = b.x + Math.cos(m.orbitAngle) * m.orbitR;
      m.z = b.z + Math.sin(m.orbitAngle) * m.orbitR;
      m.y = Math.max(22.0, b.y + m.orbitYOff + Math.sin(simTime * 2.2 + m.phase) * 6.0);
    } else {
      m.y += Math.sin(simTime * 1.8 + m.phase) * 5.0 * dt;
      const md = Math.hypot(m.x - px, m.y - py, m.z - pz);
      if (md > 265.0) {
        const ny = camYaw + (Math.random() - 0.5) * 0.7;
        const safeM = pushOutOfBuildings(px + Math.sin(ny) * 115.0, 48.0 + Math.random() * 75.0, pz + Math.cos(ny) * 115.0, 18.0, bList);
        m.x = safeM.x; m.y = 48.0 + Math.random() * 75.0; m.z = safeM.z;
      }
    }

    const dMine = pointToSegmentDist3D(m.x, m.y, m.z, oldX, oldY, oldZ, px, py, pz);
    if (dMine < m.radius + 3.4) {
      if (lvElastic > 0 && elasticChargesLeft > 0) {
        // 탄성 반발 보유 시 기뢰 충돌도 반사 역전!
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
      } else if (!isStrikeProtected && invulnTimer <= 0) {
        const nx = px - m.x, nz = pz - m.z;
        const nl = Math.hypot(nx, nz) || 1.0;
        vx = (nx / nl) * 34.0;
        vz = (nz / nl) * 34.0;
        vy = Math.max(18.0, vy * 0.35);
        m.respawnTimer = 3.5;
        spawnExplosion(m.x, m.y, m.z, PAL.CRIMSON, PAL.GOLD, 16);
        takeDamage(12, 'SKY MINE!');
      }
    }
  }

  // 2) 근접 견제 반발 펄스 (보스 95m 이내 접근 시 예고 -> 58m 반발 폭발)
  if (bossPulseState === 'IDLE') {
    bossPulseCd -= dt;
    if (bossPulseCd <= 0 && distToP < 95.0) {
      bossPulseState = 'WARN';
      bossPulseTimer = 0.85;
      addPopup('REPULSOR WARNING!', PAL.CRIMSON, 1);
    }
  } else if (bossPulseState === 'WARN') {
    bossPulseTimer -= dt;
    if (bossPulseTimer <= 0) {
      bossPulseState = 'IDLE';
      bossPulseCd = bossStage >= 2 ? 3.8 : 4.8;
      shockwaves.push({ x: b.x, y: b.y, z: b.z, r: 8, maxR: 62, life: 0.36, maxLife: 0.36, col: PAL.CRIMSON });
      shakeMag = Math.max(shakeMag, 4.2);
      if (distToP < 58.0 && !isStrikeProtected && invulnTimer <= 0) {
        const nl = Math.hypot(dxP, dzP) || 1.0;
        vx = (dxP / nl) * 48.0;
        vz = (dzP / nl) * 48.0;
        vy = Math.max(22.0, vy * 0.4 + 16.0);
        takeDamage(14, 'REPULSOR BLAST!');
      }
    }
  }

  // 3) 조준 레이저 (SOLAR BEAM: 예고 조준선 -> 고출력 빔 발사)
  if (bossLaserState === 'IDLE') {
    bossLaserCd -= dt;
    if (bossLaserCd <= 0 && distToP < 260.0) {
      bossLaserState = 'AIM';
      bossLaserTimer = bossStage >= 2 ? 0.95 : 1.15;
      bossLaserTx = px + vx * 0.32;
      bossLaserTy = Math.max(12.0, py + vy * 0.22);
      bossLaserTz = pz + vz * 0.32;
    }
  } else if (bossLaserState === 'AIM') {
    bossLaserTimer -= dt;
    if (bossLaserTimer > 0.42) {
      const trackT = Math.min(1.0, 2.2 * dt);
      bossLaserTx += ((px + vx * 0.25) - bossLaserTx) * trackT;
      bossLaserTy += (Math.max(12.0, py + vy * 0.18) - bossLaserTy) * trackT;
      bossLaserTz += ((pz + vz * 0.25) - bossLaserTz) * trackT;
    }
    if (bossLaserTimer <= 0) {
      bossLaserState = 'FIRE';
      bossLaserTimer = 0.50;
      shakeMag = Math.max(shakeMag, 3.6);
    }
  } else if (bossLaserState === 'FIRE') {
    bossLaserTimer -= dt;
    const bx1 = b.x, by1 = b.y, bz1 = b.z;
    const bx2 = b.x + (bossLaserTx - b.x) * 2.2;
    const by2 = b.y + (bossLaserTy - b.y) * 2.2;
    const bz2 = b.z + (bossLaserTz - b.z) * 2.2;
    const dBeam = pointToSegmentDist3D(px, py, pz, bx1, by1, bz1, bx2, by2, bz2);
    if (dBeam < 10.5 && invulnTimer <= 0 && !isStrikeProtected) {
      takeDamage(18, 'SOLAR BEAM!');
    }
    if (bossLaserTimer <= 0) {
      bossLaserState = 'IDLE';
      bossLaserCd = bossStage >= 2 ? 4.4 : 5.6;
    }
  }

  // 4) 보스 부채꼴 플라즈마 탄막 (5발 -> 2페이즈 7발)
  bossFireTimer -= dt;
  if (bossFireTimer <= 0 && projectiles.length < 28 && distToP < 280.0) {
    bossFireTimer = bossStage >= 2 ? 2.4 : 3.0;
    const fanCount = bossStage >= 2 ? 7 : 5;
    const pSpd = bossStage >= 2 ? 82.0 : 72.0;
    const aimX = (px + vx * 0.22) - b.x;
    const aimY = (py + vy * 0.16) - b.y;
    const aimZ = (pz + vz * 0.22) - b.z;
    const aimD = Math.hypot(aimX, aimY, aimZ) || 1.0;
    const baseDx = aimX / aimD, baseDy = aimY / aimD, baseDz = aimZ / aimD;
    for (let k = 0; k < fanCount; k++) {
      const ang = ((k / (fanCount - 1)) - 0.5) * (bossStage >= 2 ? 0.62 : 0.48);
      const cA = Math.cos(ang), sA = Math.sin(ang);
      const fx = baseDx * cA - baseDz * sA;
      const fz = baseDx * sA + baseDz * cA;
      projectiles.push({
        x: b.x, y: b.y, z: b.z,
        vx: fx * pSpd, vy: baseDy * pSpd, vz: fz * pSpd,
        life: 4.5, col: bossStage >= 2 ? PAL.GOLD : PAL.CRIMSON
      });
    }
  }

  // 5) 40초 회피턴 중 호위 몹 전멸 시 소규모 증원
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

  // 6) 회피턴 시간 종료 -> 그로기 턴 진입
  if (bossPhaseTimer <= 0) {
    startBossGroggyTurn();
  }
}
