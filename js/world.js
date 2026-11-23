'use strict';
// Spider 3D — Non-Uniform Manhattan Generator, Wave Spawner & Reset

// =========================================================================
// 4. NON-UNIFORM MANHATTAN GENERATOR (WIDE BOULEVARDS, PLAZAS, 440m SPIRES)
//    & 3-TIER SQUAD ENEMY WAVE SPAWNER (SWARM CHASERS + RANGED TIER 2/3)
// =========================================================================
function getBlockData(gx, gz) {
  const cx = gx * BLOCK_SIZE;
  const cz = gz * BLOCK_SIZE;
  const buildings = [];
  const blockSeed = Math.abs(((gx * 73856093) ^ (gz * 19349663) ^ 19283746) | 0);

  const isGrandAve = (gx === 0);
  const zoneType = blockSeed % 6;

  if (gx === 0 && gz === 0) {
    // Step 2: 구름 위 540m 오프닝 전용 랜드마크 타워 (본 게임 ACTIVE 진입 후에는 자연스럽게 도심으로 정리)
    if (openingPhase !== 'ACTIVE') {
      buildings.push({
        bx: START_ROOF.bx, bz: START_ROOF.bz, bw: START_ROOF.bw, bd: START_ROOF.bd, bh: START_ROOF.bh,
        palIdx: 2, seed: 7777, hasSpire: false, hasPenthouse: false, hasWaterTower: false, awningIdx: 0, isStartRoof: true
      });
    }
    // 첫 스윙 앵커 보장용 전방 좌/우 초고층 타워
    buildings.push({
      bx: 82.0, bz: 55.0, bw: 48.0, bd: 48.0, bh: 380.0,
      palIdx: 0, seed: 10293, hasSpire: true, hasPenthouse: true, hasWaterTower: false, awningIdx: 1
    });
    buildings.push({
      bx: -82.0, bz: 110.0, bw: 48.0, bd: 48.0, bh: 365.0,
      palIdx: 3, seed: 20481, hasSpire: true, hasPenthouse: false, hasWaterTower: true, awningIdx: 2
    });
  } else {
    let slots = [];
    if (isGrandAve) {
      const sideShift = ((gz & 1) === 0) ? 1 : -1;
      slots = [[84.0 * sideShift, -25.0 * sideShift]];
    } else if (zoneType === 0) {
      slots = [[64.0, -56.0]];
    } else if (zoneType === 1) {
      slots = [[-62.0, -42.0], [58.0, 44.0]];
    } else if (zoneType === 2) {
      slots = [[-54.0, 26.0], [60.0, -32.0]];
    } else {
      const jx1 = ((blockSeed >> 4) % 24) - 12;
      const jz1 = ((blockSeed >> 7) % 24) - 12;
      const jx2 = ((blockSeed >> 10) % 24) - 12;
      const jz2 = ((blockSeed >> 13) % 24) - 12;
      slots = [[-60.0 + jx1, -38.0 + jz1], [60.0 + jx2, 38.0 + jz2]];
    }

    for (let idx = 0; idx < slots.length; idx++) {
      const ox = slots[idx][0], oz = slots[idx][1];
      const hSeed = Math.abs(((gx * 73856093) ^ (gz * 19349663) ^ ((idx + 1) * 83492791)) | 0);

      let bh;
      if (zoneType === 1) {
        bh = 285.0 + (hSeed % 156);
      } else if (zoneType === 2) {
        bh = 85.0 + (hSeed % 72);
      } else if (isGrandAve) {
        bh = 210.0 + (hSeed % 175);
      } else {
        bh = 145.0 + (hSeed % 195);
      }

      const bw = 40.0 + (hSeed % 18);
      const bd = 40.0 + ((hSeed >> 3) % 18);
      const palIdx = hSeed % 5;
      const hasSpire = (hSeed % 3) === 0 || zoneType === 1;
      const hasPenthouse = (hSeed % 2) === 0;
      const hasWaterTower = ((hSeed >> 2) % 3) === 1;
      const awningIdx = (hSeed >> 5) % PAL.AWNINGS.length;
      buildings.push({ bx: cx + ox, bz: cz + oz, bw, bd, bh, palIdx, seed: hSeed, hasSpire, hasPenthouse, hasWaterTower, awningIdx });
    }
  }

  // 2개 고도층 구름 (중고공 215~330m + 성층권 355~495m)
  const cSeed = Math.abs(((gx * 19349663) ^ (gz * 83492791) ^ 55117) | 0);
  const drift = (simTime * 3.8) % BLOCK_SIZE;
  const cloudLow = {
    x: cx + (((cSeed % 170) - 85 + drift + BLOCK_SIZE) % BLOCK_SIZE) - BLOCK_SIZE * 0.5,
    y: 215.0 + (cSeed % 115),
    z: cz + (((cSeed >> 4) % 170) - 85),
    scale: 0.78 + ((cSeed >> 8) % 35) * 0.012
  };
  const cloudHigh = {
    x: cx + ((((cSeed >> 3) % 170) - 85 + drift * 1.3 + BLOCK_SIZE) % BLOCK_SIZE) - BLOCK_SIZE * 0.5,
    y: 355.0 + ((cSeed >> 5) % 140),
    z: cz + ((((cSeed >> 7) % 170) - 85)),
    scale: 0.92 + ((cSeed >> 10) % 30) * 0.014
  };

  const park = zoneType === 0
    ? { x: cx - 18.0, z: cz + 18.0, w: 96.0, d: 96.0, seed: cSeed }
    : { x: cx - 58.0, z: cz + 38.0, w: 46.0, d: 46.0, seed: cSeed };

  return { gx, gz, cx, cz, buildings, clouds: [cloudLow, cloudHigh], park };
}

function getNearbyWorldAt(refX, refZ) {
  const curGx = Math.round(refX / BLOCK_SIZE);
  const curGz = Math.round(refZ / BLOCK_SIZE);
  const buildings = [], clouds = [], parks = [], blocks = [];
  for (let dgx = -2; dgx <= 2; dgx++) {
    for (let dgz = -2; dgz <= 2; dgz++) {
      const d = getBlockData(curGx + dgx, curGz + dgz);
      blocks.push(d);
      for (let i = 0; i < d.buildings.length; i++) buildings.push(d.buildings[i]);
      clouds.push(d.clouds[0], d.clouds[1]);
      parks.push(d.park);
    }
  }
  return { blocks, buildings, clouds, parks };
}

function getNearbyWorld() {
  return getNearbyWorldAt(px, pz);
}

function pushOutOfBuildings(ex, ey, ez, pad, bList) {
  let x = ex, z = ez;
  for (let i = 0; i < bList.length; i++) {
    const b = bList[i];
    if (ey < b.bh + 6.0) {
      const hw = b.bw * 0.5 + pad;
      const hd = b.bd * 0.5 + pad;
      if (x > b.bx - hw && x < b.bx + hw && z > b.bz - hd && z < b.bz + hd) {
        const ox = Math.min(x - (b.bx - hw), (b.bx + hw) - x);
        const oz = Math.min(z - (b.bz - hd), (b.bz + hd) - z);
        if (ox < oz) x = x < b.bx ? (b.bx - hw - 2) : (b.bx + hw + 2);
        else z = z < b.bz ? (b.bz - hd - 2) : (b.bz + hd + 2);
      }
    }
  }
  return { x, z };
}

// 3-Tier Wave Spawner:
// - 1단계 SWARM: 플레이어를 추격하며 몰려드는 근접 스웜 편대 (원거리 사격 X, 오라/고압줄/도미노 학살용)
// - 2단계 MEDIUM: 95~155m 거리를 유지하며 측면 선회 + 원거리 플라즈마 사격
// - 3단계 ELITE (Wave 3+): 115~185m 거리를 유지하며 3발 부채꼴 원거리 포격
function spawnWave(waveNum) {
  enemies = [];
  projectiles = [];
  pendingExplosions = [];
  clearStrikeState();
  strikeGraceTimer = 0;

  const world = getNearbyWorld();

  // 1) 1단계 스웜 드론 편대 (진행 방향 전방 궤도 요격형, 8~16기)
  const squadCount = Math.min(4, 2 + Math.floor(waveNum / 2));
  const perSquad = 4;
  for (let sq = 0; sq < squadCount; sq++) {
    const sqAngle = ((sq / Math.max(1, squadCount - 1)) - 0.5) * 0.85 + (Math.random() - 0.5) * 0.20;
    const yaw = camYaw + sqAngle;
    const dist = 95.0 + sq * 30.0 + Math.random() * 22.0;
    const isLowSquad = (sq % 2 === 0);
    const baseAlt = isLowSquad
      ? (18.0 + Math.random() * 34.0)
      : Math.max(22.0, Math.min(185.0, py + (Math.random() - 0.5) * 40.0));
    const cx = px + Math.sin(yaw) * dist;
    const cz = pz + Math.cos(yaw) * dist;
    const safeCenter = pushOutOfBuildings(cx, baseAlt, cz, 18.0, world.buildings);

    for (let m = 0; m < perSquad; m++) {
      const ang = (m / perSquad) * Math.PI * 2 + sq * 0.6;
      const sx = safeCenter.x + Math.cos(ang) * 14.0;
      const sz = safeCenter.z + Math.sin(ang) * 14.0;
      const sy = Math.max(12.0, baseAlt + ((m & 1) ? 4.5 : -4.5));
      const swarmHp = 24 + Math.min(16, (waveNum - 1) * 3);

      enemies.push({
        tier: 'SWARM',
        type: 'SWARM_DRONE',
        x: sx, y: sy, z: sz,
        vx: 0, vy: 0, vz: 0,
        flockAngle: ang,
        flockDist: 10.0 + (m % 3) * 5.0,
        lowBias: isLowSquad,
        hp: swarmHp, maxHp: swarmHp,
        radius: 7.6,
        phase: Math.random() * Math.PI * 2,
        fireTimer: 999.0, // 잡몹은 원거리 사격 없이 전방 요격 전용
        hitFlash: 0
      });
    }
  }

  // 2) 2단계 중형: 저공 고정 터렛(WALL_TURRET, 18~62m) vs 중공 코어(SKY_CORE, 85~165m) 고도층 분리
  const medCount = Math.min(6, 2 + waveNum);
  for (let i = 0; i < medCount; i++) {
    const spread = ((i / Math.max(1, medCount - 1)) - 0.5) * 1.05 + (Math.random() - 0.5) * 0.16;
    const yaw = camYaw + spread;
    const dist = 110.0 + (i % 3) * 30.0 + Math.random() * 18.0;
    const isSky = (i % 2 === 1);
    const ey = isSky ? (85.0 + Math.random() * 78.0) : (18.0 + Math.random() * 42.0);
    const safe = pushOutOfBuildings(px + Math.sin(yaw) * dist, ey, pz + Math.cos(yaw) * dist, 18.0, world.buildings);
    const medHp = (isSky ? 98 : 92) + (waveNum - 1) * 16;

    enemies.push({
      tier: 'MEDIUM',
      type: isSky ? 'SKY_CORE' : 'WALL_TURRET',
      x: safe.x, y: ey, z: safe.z,
      vx: 0, vy: 0, vz: 0,
      orbitDir: (i & 1) ? 1 : -1,
      minRange: isSky ? 88.0 : 72.0,
      maxRange: isSky ? 148.0 : 138.0,
      altMin: isSky ? 72.0 : 16.0,
      altMax: isSky ? 210.0 : 68.0,
      anchorAlt: ey,
      altOffset: isSky ? 10.0 : 0.0,
      hp: medHp, maxHp: medHp,
      radius: isSky ? 11.0 : 10.0,
      phase: Math.random() * Math.PI * 2,
      fireTimer: 1.8 + Math.random() * 1.8,
      hitFlash: 0
    });
  }

  // 3) 3단계 웨이브 엘리트 거대 코어 (Wave 3+ 등장, 중·고공층 유지로 고공 SLAM 표적 지원)
  if (waveNum >= 3) {
    const eliteCount = waveNum >= 5 ? 2 : 1;
    for (let b = 0; b < eliteCount; b++) {
      const yaw = camYaw + (eliteCount === 1 ? 0 : (b === 0 ? -0.30 : 0.30));
      const dist = 148.0 + b * 32.0;
      const ey = 100.0 + Math.random() * 75.0;
      const safe = pushOutOfBuildings(px + Math.sin(yaw) * dist, ey, pz + Math.cos(yaw) * dist, 24.0, world.buildings);
      const eliteHp = 310 + (waveNum - 3) * 90;

      enemies.push({
        tier: 'ELITE',
        type: 'ELITE_CORE',
        x: safe.x, y: ey, z: safe.z,
        vx: 0, vy: 0, vz: 0,
        orbitDir: (b & 1) ? 1 : -1,
        minRange: 105.0,
        maxRange: 175.0,
        altMin: 78.0,
        altMax: 230.0,
        anchorAlt: ey,
        altOffset: 12.0,
        hp: eliteHp, maxHp: eliteHp,
        radius: 15.5,
        phase: Math.random() * Math.PI * 2,
        fireTimer: 1.8 + Math.random() * 1.2,
        hitFlash: 0
      });
    }
  }

  addPopup('WAVE ' + waveNum + ' · ' + enemies.length + ' HOSTILES!', PAL.GOLD, 3);
}


function resetGame() {
  camYaw = 0.0;
  isSwinging = false;
  swingHeld = false;
  ax = 0; ay = 0; az = 0; ropeLen = 0;
  anchorSide = 1; lastAnchorSide = -1;
  swingTimer = 0; passedBottom = false;
  autoCatchAfterJump = false; groundLaunchTimer = 0;
  swingReattachCooldown = 0; swingWebShootTimer = 0; isRopeTaut = false;
  flipAngle = 0.0; doingFlip = false; shakeMag = 0;
  inPerfectWindow = false; perfectGraceTimer = 0; hitStopTimer = 0;
  diveCharge = 0; isDiving = false; isGliding = false;
  homingTarget = null;
  clearStrikeState();
  strikeEntrySpd = 0; strikeEntryDist = 0; strikeMotionIdx = 0; strikeCamBlend = 0; strikeCooldown = 0; strikeGraceTimer = 0;
  skimTechTimer = 0;
  auraTickTimer = 0; webZapTimer = 0; multiKillCount = 0; multiKillWindow = 0;
  afterimageTimer = 0; afterimages = [];
  hp = MAX_HP; invulnTimer = 0; damageFlash = 0; gameOver = false;
  gameOverReason = '';
  wave = 1; kills = 0; waveClearDelay = 0;
  enemies = []; projectiles = [];
  runTimeRemaining = RUN_DURATION;
  runTimerZeroTriggered = false;
  resetBossState();
  resetApexCutState();
  stylePoints = 0.0;
  styleRankIdx = 0;
  peakStyleRankIdx = 0;
  stylePopTimer = 0.0;
  stylePopDir = 1;
  stylePulseTimer = 0.0;
  swingCombo = 0; comboTimer = 0;
  wallSkimIntensity = 0; wallSkimSide = 0; groundSkimIntensity = 0;
  wallSlideCooldown = 0;
  popups = []; sparks = [];
  currentStage = 0;
  openingEdgePause = 0.0;
  openingCloudRush = 0.0;
  openingPoseRadial = 0.0;
  resetAugments();
  setStageIndicator(0);

  // 안 B: 최초 실행은 510m 첨탑 옥상(ROOF_WAIT) -> 5.6초 5-Cut 컷신, 재도전 시 타워 앞 완전 개방 허공(395m) 1.5초 압축 컷신
  if (!hasSeenRoofIntro) {
    openingPhase = 'ROOF_WAIT';
    openingRetryDrop = false;
    openingTimer = 0.0;
    openingPoseMode = 'IDLE';
    openingLetterbox = 1.0;
    openingCamBlend = 1.0;
    px = 0.0; py = START_ROOF.bh + 2.1; pz = -105.5;
    vx = 0.0; vy = 0.0; vz = 0.0;
    openCamX = 3.8; openCamY = py + 1.5; openCamZ = pz - 7.5;
    camDist = 11.5; camLagYaw = Math.atan2(px - openCamX, (pz + 14.0) - openCamZ); camPitch = -0.10; camRoll = 0.0; fovD = 190.0;
  } else {
    openingPhase = 'DROP_INTRO';
    openingRetryDrop = true;
    openingTimer = 0.0;
    openingPoseMode = 'DIVE';
    openingLetterbox = 1.0;
    openingCamBlend = 1.0;
    px = 0.0; py = 395.0; pz = -62.0;
    vx = 0.0; vy = -24.0; vz = 16.0;
    openCamX = 12.0; openCamY = 405.0; openCamZ = -76.0;
    camDist = 14.0; camLagYaw = Math.atan2(px - openCamX, pz - openCamZ); camPitch = -0.45; camRoll = 0.0; fovD = 200.0;
  }
  peakYBeforeSwing = py;
  swingMinY = py;
}
