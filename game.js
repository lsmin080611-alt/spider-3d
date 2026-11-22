'use strict';

// =========================================================================
// 3. GAME STATE, 3-TIER WAVE COMBAT & MANUAL 2-CASE STRIKE ENGINE
// =========================================================================
// 기본(노증강) 물리 기준값: 기본은 슴슴하고 쾌적하게, 증강으로 폭발적 성장 체감
const GAME_MAX_ALTITUDE = 650.0;     // 고도 제한 대폭 해제 (335m -> 650m)
const BASE_GRAVITY = 42.0;           // 여유로운 기본 낙하
const BASE_AIR_DRAG = 0.11;          // 진공 활공 체감 확대
const BASE_SWING_MAX_SPD = 108.0;    // 오버드라이브 성장 여지 확보
const BASE_FREE_MAX_SPD = 68.0;
const BASE_STRIKE_RUSH_SPD = 136.0;
const BASE_PIERCE_SPD = 78.0;

let px = 0, py = 124, pz = -60, vx = 0, vy = 0, vz = 24, camYaw = 0;
let isSwinging = false, ax = 0, ay = 0, az = 0, ropeLen = 0, anchorSide = 1, lastAnchorSide = -1;
let swingTimer = 0, passedBottom = false, peakYBeforeSwing = 124, swingMinY = 124;
let autoCatchAfterJump = false, groundLaunchTimer = 0;
let camDist = 15.5, camLagYaw = 0, camPitch = -0.06, camRoll = 0, fovD = 175.0;
let flipAngle = 0, doingFlip = false;
let shakeMag = 0;

// Timing, Glide & Manual Strike State
let inPerfectWindow = false;
let hitStopTimer = 0;
let diveCharge = 0;
let isDiving = false;
let isGliding = false;
let homingTarget = null;

// Manual 2-Case STRIKE + Chain Pinball State Machine
// strikeMode: 0=NONE, 1=CASE1_SLAM, 3=CASE3_CARTOON_OR_CHAIN
// strikePhase: 'NONE' | 'HANG_SHOOT' | 'RUSH'
let strikeMode = 0;
let strikePhase = 'NONE';
let strikeTarget = null;
let strikeTimer = 0;
let strikePhaseTimer = 0;
let strikePhaseDur = 0.1;
let strikeWebProg = 0;
let strikeEntrySpd = 0;
let strikeEntryDist = 0;  // STRIKE 발동 당시 타겟과의 거리 (원거리 도약 타격 보너스용)
let strikeMotionIdx = 0;
let strikeCamSide = 1;
let strikeCamBlend = 0;
let strikeCooldown = 0;
let strikeGraceTimer = 0; // 공격 직후 반동/관통 이탈 중 몸체 충돌 & 투사체 피격 방지 유예 시간
let skimTechTimer = 0;    // 벽/바닥 스침·월슬라이드 직후 기술 보너스 유지 타이머
let skimXpAcc = 0;        // 스킴 지속 경험치 누적 버퍼
let chainBouncesLeft = 0;
let chainVisited = [];
let isChainRush = false;

let afterimageTimer = 0;
let afterimages = [];

const CARTOON_MOTIONS = [
  { pose: 'STRIKE_TWOWEB',   spin: false, twinWeb: true,  word: 'THWIP!!' },
  { pose: 'STRIKE_PUNCH',    spin: false, twinWeb: false, word: 'SMASH!!' },
  { pose: 'STRIKE_DROPKICK', spin: false, twinWeb: false, word: 'WHAM!!'  },
  { pose: 'STRIKE_SPIN',     spin: true,  twinWeb: false, word: 'ZIP-SPIN!!' }
];

// HP, Wave Combat & Gimmick Timers
let hp = MAX_HP;
let invulnTimer = 0;
let damageFlash = 0;
let gameOver = false;
let wave = 1;
let kills = 0;
let waveClearDelay = 0;
let enemies = [];
let projectiles = [];

let auraTickTimer = 0;
let webZapTimer = 0;
let multiKillCount = 0;
let multiKillWindow = 0;

// Stage & Scoring State
let currentStage = 0;
let score = 0;
let bestScore = 0;
let swingCombo = 0;
let comboTimer = 0;
let wallSkimIntensity = 0, wallSkimSide = 0, groundSkimIntensity = 0;
let wallSlideCooldown = 0;
let popups = [], sparks = [];
let simTime = 0;

// Inputs
const keys = {};
let joyX = 0, joyY = 0, swingHeld = false;

function loadBestScore() {
  try {
    const parsed = parseInt(localStorage.getItem(BEST_STORAGE_KEY), 10);
    if (!Number.isNaN(parsed) && parsed > 0) bestScore = parsed;
  } catch (e) {}
}

function saveBestScore(val) {
  try { localStorage.setItem(BEST_STORAGE_KEY, String(val)); } catch (e) {}
}

function setStageIndicator(stageIdx) {
  const cfg = STAGE_CONFIGS[stageIdx] || STAGE_CONFIGS[0];
  if (stageDot) {
    stageDot.className = 'inline-block w-1.5 h-1.5 rounded-full animate-pulse ' + cfg.dotClass;
  }
  if (stageLabel) {
    stageLabel.textContent = 'PC-98 · ' + cfg.name;
  }
}

function addPopup(text, color, priority = 1) {
  if (popups.length > 0 && popups[0].text === text && popups[0].life > 0.35) return;
  if (priority >= 2 || popups.length === 0) {
    popups.unshift({ text: String(text), color, life: 1.25, maxLife: 1.25 });
    if (popups.length > 2) popups.pop();
  } else if (popups.length < 2) {
    popups.push({ text: String(text), color, life: 0.9, maxLife: 0.9 });
  }
}

function spawnSparks(x, y, z, col, count = 8, spread = 26) {
  for (let i = 0; i < count; i++) {
    sparks.push({
      x, y, z,
      vx: (Math.random() - 0.5) * spread,
      vy: (Math.random() - 0.5) * spread + 6,
      vz: (Math.random() - 0.5) * spread,
      life: 0.22 + Math.random() * 0.25,
      col
    });
  }
}

function spawnExplosion(x, y, z, colA, colB, count = 20) {
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const elev = (Math.random() - 0.5) * Math.PI;
    const spd = 18 + Math.random() * 44;
    sparks.push({
      x, y, z,
      vx: Math.cos(ang) * Math.cos(elev) * spd,
      vy: Math.sin(elev) * spd + 8,
      vz: Math.sin(ang) * Math.cos(elev) * spd,
      life: 0.30 + Math.random() * 0.30,
      col: (i & 1) ? colA : colB
    });
  }
}

// 3D Floating Pixel Damage Number Spawner
function spawnDamageNumber(x, y, z, dmg, col = '#ffffff', isCrit = false) {
  const txt = isCrit ? ('CRIT -' + dmg + '!') : ('-' + dmg);
  damageNumbers.push({
    x: x + (Math.random() - 0.5) * 4,
    y: y + 5,
    z: z + (Math.random() - 0.5) * 4,
    text: txt,
    col: isCrit ? PAL.GOLD : col,
    life: isCrit ? 0.85 : 0.62,
    maxLife: isCrit ? 0.85 : 0.62,
    big: isCrit || dmg >= 80
  });
  if (damageNumbers.length > 26) damageNumbers.shift();
}

// Lightweight Jagged 3D Pixel Lightning Segment (Zero Alpha Blur -> ESP32-S3 Ready!)
function spawnLightningBolt(x1, y1, z1, x2, y2, z2, col = PAL.NEON_CYAN, life = 0.16) {
  lightningBolts.push({ x1, y1, z1, x2, y2, z2, life, maxLife: life, col });
  if (lightningBolts.length > 24) lightningBolts.shift();
}

// 지정 반경 내 적 투사체 소거 헬퍼 (타격 폭발/충격파로 영거리 투사체 제거)
function clearProjectilesInRadius(cx, cy, cz, radius, sparkCol = PAL.NEON_CYAN) {
  let cleared = 0;
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const pr = projectiles[i];
    if (Math.hypot(pr.x - cx, pr.y - cy, pr.z - cz) <= radius) {
      spawnSparks(pr.x, pr.y, pr.z, sparkCol, 6, 26);
      projectiles.splice(i, 1);
      cleared++;
    }
  }
  return cleared;
}

// Unified Enemy Damage & Kill Handler (Supports 3 Tiers, Damage Numbers, Skill XP & Domino Chain!)
function applyEnemyDamage(e, dmg, col, isCrit = false, dominoDepth = 0, xpMult = 1.0, showOneShot = false) {
  const idx = enemies.indexOf(e);
  if (idx === -1) return false;

  const wasFullHp = (e.hp >= e.maxHp);
  const finalDmg = Math.max(1, Math.round(dmg));
  e.hp -= finalDmg;
  e.hitFlash = 0.22;
  spawnDamageNumber(e.x, e.y, e.z, finalDmg, col, isCrit);

  if (e.hp <= 0) {
    enemies.splice(idx, 1);
    kills++;
    multiKillCount++;
    multiKillWindow = 0.65;

    // 티어별 회복량, 점수, 기본 경험치 차등 지급
    const heal = e.tier === 'ELITE' ? 12 : (e.tier === 'MEDIUM' ? 5 : 2);
    hp = Math.min(MAX_HP, hp + heal);

    const basePts = e.tier === 'ELITE' ? 1600 : (e.tier === 'MEDIUM' ? 520 : 180);
    const cMult = Math.pow(1.38, Math.min(swingCombo, 10));
    score += Math.round(basePts * cMult);
    comboTimer = Math.max(comboTimer, 4.4);

    // 실력 보너스(xpMult)가 반영된 경험치 수급 (고속/원샷/기술 처치 시 빠른 레벨업)
    const baseXp = e.tier === 'ELITE' ? 135 : (e.tier === 'MEDIUM' ? 46 : 15);
    const oneShotBonus = (wasFullHp && e.tier !== 'SWARM') ? 1.30 : 1.0;
    const earnedXp = Math.max(5, Math.round(baseXp * xpMult * oneShotBonus));
    gainXp(earnedXp);

    const expColA = e.tier === 'ELITE' ? PAL.GOLD
      : (e.type === 'SKY_CORE' ? PAL.NEON_PINK
      : (e.type === 'WALL_TURRET' ? PAL.CRIMSON : PAL.NEON_CYAN));
    spawnExplosion(e.x, e.y, e.z, expColA, PAL.GOLD, e.tier === 'ELITE' ? 34 : (e.tier === 'SWARM' ? 12 : 22));

    if (e.tier === 'ELITE') {
      shakeMag = Math.max(shakeMag, 5.5);
      addPopup('ELITE DOWN!! +' + earnedXp + 'XP', PAL.GOLD, 3);
    } else if (showOneShot && wasFullHp && e.tier === 'MEDIUM') {
      addPopup('ONE-SHOT!! +' + earnedXp + 'XP', PAL.GOLD, 3);
    } else if (multiKillCount >= 3) {
      addPopup('MULTI KILL x' + multiKillCount + '!!', PAL.NEON_CYAN, 3);
    }

    // [도미노 폭발]: 적 처치 시 짧은 딜레이(0.07s) 후 2차 연쇄 폭발 예약
    const lvDomino = getLv('domino_boom');
    if (lvDomino > 0 && dominoDepth < 5) {
      pendingExplosions.push({
        x: e.x, y: e.y, z: e.z,
        radius: 48.0 + lvDomino * 12.0,
        dmg: 26 + lvDomino * 16,
        col: dominoDepth % 2 === 0 ? PAL.ORANGE : PAL.GOLD,
        delay: 0.07,
        depth: dominoDepth + 1
      });
    }
    return true;
  } else {
    spawnSparks(e.x, e.y, e.z, col, 6, 22);
    return false;
  }
}

// 광역 충격파 헬퍼 (초중력 C1 / 체공 예열 / 마찰 과열 / 탄성 반발 / 도미노 폭발 공용)
function triggerShockwave(cx, cy, cz, radius, dmg, col, ignoreEnemy = null, dominoDepth = 0) {
  shockwaves.push({ x: cx, y: cy, z: cz, r: 5, maxR: radius, life: 0.34, maxLife: 0.34, col });
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
    applyEnemyDamage(targets[i], dmg, col, false, dominoDepth, 1.15, false);
  }
}

function updateStageFromScore() {
  const targetStage = score >= 15000 ? 2 : (score >= 5000 ? 1 : 0);
  if (targetStage !== currentStage) {
    const prev = currentStage;
    currentStage = targetStage;
    setStageIndicator(currentStage);
    if (currentStage > prev) {
      if (currentStage === 1) {
        addPopup('SUNSET ZONE!', '#ffb85c', 3);
        spawnSparks(px, py, pz, PAL.GOLD, 16, 40);
      } else if (currentStage === 2) {
        addPopup('NEON NIGHT!', PAL.NEON_CYAN, 3);
        spawnSparks(px, py, pz, PAL.NEON_PINK, 18, 44);
      }
    }
  }
}

function endComboRun(reasonText = null, reasonColor = '#ff6b81') {
  const currentRun = Math.floor(score);
  if (currentRun > bestScore) {
    bestScore = currentRun;
    saveBestScore(bestScore);
    addPopup('NEW BEST! ' + bestScore, PAL.GOLD, 3);
  } else if (reasonText) {
    addPopup(reasonText, reasonColor, 2);
  }
  score = 0;
  swingCombo = 0;
  comboTimer = 0;
  updateStageFromScore();
}

function clearStrikeState() {
  strikeMode = 0;
  strikePhase = 'NONE';
  strikeTarget = null;
  strikeTimer = 0;
  strikePhaseTimer = 0;
  strikeWebProg = 0;
  chainBouncesLeft = 0;
  chainVisited = [];
  isChainRush = false;
}

function takeDamage(amount, reasonText) {
  if (invulnTimer > 0 || gameOver) return;
  hp = Math.max(0, hp - amount);
  invulnTimer = 0.85;
  damageFlash = 0.35;
  shakeMag = Math.max(shakeMag, 4.5);
  clearStrikeState();
  strikeGraceTimer = 0;
  endComboRun(reasonText + ' -' + amount + 'HP', PAL.CRIMSON);
  if (hp <= 0) {
    gameOver = true;
    isSwinging = false;
    inPerfectWindow = false;
    const cur = Math.floor(score);
    if (cur > bestScore) { bestScore = cur; saveBestScore(bestScore); }
  }
}

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

  // 1) 1단계 스웜 드론 편대 (플레이어를 추격해 다가옴, 8~16기)
  const squadCount = Math.min(4, 2 + Math.floor(waveNum / 2));
  const perSquad = 4;
  for (let sq = 0; sq < squadCount; sq++) {
    const sqAngle = ((sq / Math.max(1, squadCount - 1)) - 0.5) * 1.2 + (Math.random() - 0.5) * 0.25;
    const yaw = camYaw + sqAngle;
    const dist = 105.0 + sq * 32.0 + Math.random() * 25.0;
    const baseAlt = Math.max(24.0, Math.min(220.0, py + (sq - 1) * 28.0 + (Math.random() - 0.5) * 25.0));
    const cx = px + Math.sin(yaw) * dist;
    const cz = pz + Math.cos(yaw) * dist;
    const safeCenter = pushOutOfBuildings(cx, baseAlt, cz, 18.0, world.buildings);

    for (let m = 0; m < perSquad; m++) {
      const ang = (m / perSquad) * Math.PI * 2 + sq * 0.6;
      const sx = safeCenter.x + Math.cos(ang) * 14.0;
      const sz = safeCenter.z + Math.sin(ang) * 14.0;
      const sy = Math.max(14.0, baseAlt + ((m & 1) ? 5.0 : -5.0));
      const swarmHp = 24 + Math.min(16, (waveNum - 1) * 3);

      enemies.push({
        tier: 'SWARM',
        type: 'SWARM_DRONE',
        x: sx, y: sy, z: sz,
        vx: 0, vy: 0, vz: 0,
        flockAngle: ang,
        flockDist: 10.0 + (m % 3) * 5.0,
        hp: swarmHp, maxHp: swarmHp,
        radius: 7.6,
        phase: Math.random() * Math.PI * 2,
        fireTimer: 999.0, // 잡몹은 원거리 사격 없이 추격 전용
        hitFlash: 0
      });
    }
  }

  // 2) 2단계 중형 터렛 & 스카이 코어 (거리 유지 + 원거리 사격)
  const medCount = Math.min(6, 2 + waveNum);
  for (let i = 0; i < medCount; i++) {
    const spread = ((i / Math.max(1, medCount - 1)) - 0.5) * 1.45 + (Math.random() - 0.5) * 0.2;
    const yaw = camYaw + spread;
    const dist = 125.0 + (i % 3) * 32.0 + Math.random() * 20.0;
    const isSky = (i % 2 === 0);
    const ey = isSky ? (135.0 + Math.random() * 75.0) : (55.0 + Math.random() * 62.0);
    const safe = pushOutOfBuildings(px + Math.sin(yaw) * dist, ey, pz + Math.cos(yaw) * dist, 18.0, world.buildings);
    const medHp = (isSky ? 98 : 92) + (waveNum - 1) * 16;

    enemies.push({
      tier: 'MEDIUM',
      type: isSky ? 'SKY_CORE' : 'WALL_TURRET',
      x: safe.x, y: ey, z: safe.z,
      vx: 0, vy: 0, vz: 0,
      orbitDir: (i & 1) ? 1 : -1,
      minRange: 92.0,
      maxRange: 152.0,
      altMin: isSky ? 105.0 : 38.0,
      altMax: isSky ? 310.0 : 165.0,
      altOffset: isSky ? 26.0 : -10.0,
      hp: medHp, maxHp: medHp,
      radius: isSky ? 11.0 : 10.0,
      phase: Math.random() * Math.PI * 2,
      fireTimer: 1.8 + Math.random() * 1.8,
      hitFlash: 0
    });
  }

  // 3) 3단계 웨이브 엘리트 거대 코어 (초반 Wave 1~2 미등장, Wave 3부터 원거리 포격 보스 등장)
  if (waveNum >= 3) {
    const eliteCount = waveNum >= 5 ? 2 : 1;
    for (let b = 0; b < eliteCount; b++) {
      const yaw = camYaw + (eliteCount === 1 ? 0 : (b === 0 ? -0.35 : 0.35));
      const dist = 165.0 + b * 35.0;
      const ey = 145.0 + Math.random() * 75.0;
      const safe = pushOutOfBuildings(px + Math.sin(yaw) * dist, ey, pz + Math.cos(yaw) * dist, 24.0, world.buildings);
      const eliteHp = 310 + (waveNum - 3) * 90;

      enemies.push({
        tier: 'ELITE',
        type: 'ELITE_CORE',
        x: safe.x, y: ey, z: safe.z,
        vx: 0, vy: 0, vz: 0,
        orbitDir: (b & 1) ? 1 : -1,
        minRange: 115.0,
        maxRange: 185.0,
        altMin: 110.0,
        altMax: 360.0,
        altOffset: 34.0,
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
  px = 0.0; py = 124.0; pz = -60.0;
  vx = 0.0; vy = 0.0; vz = 24.0;
  camYaw = 0.0;
  isSwinging = false;
  swingHeld = false;
  ax = 0; ay = 0; az = 0; ropeLen = 0;
  anchorSide = 1; lastAnchorSide = -1;
  swingTimer = 0; passedBottom = false;
  peakYBeforeSwing = 124.0; swingMinY = 124.0;
  autoCatchAfterJump = false; groundLaunchTimer = 0;
  camDist = 15.5; camLagYaw = 0.0; camPitch = -0.06; camRoll = 0.0; fovD = 175.0;
  flipAngle = 0.0; doingFlip = false; shakeMag = 0;
  inPerfectWindow = false; hitStopTimer = 0;
  diveCharge = 0; isDiving = false; isGliding = false;
  homingTarget = null;
  clearStrikeState();
  strikeEntrySpd = 0; strikeEntryDist = 0; strikeMotionIdx = 0; strikeCamBlend = 0; strikeCooldown = 0; strikeGraceTimer = 0;
  skimTechTimer = 0; skimXpAcc = 0;
  auraTickTimer = 0; webZapTimer = 0; multiKillCount = 0; multiKillWindow = 0;
  afterimageTimer = 0; afterimages = [];
  hp = MAX_HP; invulnTimer = 0; damageFlash = 0; gameOver = false;
  wave = 1; kills = 0; waveClearDelay = 0;
  score = 0; swingCombo = 0; comboTimer = 0;
  wallSkimIntensity = 0; wallSkimSide = 0; groundSkimIntensity = 0;
  wallSlideCooldown = 0;
  popups = []; sparks = [];
  currentStage = 0;
  resetAugments();
  setStageIndicator(0);
  spawnWave(1);
}

function getInputs() {
  let turn = joyX, fwd = joyY;
  if (keys['KeyA'] || keys['ArrowLeft'])  turn -= 1;
  if (keys['KeyD'] || keys['ArrowRight']) turn += 1;
  if (keys['KeyW'] || keys['ArrowUp'])    fwd += 1;
  if (keys['KeyS'] || keys['ArrowDown'])  fwd -= 1;
  return { turn: Math.max(-1, Math.min(1, turn)), fwd: Math.max(-1, Math.min(1, fwd)) };
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

// 실력·가속 비례 데미지 & 경험치 배율 중앙 계산 (타격 판정 및 락온 1-HIT 예고 공용)
function computeStrikeDamage(mode, entrySpd, entryDist, downVy, isChain) {
  const aug = getAugStats();
  let rawDmg = 26.0;
  let skillMult = 1.0;
  let xpMult = 1.0;
  let isCrit = false;

  if (mode === 1) {
    // Case 1: 고공 하강 내리찍기 -> 초반 노증강에서도 2단계 중형 원샷 가능 + 높은 경험치 배율
    const fallSpd = Math.max(24.0, downVy, peakFallSpeed);
    rawDmg = 74.0 + Math.min(78.0, Math.max(0, fallSpd - 20.0) * 1.15) + diveCharge * 32.0;
    xpMult += 0.65;
    isCrit = rawDmg >= 95.0;
  } else if (isChain) {
    rawDmg = 46.0;
    xpMult += 0.35;
  } else {
    // Case 3: 근접 저속 Shift 난타(45 이하)는 26 dmg 고정, 스윙 가속(95~120+) 시 100+ 폭발 데미지
    if (entrySpd <= 45.0) {
      rawDmg = 26.0;
    } else {
      const speedNorm = Math.min(1.65, (entrySpd - 45.0) / 53.0);
      rawDmg = 26.0 + Math.pow(speedNorm, 1.38) * 74.0;
      if (entrySpd >= 95.0) {
        isCrit = true;
        xpMult += 0.75;
      } else if (entrySpd >= 72.0) {
        xpMult += 0.30;
      }
    }
    if (entryDist >= 75.0) {
      skillMult *= 1.15;
      xpMult += 0.20;
    }
  }

  // 초반 노증강 실력 기술 보너스 (퍼펙트 릴리즈 / 벽·바닥 스침 직후 타격)
  if (perfectBuffTimer > 0) {
    skillMult *= 1.35;
    xpMult += 0.45;
    isCrit = true;
  }
  if (skimTechTimer > 0) {
    skillMult *= 1.25;
    xpMult += 0.35;
  }

  rawDmg *= skillMult * aug.baseDmgMult;

  const lvAir = getLv('air_heat');
  if (lvAir > 0 && airTimeStack > 0.25) {
    rawDmg *= (1.0 + airTimeStack * (0.25 + lvAir * 0.10));
  }
  const lvFall = getLv('fall_mom');
  if (lvFall > 0 && peakFallSpeed > 22.0) {
    rawDmg *= (1.0 + (peakFallSpeed / 75.0) * (0.45 + lvFall * 0.25));
    if (peakFallSpeed > 80.0) isCrit = true;
  }
  const lvCloud = getLv('cloud_hook');
  if (lvCloud > 0 && py >= 160.0) {
    rawDmg *= (1.45 + lvCloud * 0.15);
    isCrit = true;
  }

  xpMult += Math.min(0.60, swingCombo * 0.08);

  return {
    dmg: Math.max(10, Math.round(rawDmg)),
    xpMult: xpMult,
    isCrit: isCrit
  };
}

function findCase1Target() {
  if (enemies.length === 0) return null;
  const aug = getAugStats();
  const maxDist = 260.0 * aug.lockRangeMult;
  const minVelDot = Math.max(0.22, 0.52 - aug.lockDotBonus);
  const minFwdDot = Math.max(0.18, 0.40 - aug.lockDotBonus);

  const spd = Math.hypot(vx, vy, vz) || 1.0;
  const dvx = vx / spd, dvy = vy / spd, dvz = vz / spd;
  const sinY = Math.sin(camLagYaw), cosY = Math.cos(camLagYaw);

  let best = null;
  let bestScore = 99999;
  for (const e of enemies) {
    const dx = e.x - px, dy = e.y - py, dz = e.z - pz;
    const dist = Math.hypot(dx, dy, dz);
    if (dist > maxDist || dist < 4.0) continue;
    if (dy > 20.0) continue;

    const nx = dx / dist, ny = dy / dist, nz = dz / dist;
    const velDot = nx * dvx + ny * dvy + nz * dvz;
    const fwdDot = (dx * sinY + dz * cosY) / (Math.hypot(dx, dz) || 1.0);
    if (velDot < minVelDot || fwdDot < minFwdDot) continue;

    const sc = dist + (1.0 - velDot) * 200.0 - (e.tier === 'ELITE' ? 28.0 : 0);
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

// 연쇄 핀볼 다음 타겟 탐색 (반경 125m 내 가장 가까운 적)
function findNextChainTarget(fromX, fromY, fromZ, visited) {
  let best = null;
  let minDist = 125.0;
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

function onStrikePress() {
  if (augmentDraftOpen) { confirmAugment(draftCursor); return; }
  if (gameOver) { resetGame(); return; }
  if (strikeCooldown > 0 || strikeMode !== 0) return;

  const aug = getAugStats();
  const caseType = classifyStrikeCase();
  const totalSpd = Math.hypot(vx, vy, vz);

  chainBouncesLeft = getChainBounceCount();
  chainVisited = [];
  isChainRush = false;

  if (caseType === 1) {
    const target = findCase1Target();
    isSwinging = false;
    inPerfectWindow = false;
    isGliding = false;
    autoCatchAfterJump = false;

    strikeMode = 1;
    strikePhase = 'RUSH';
    strikeTarget = target;
    strikeTimer = 1.25;
    strikeEntrySpd = Math.max(78.0, totalSpd);
    strikeEntryDist = target ? Math.hypot(target.x - px, target.y - py, target.z - pz) : 80.0;
    strikeCooldown = 0.25;
    afterimageTimer = 0.7;

    const boost = (18.0 + diveCharge * 28.0) * aug.maxSpeedMult;
    const curSpd = Math.hypot(vx, vy, vz) || 1.0;
    vx += (vx / curSpd) * boost * 0.45;
    vy -= Math.max(18.0, boost * 0.85);
    vz += (vz / curSpd) * boost * 0.45;
    diveCharge = 0;

    shakeMag = Math.max(shakeMag, 2.2);
    spawnSparks(px, py, pz, PAL.ORANGE, 10, 28);
    addPopup(target ? 'DIVE SLAM LOCK!' : 'METEOR SLAM!', PAL.ORANGE, 2);
    return;
  }

  const target = homingTarget || findBestLockTarget();
  if (!target) {
    addPopup('NO TARGET', '#94a3b8', 1);
    return;
  }

  isSwinging = false;
  inPerfectWindow = false;
  isGliding = false;
  isDiving = false;
  autoCatchAfterJump = false;
  strikeCooldown = 0.28;
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
    addPopup('HYPER SNAP!!', PAL.NEON_CYAN, 2);
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
    addPopup(CARTOON_MOTIONS[strikeMotionIdx].word, PAL.NEON_PINK, 2);
  }
}

// =========================================================================
// 6. WALL & CLOUD ANCHOR TARGETING, SWING ACTIONS & BUILDING COLLISIONS
// =========================================================================
function findWallAnchor(turnInput, fwdInput, bList, cList) {
  let best = null;
  let minScore = 9999.0;
  const cosY = Math.cos(camYaw), sinY = Math.sin(camYaw);
  const horizSpd = Math.hypot(vx, vz);
  const preferSide = Math.abs(turnInput) < 0.15 ? -lastAnchorSide : (turnInput < 0 ? -1 : 1);

  for (const b of bList) {
    const dx = b.bx - px, dz = b.bz - pz;
    const localX = dx * cosY - dz * sinY;
    const localZ = dx * sinY + dz * cosY;

    if (localZ > 44.0 && localZ < 265.0 && Math.abs(localX) > 10.0 && Math.abs(localX) < 195.0) {
      const altBias = fwdInput > 0.2 ? 125.0 : (fwdInput < -0.2 ? 68.0 : 95.0);
      const targetWallY = Math.min(b.bh - 6.0, Math.max(py + altBias, 130.0));
      if (targetWallY <= py + 14.0) continue;

      const wx = b.bx - (localX > 0 ? b.bw * 0.5 : -b.bw * 0.5);
      const wz = b.bz - (localZ > 0 ? b.bd * 0.5 : -b.bd * 0.5);
      const side = localX > 0 ? 1 : -1;

      const idealZ = 95.0 + horizSpd * 0.45;
      let sc = Math.abs(localZ - idealZ) + Math.abs(Math.abs(localX) - 56.0) * 0.48;
      if (side === preferSide) sc -= 35.0;

      if (sc < minScore) {
        minScore = sc;
        best = { wx, wy: targetWallY, wz, side, isCloud: false };
      }
    }
  }

  // [구름 앵커]: 중·고공 및 성층권(최대 495m) 구름에 거미줄 부착 가능
  if (getLv('cloud_hook') > 0 && cList) {
    for (const c of cList) {
      const dx = c.x - px, dz = c.z - pz;
      const localX = dx * cosY - dz * sinY;
      const localZ = dx * sinY + dz * cosY;
      if (localZ > 34.0 && localZ < 285.0 && Math.abs(localX) < 190.0 && c.y > py + 12.0) {
        const side = localX >= 0 ? 1 : -1;
        const idealZ = 105.0 + horizSpd * 0.45;
        let sc = Math.abs(localZ - idealZ) + Math.abs(localX) * 0.42 - 20.0;
        if (py > 150.0) sc -= 55.0;
        if (sc < minScore) {
          minScore = sc;
          best = { wx: c.x, wy: c.y, wz: c.z, side, isCloud: true };
        }
      }
    }
  }

  return best;
}

function startWebSwing(bList, cList, fromGroundLaunch = false) {
  const { turn, fwd } = getInputs();
  const target = findWallAnchor(turn, fwd, bList, cList);
  if (!target) return false;

  clearStrikeState();
  isGliding = false;

  ax = target.wx; ay = target.wy; az = target.wz;
  anchorSide = target.side;
  lastAnchorSide = anchorSide;
  ropeLen = Math.hypot(px - ax, py - ay, pz - az);

  if (getLv('bungee_web') > 0) {
    ropeLen = Math.min(ay - 4.5, ropeLen * 1.12);
  }

  const sinY = Math.sin(camYaw), cosY = Math.cos(camYaw);

  if (fromGroundLaunch) {
    groundLaunchTimer = 0.65;
    const hSpd = Math.hypot(vx, vz);
    if (hSpd < 34.0) { vx = sinY * 34.0; vz = cosY * 34.0; }
    vy = Math.max(vy, 24.0);
    addPopup('WEB ZIP LAUNCH!', '#b8e4ff', 1);
  }

  if (target.isCloud) {
    addPopup('CLOUD HOOK!', '#b8e4ff', 1);
  }

  if (diveCharge >= 0.22) {
    const lowBonus = py < 45.0 ? (1.0 + (45.0 - py) / 45.0 * 0.65) : 1.0;
    const boost = (24.0 + diveCharge * 34.0) * lowBonus;
    vx += sinY * boost;
    vz += cosY * boost;
    const cMult = Math.pow(1.38, Math.min(swingCombo, 10));
    const divePts = Math.round((140 + diveCharge * 260) * lowBonus * cMult);
    const diveXp = Math.round((14 + diveCharge * 20) * lowBonus);
    score += divePts;
    gainXp(diveXp);
    comboTimer = Math.max(comboTimer, 3.8);
    shakeMag = Math.max(shakeMag, 2.4);
    spawnSparks(px, py, pz, PAL.NEON_CYAN, 12, 32);
    addPopup('DIVE BOOST! +' + diveXp + 'XP', PAL.NEON_CYAN, 2);
    diveCharge = 0;
    isDiving = false;
  }

  peakYBeforeSwing = Math.max(py, 115.0);
  swingMinY = py;
  isSwinging = true;
  swingTimer = 0.0;
  passedBottom = false;
  inPerfectWindow = false;
  doingFlip = false;
  spawnSparks(ax, ay, az, target.isCloud ? '#b8e4ff' : '#ffffff', 7, 22);
  return true;
}

function onSwingDown() {
  // 드래프트 중에는 스윙 버튼(SPACE/IO14)으로 실수 확정되지 않도록 무시
  if (augmentDraftOpen) {
    return;
  }
  if (gameOver) {
    resetGame();
    return;
  }

  swingHeld = true;
  btnSwing.classList.add('pressed');

  if (py <= 4.0) {
    vy = 48.0;
    const sinY = Math.sin(camYaw), cosY = Math.cos(camYaw);
    const hSpd = Math.hypot(vx, vz);
    if (hSpd < 26.0) { vx = sinY * 26.0; vz = cosY * 26.0; }
    autoCatchAfterJump = true;
    spawnSparks(px, 1.5, pz, '#b8e4ff', 8, 20);
    return;
  }

  if (!isSwinging) {
    const w = getNearbyWorld();
    startWebSwing(w.buildings, w.clouds, false);
  }
}

function onSwingUp() {
  swingHeld = false;
  autoCatchAfterJump = false;
  btnSwing.classList.remove('pressed', 'ready', 'perfect');

  if (isSwinging) {
    const aug = getAugStats();
    const wasPerfect = inPerfectWindow;
    isSwinging = false;
    inPerfectWindow = false;
    groundLaunchTimer = 0;

    if (swingTimer > 0.18 && (passedBottom || vy > 8.0)) {
      swingCombo = Math.min(12, swingCombo + (wasPerfect ? 2 : 1));
      comboTimer = 4.6;

      const swingDepth = Math.max(10.0, peakYBeforeSwing - swingMinY);
      const depthRatio = Math.min(1.0, swingDepth / 75.0);
      const hSpd = Math.hypot(vx, vz);
      const sinY = Math.sin(camYaw), cosY = Math.cos(camYaw);

      if (wasPerfect) {
        hitStopTimer = 0.045;
        const upwardKick = (26.0 + depthRatio * 22.0 + Math.min(20.0, hSpd * 0.13)) * aug.bungeeBounce;
        vy = Math.min(135.0 * aug.bungeeBounce, Math.max(vy + upwardKick * 0.65, (44.0 + depthRatio * 26.0) * aug.bungeeBounce));
        vx += sinY * (24.0 + depthRatio * 20.0);
        vz += cosY * (24.0 + depthRatio * 20.0);
        perfectBuffTimer = 3.4;
        if (refillElasticCharges()) {
          spawnSparks(px, py, pz, PAL.EMERALD, 6, 26);
        }

        const pts = Math.round((440 + swingDepth * 4.0) * Math.pow(1.38, Math.min(swingCombo, 10)));
        const perfXp = Math.round(24 + depthRatio * 14);
        score += pts;
        gainXp(perfXp);
        afterimageTimer = 0.85;
        afterimages = [];
        shakeMag = Math.max(shakeMag, 2.8);
        spawnSparks(px, py, pz, PAL.GOLD, 10, 34);
        spawnSparks(px, py, pz, PAL.NEON_CYAN, 8, 30);
        addPopup('PERFECT!! +' + perfXp + 'XP', PAL.NEON_CYAN, 3);
      } else {
        const upwardKick = (15.0 + depthRatio * 17.0 + Math.min(15.0, hSpd * 0.10)) * aug.bungeeBounce;
        vy = Math.min(112.0 * aug.bungeeBounce, Math.max(vy + upwardKick * 0.58, (32.0 + depthRatio * 24.0) * aug.bungeeBounce));
        vx += sinY * (5.0 + depthRatio * 8.0) * aug.swingPushMult;
        vz += cosY * (5.0 + depthRatio * 8.0) * aug.swingPushMult;

        const pts = Math.round((90 + swingDepth * 2.2) * Math.pow(1.38, Math.min(swingCombo, 10)));
        score += pts;
        if (swingDepth > 55) addPopup('BIG ARC +' + pts, PAL.GOLD, 1);
      }

      doingFlip = true;
      flipAngle = 0.0;
    }
    peakYBeforeSwing = Math.max(115.0, py);
  }
}

// =========================================================================
// 7. BUILDING COLLISIONS (FORGIVING WALL SLIDE + LEVELED ELASTIC BOUNCE)
// =========================================================================
function handleBuildingsCollisionAndProximity(bList) {
  let minWallDist = 999.0;
  let nearestSide = 0;
  const cosY = Math.cos(camYaw), sinY = Math.sin(camYaw);

  for (const b of bList) {
    if (py >= b.bh + 4.0) continue;
    const hw = b.bw * 0.5 + 1.3;
    const hd = b.bd * 0.5 + 1.3;

    const dxBox = Math.max(0, Math.abs(px - b.bx) - hw);
    const dzBox = Math.max(0, Math.abs(pz - b.bz) - hd);
    const wallDist = Math.hypot(dxBox, dzBox);

    if (wallDist < minWallDist) {
      minWallDist = wallDist;
      const relX = (b.bx - px) * cosY - (b.bz - pz) * sinY;
      nearestSide = relX >= 0 ? 1 : -1;
    }

    if (py < b.bh && px > b.bx - hw && px < b.bx + hw && pz > b.bz - hd && pz < b.bz + hd) {
      const ox = Math.min(px - (b.bx - hw), (b.bx + hw) - px);
      const oz = Math.min(pz - (b.bz - hd), (b.bz + hd) - pz);
      let nx = 0, nz = 0;
      if (ox < oz) {
        nx = px < b.bx ? -1 : 1;
        px = px < b.bx ? (b.bx - hw) : (b.bx + hw);
      } else {
        nz = pz < b.bz ? -1 : 1;
        pz = pz < b.bz ? (b.bz - hd) : (b.bz + hd);
      }

      const hSpd = Math.hypot(vx, vz);
      if (hSpd > 0.5) {
        const vn = vx * nx + vz * nz;
        if (vn < 0) {
          const impactCos = Math.abs(vn) / hSpd;
          const crashThreshold = hSpd > 65.0 ? 0.82 : 0.74;

          if (impactCos > crashThreshold && strikeMode === 0 && strikeGraceTimer <= 0) {
            const lvElastic = getLv('elastic');
            if (lvElastic > 0 && elasticChargesLeft > 0) {
              elasticChargesLeft--;
              const bounceMult = getElasticBounceMult();
              const rx = (vx - 2.0 * vn * nx) * bounceMult;
              const rz = (vz - 2.0 * vn * nz) * bounceMult;
              const rSpd = Math.hypot(rx, rz);
              if (rSpd < 34.0 && rSpd > 0.1) {
                vx = (rx / rSpd) * 34.0;
                vz = (rz / rSpd) * 34.0;
              } else {
                vx = rx;
                vz = rz;
              }
              vy = Math.max(vy + 14.0, 26.0);
              camYaw = Math.atan2(vx, vz);
              isSwinging = false;
              inPerfectWindow = false;
              clearStrikeState();
              if (getLv('fric_heat') > 0) frictionCharge = Math.min(1.5, frictionCharge + 0.55);
              shakeMag = Math.max(shakeMag, 2.8);
              triggerShockwave(px, py, pz, 44 + lvElastic * 10, 18 + lvElastic * 10, PAL.EMERALD);
              spawnSparks(px, py, pz, PAL.EMERALD, 14, 34);
              const maxCharges = getElasticMaxCharges();
              addPopup('ELASTIC ' + bounceMult.toFixed(1) + 'x! (' + elasticChargesLeft + '/' + maxCharges + ')', PAL.EMERALD, 2);
              continue;
            }

            vx = (vx - vn * nx) * 0.25 + nx * Math.min(18.0, Math.abs(vn) * 0.28);
            vz = (vz - vn * nz) * 0.25 + nz * Math.min(18.0, Math.abs(vn) * 0.28);
            vy *= 0.45;
            isSwinging = false;
            inPerfectWindow = false;
            diveCharge = 0;
            clearStrikeState();
            spawnSparks(px, py, pz, PAL.CRIMSON, 12, 34);
            takeDamage(10, lvElastic > 0 ? 'BOUNCE DEPLETED!' : 'WALL CRASH!');
          } else {
            const tx = vx - vn * nx;
            const tz = vz - vn * nz;
            const keepRatio = Math.max(0.90, 0.97 - impactCos * 0.09);
            vx = tx * keepRatio + nx * 2.4;
            vz = tz * keepRatio + nz * 2.4;

            const slideYaw = Math.atan2(vx, vz);
            let yd = (slideYaw - camYaw + Math.PI) % (2 * Math.PI) - Math.PI;
            if (yd < -Math.PI) yd += 2 * Math.PI;
            camYaw += yd * 0.35;

            if (wallSlideCooldown <= 0 && hSpd > 26) {
              wallSlideCooldown = 0.42;
              skimTechTimer = 2.2;
              gainXp(10);
              spawnSparks(px, py, pz, '#b8e4ff', 7, 22);
              addPopup('WALL SLIDE! +10XP', '#b8e4ff', 1);
              shakeMag = Math.max(shakeMag, 1.3);
            }
          }
        }
      }
    }
  }
  return { minWallDist, nearestSide };
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

// 1단계(추격형) / 2~3단계(원거리 거리유지·선회형) 이동 AI 업데이트
function updateEnemyMovementAI(e, dt, bList) {
  e.phase += dt * 1.9;
  if (e.hitFlash > 0) e.hitFlash -= dt;

  const dxFromP = e.x - px;
  const dyFromP = e.y - py;
  const dzFromP = e.z - pz;
  const dist3D = Math.hypot(dxFromP, dyFromP, dzFromP) || 1.0;

  if (e.tier === 'SWARM') {
    // === 1단계 잡몹: 플레이어를 향해 적극적으로 추격하며 몰려듦 ===
    if (dist3D > 360.0) {
      // 너무 멀어지면 전방 시야 140~190m 부근으로 합류시켜 추격 흐름 유지
      const pullYaw = camYaw + (Math.random() - 0.5) * 1.15;
      const pullDist = 140.0 + Math.random() * 50.0;
      const targetY = Math.max(18.0, Math.min(340.0, py + (Math.random() - 0.5) * 45.0));
      const safe = pushOutOfBuildings(px + Math.sin(pullYaw) * pullDist, targetY, pz + Math.cos(pullYaw) * pullDist, 12.0, bList);
      e.x = safe.x; e.y = targetY; e.z = safe.z;
      e.vx = 0; e.vy = 0; e.vz = 0;
      return;
    }

    // 서로 완전히 한 점에 겹치지 않도록 약간의 편대 오프셋을 두고 플레이어 추적
    const swirlAng = e.flockAngle + e.phase * 0.65;
    const goalX = px + Math.cos(swirlAng) * e.flockDist;
    const goalZ = pz + Math.sin(swirlAng) * e.flockDist;
    const goalY = Math.max(12.0, Math.min(GAME_MAX_ALTITUDE - 30.0, py + Math.sin(e.phase * 1.3) * 7.5));

    const gx = goalX - e.x, gy = goalY - e.y, gz = goalZ - e.z;
    const gDist = Math.hypot(gx, gy, gz) || 1.0;

    // 멀리 있을수록 빠르게 따라붙어 스윙 오라/고압 거미줄 사거리 안으로 자연스럽게 유입
    const baseChaseSpd = 34.0 + Math.min(18.0, wave * 2.2);
    const catchUpBoost = dist3D > 95.0 ? Math.min(36.0, (dist3D - 95.0) * 0.28) : 0.0;
    const chaseSpd = baseChaseSpd + catchUpBoost;

    const desVx = (gx / gDist) * chaseSpd;
    const desVy = (gy / gDist) * chaseSpd;
    const desVz = (gz / gDist) * chaseSpd;

    const steer = Math.min(1.0, 3.8 * dt);
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
    // === 2단계(MEDIUM) & 3단계(ELITE): 적정 거리를 유지하며 측면 선회 + 원거리 공격 ===
    if (dist3D > 430.0) {
      const pullYaw = camYaw + (Math.random() - 0.5) * 1.1;
      const pullDist = (e.minRange + e.maxRange) * 0.5 + 35.0;
      const targetY = Math.max(e.altMin, Math.min(e.altMax, py + e.altOffset));
      const safe = pushOutOfBuildings(px + Math.sin(pullYaw) * pullDist, targetY, pz + Math.cos(pullYaw) * pullDist, 20.0, bList);
      e.x = safe.x; e.y = targetY; e.z = safe.z;
      e.vx = 0; e.vy = 0; e.vz = 0;
      return;
    }

    const hDist = Math.hypot(dxFromP, dzFromP) || 1.0;
    // rx, rz: 플레이어로부터 멀어지는 수평 단위벡터 / tx, tz: 측면 선회 단위벡터
    const rx = dxFromP / hDist;
    const rz = dzFromP / hDist;
    const tx = -rz * e.orbitDir;
    const tz = rx * e.orbitDir;

    let radialSpd = 0.0;
    let strafeSpd = e.tier === 'ELITE' ? 16.0 : 20.0;

    if (hDist < e.minRange) {
      // 너무 가까워지면 거리를 벌리며 후퇴·선회
      const closeRatio = Math.min(1.0, (e.minRange - hDist) / 55.0);
      radialSpd = 20.0 + closeRatio * 24.0;
      strafeSpd = 18.0;
    } else if (hDist > e.maxRange) {
      // 사거리 밖으로 멀어지면 천천히 다가와 사격 거리 확보
      const farRatio = Math.min(1.0, (hDist - e.maxRange) / 90.0);
      radialSpd = -(22.0 + farRatio * 34.0);
      strafeSpd = 14.0;
    }

    const desiredY = Math.max(e.altMin, Math.min(e.altMax, py + e.altOffset)) + Math.sin(e.phase * 1.05) * 6.0;
    const desVx = rx * radialSpd + tx * strafeSpd;
    const desVz = rz * radialSpd + tz * strafeSpd;
    const desVy = Math.max(-28.0, Math.min(28.0, (desiredY - e.y) * 1.4));

    const steer = Math.min(1.0, 2.8 * dt);
    e.vx += (desVx - e.vx) * steer;
    e.vy += (desVy - e.vy) * steer;
    e.vz += (desVz - e.vz) * steer;

    e.x += e.vx * dt;
    e.y = Math.max(24.0, Math.min(GAME_MAX_ALTITUDE - 25.0, e.y + e.vy * dt));
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

  // 웨이브 클리어 체크 (클리어 시 대량 보너스 XP + HP 회복 후 다음 웨이브 스폰)
  if (enemies.length === 0) {
    if (waveClearDelay <= 0) {
      waveClearDelay = 1.25;
      hp = Math.min(MAX_HP, hp + 15);
      const waveBonus = 700 * wave;
      const clearXp = 90 + wave * 25;
      score += waveBonus;
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

  // [기믹 1: 전격 스윙 오라] 속도 56+ 시 주변 추격 스웜·적에게 넉넉한 범위 보정으로 광역 감전!
  const lvAura = getLv('swing_aura');
  if (lvAura > 0 && totalSpeed >= 56.0) {
    auraTickTimer -= dt;
    if (auraTickTimer <= 0) {
      auraTickTimer = 0.22;
      const auraR = 38.0 + lvAura * 12.0;
      const auraDmg = 14 + lvAura * 8 + Math.round(Math.max(0, totalSpeed - 56) * 0.15);
      const hits = [];
      for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        const swarmBonus = e.tier === 'SWARM' ? 6.0 : 0.0;
        if (Math.hypot(e.x - px, e.y - py, e.z - pz) <= auraR + e.radius + swarmBonus) {
          hits.push(e);
        }
      }
      for (let i = 0; i < hits.length; i++) {
        const targetE = hits[i];
        spawnLightningBolt(px, py, pz, targetE.x, targetE.y, targetE.z, PAL.NEON_CYAN, 0.18);
        applyEnemyDamage(targetE, auraDmg, PAL.NEON_CYAN, false, 0, 1.15, false);
      }
    }
  }

  // [기믹 2: 고압 거미줄] 스윙 중인 거미줄 선분 자체에 넉넉한 절단·감전 판정!
  const lvVolt = getLv('volt_web');
  if (lvVolt > 0 && isSwinging) {
    webZapTimer -= dt;
    if (webZapTimer <= 0) {
      webZapTimer = 0.17;
      const webDmg = 20 + lvVolt * 12;
      const padR = 13.0 + lvVolt * 4.5;
      const hits = [];
      for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        const swarmBonus = e.tier === 'SWARM' ? 4.0 : 0.0;
        const distSeg = pointToSegmentDist3D(e.x, e.y, e.z, px, py, pz, ax, ay, az);
        if (distSeg <= e.radius + padR + swarmBonus) {
          hits.push(e);
        }
      }
      for (let i = 0; i < hits.length; i++) {
        const targetE = hits[i];
        const mx = (px + ax) * 0.5, my = (py + ay) * 0.5, mz = (pz + az) * 0.5;
        spawnLightningBolt(mx, my, mz, targetE.x, targetE.y, targetE.z, PAL.GOLD, 0.16);
        applyEnemyDamage(targetE, webDmg, PAL.GOLD, false, 0, 1.20, false);
      }
    }
  }

  const segDx = px - oldX, segDy = py - oldY, segDz = pz - oldZ;
  const segLenSq = segDx * segDx + segDy * segDy + segDz * segDz;
  const isActiveAttack = (strikeMode !== 0 && strikePhase === 'RUSH');
  let isStrikeProtected = (strikeMode !== 0) || (strikeGraceTimer > 0);

  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (!e) continue;

    // 1) 티어별 이동 AI 업데이트 (SWARM 추격 / MEDIUM·ELITE 거리 유지 선회)
    updateEnemyMovementAI(e, dt, bList);

    // 2) 2단계 이상(MEDIUM / ELITE) 전용 원거리 플라즈마 공격
    const dxToP = px - e.x, dyToP = py - e.y, dzToP = pz - e.z;
    const distToP = Math.hypot(dxToP, dyToP, dzToP) || 1.0;
    const isLockedByActiveStrike = (strikeMode !== 0 && strikeTarget === e);

    if (e.tier !== 'SWARM' && !isLockedByActiveStrike && distToP < 275.0 && distToP > 42.0 && projectiles.length < 16) {
      e.fireTimer -= dt;
      if (e.fireTimer <= 0) {
        const baseCd = e.tier === 'ELITE' ? 2.2 : 2.7;
        e.fireTimer = Math.max(1.4, baseCd - wave * 0.10) + Math.random() * 1.1;

        const pSpd = 58.0 + Math.min(28.0, wave * 3.0);
        // 약간의 예측 조준(0.2초 리드)으로 원거리 견제감 부여
        const aimX = (px + vx * 0.20) - e.x;
        const aimY = (py + vy * 0.16) - e.y;
        const aimZ = (pz + vz * 0.20) - e.z;
        const aimDist = Math.hypot(aimX, aimY, aimZ) || 1.0;
        const baseDx = aimX / aimDist, baseDy = aimY / aimDist, baseDz = aimZ / aimDist;

        const pCol = e.tier === 'ELITE' ? PAL.GOLD
          : (e.type === 'SKY_CORE' ? PAL.NEON_PINK : PAL.CRIMSON);

        if (e.tier === 'ELITE') {
          // 3단계 엘리트: 3발 수평 부채꼴 포격
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

        const calc = computeStrikeDamage(curMode, strikeEntrySpd, strikeEntryDist, Math.max(0, -vy), isChainRush);
        const dmg = calc.dmg;
        const isCrit = calc.isCrit;
        const impactCol = curMode === 1 ? PAL.ORANGE : (isChainRush ? PAL.NEON_PINK : (isCrit ? PAL.GOLD : (dmg <= 30 ? '#cbd5e1' : PAL.NEON_CYAN)));

        hitStopTimer = curMode === 1 ? 0.055 : (isCrit ? 0.052 : (isChainRush ? 0.032 : 0.038));
        shakeMag = Math.max(shakeMag, curMode === 1 ? 4.8 : (isCrit ? 4.4 : 3.2));
        swingCombo = Math.min(12, swingCombo + 1);
        comboTimer = 5.0;
        afterimageTimer = 0.75;

        // 타격 직후 0.65초 공격 보호 유예 + 타격 지점 반경 28m 영거리 투사체 소거
        strikeGraceTimer = 0.65;
        isStrikeProtected = true;

        const targetX = e.x, targetY = e.y, targetZ = e.z;
        clearProjectilesInRadius(targetX, targetY, targetZ, 28.0, impactCol);

        const killed = applyEnemyDamage(e, dmg, impactCol, isCrit, 0, calc.xpMult, true);
        if (refillElasticCharges()) {
          spawnSparks(targetX, targetY, targetZ, PAL.EMERALD, 6, 26);
        }

        // 광역 충격파 계산 (체공 예열 / 마찰 과열 / 초중력 C1)
        const lvAir = getLv('air_heat');
        const lvFric = getLv('fric_heat');
        const lvHeavy = getLv('heavy_suit');
        let splashR = 0;
        let splashCol = PAL.GOLD;
        if (lvAir > 0 && airTimeStack >= 1.2) {
          splashR += airTimeStack * (10.0 + lvAir * 3.0);
          splashCol = PAL.GOLD;
        }
        if (lvFric > 0 && frictionCharge >= 0.22) {
          splashR += 44.0 + lvFric * 14.0;
          splashCol = PAL.CRIMSON;
        }
        if (curMode === 1 && lvHeavy > 0) {
          splashR += 42.0 + lvHeavy * 14.0;
          splashCol = PAL.ORANGE;
        }
        if (splashR > 18.0) {
          triggerShockwave(targetX, targetY, targetZ, Math.min(145.0, splashR), Math.round(dmg * 0.65), splashCol, e, 0);
        }

        // [기믹 3: 연쇄 핀볼] 적중 후 반경 125m 내 다음 적에게 자동 튕겨 연속 타격
        if (chainVisited.indexOf(e) === -1) chainVisited.push(e);
        if (chainBouncesLeft > 0) {
          const nextTarget = findNextChainTarget(targetX, targetY, targetZ, chainVisited);
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

        // 연쇄 종료 -> 정상 반동/관통 마무리
        const hadChainAug = getLv('chain_pinball') > 0;
        clearStrikeState();

        let impactLabel = '';
        if (curMode === 1) {
          vx = vx * 0.68;
          vz = vz * 0.68;
          vy = Math.min(58.0, Math.max(36.0, preSpd * 0.36));
          doingFlip = true;
          flipAngle = 0.0;
          impactLabel = 'SLAM REBOUND!';
        } else {
          const blockedBehind = hasObstacleBehindTarget(e, dirX, dirY, dirZ, bList);
          if (blockedBehind) {
            const rebSpd = Math.max(30.0, Math.min(56.0, Math.max(strikeEntrySpd, preSpd * 0.48) * 0.58));
            vx = -dirX * rebSpd * 0.78;
            vz = -dirZ * rebSpd * 0.78;
            vy = Math.max(30.0, Math.min(52.0, -dirY * rebSpd * 0.40 + 28.0));
            doingFlip = true;
            flipAngle = 0.0;
            impactLabel = 'SAFE REBOUND!';
          } else {
            const pierceSpd = Math.min(115.0 * aug.maxSpeedMult, Math.max(BASE_PIERCE_SPD, preSpd * 0.72));
            vx = dirX * pierceSpd;
            vz = dirZ * pierceSpd;
            vy = Math.max(16.0, Math.min(56.0, dirY * pierceSpd * 0.65 + 14.0));
            doingFlip = true;
            flipAngle = 0.0;
            impactLabel = 'PIERCE THROUGH!!';
          }
        }

        if (hadChainAug) {
          vx *= 1.12;
          vy = Math.max(vy, 38.0);
          vz *= 1.12;
          strikeCooldown = 0;
        } else {
          airTimeStack = 0.0;
        }

        peakFallSpeed = 0.0;
        frictionCharge = 0.0;
        perfectBuffTimer = 0.0;
        skimTechTimer = 0.0;

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
        takeDamage(e.tier === 'SWARM' ? 8 : 12, e.tier === 'SWARM' ? 'SWARM BITE!' : 'BODY COLLISION!');
      }
    }
  }

  // 적 직선 투사체 처리 (상대 선분 충돌 판정 + STRIKE 전 구간/유예 중 자동 DEFLECT)
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const pr = projectiles[i];
    const oldPrX = pr.x, oldPrY = pr.y, oldPrZ = pr.z;
    pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.z += pr.vz * dt;
    pr.life -= dt;
    if (pr.life <= 0 || pr.y < 1.0) { projectiles.splice(i, 1); continue; }

    const relOldX = oldX - oldPrX, relOldY = oldY - oldPrY, relOldZ = oldZ - oldPrZ;
    const relNewX = px - pr.x,     relNewY = py - pr.y,     relNewZ = pz - pr.z;
    const d = pointToSegmentDist3D(0, 0, 0, relOldX, relOldY, relOldZ, relNewX, relNewY, relNewZ);

    const checkR = isStrikeProtected ? 12.5 : 6.8;
    if (d < checkR) {
      if (isStrikeProtected) {
        const pts = Math.round(140 * Math.pow(1.3, Math.min(swingCombo, 8)));
        score += pts;
        comboTimer = Math.max(comboTimer, 3.8);
        spawnSparks(pr.x, pr.y, pr.z, PAL.NEON_CYAN, 10, 32);
        addPopup('DEFLECT! +' + pts, PAL.NEON_CYAN, 1);
        projectiles.splice(i, 1);
      } else {
        spawnSparks(pr.x, pr.y, pr.z, PAL.CRIMSON, 12, 28);
        projectiles.splice(i, 1);
        takeDamage(10, 'PLASMA HIT!');
      }
    }
  }
}

// =========================================================================
// 9. 3D CAMERA BASIS, NEAR-PLANE CLIPPING & RENDER HELPERS
// =========================================================================
function getCameraPos() {
  if (!thirdPerson) return { cx: px, cy: py, cz: pz };
  const sinY = Math.sin(camLagYaw), cosY = Math.cos(camLagYaw);
  const rightX = cosY, rightZ = -sinY;
  const sideShift = strikeCamBlend * strikeCamSide * 3.2;
  return {
    cx: px - sinY * camDist + rightX * sideShift,
    cy: Math.max(3.2, py + 3.8 - vy * 0.032 - strikeCamBlend * 1.4),
    cz: pz - cosY * camDist + rightZ * sideShift
  };
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
        if (currentStage === 2) {
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
      const bandCol = currentStage === 2
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
    drawClippedLine3D([b.bx, h + 10, b.bz], [b.bx, h + 42, b.bz], cb, currentStage === 2 ? '#ff5cf4' : '#e2ecff', 1);
  }
}

// Render 3-Tier PC-98 Pixel Enemies + Compact HP Bar + Animated Lock-On Reticle
function drawEnemy3D(e, cb) {
  const p = projectWorldPt(e.x, e.y, e.z, cb);
  if (!p || p.z < 4) return;

  const drawH = Math.max(6, Math.min(62, (e.radius * 1.95 / p.z) * cb.d));
  const cx = Math.round(p.x), cy = Math.round(p.y);
  const half = Math.max(3, Math.round(drawH * 0.5));
  const flash = e.hitFlash > 0 && ((Math.floor(simTime * 30) & 1) === 0);

  if (e.type === 'ELITE_CORE') {
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

  if (e.tier === 'ELITE' || e.tier === 'MEDIUM' || e.hp < e.maxHp) {
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
    const canOneShotMed = (e.tier !== 'SWARM' && est.dmg >= e.hp);
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

function drawEnemyRadarHUD() {
  if (enemies.length === 0) return;
  let focusTarget = strikeTarget || homingTarget;
  if (!focusTarget) {
    let near = enemies[0], minD = 99999;
    for (const e of enemies) {
      const d = Math.hypot(e.x - px, e.y - py, e.z - pz) - (e.tier === 'ELITE' ? 30.0 : 0);
      if (d < minD) { minD = d; near = e; }
    }
    focusTarget = near;
  }

  const dx = focusTarget.x - px, dy = focusTarget.y - py, dz = focusTarget.z - pz;
  const dist = Math.hypot(dx, dy, dz);
  const targetYaw = Math.atan2(dx, dz);
  let relYaw = (targetYaw - camLagYaw + Math.PI) % (2 * Math.PI) - Math.PI;
  if (relYaw < -Math.PI) relYaw += 2 * Math.PI;

  const axC = 152, ayC = 14 + Math.round(Math.sin(simTime * 7) * 1.2);
  const arrowCol = (strikeTarget || homingTarget) ? PAL.NEON_CYAN : (focusTarget.tier === 'ELITE' ? PAL.GOLD : PAL.CRIMSON);

  ctx.save();
  ctx.translate(axC, ayC);
  ctx.rotate(relYaw);
  ctx.fillStyle = PAL.INDIGO_OUTLINE;
  ctx.beginPath();
  ctx.moveTo(0, -10); ctx.lineTo(9, 0); ctx.lineTo(4.5, 0);
  ctx.lineTo(4.5, 8); ctx.lineTo(-4.5, 8); ctx.lineTo(-4.5, 0); ctx.lineTo(-9, 0);
  ctx.closePath(); ctx.fill();

  ctx.fillStyle = arrowCol;
  ctx.beginPath();
  ctx.moveTo(0, -8); ctx.lineTo(7, -1); ctx.lineTo(3, -1);
  ctx.lineTo(3, 6.5); ctx.lineTo(-3, 6.5); ctx.lineTo(-3, -1); ctx.lineTo(-7, -1);
  ctx.closePath(); ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -8); ctx.lineTo(0, 6.5); ctx.lineTo(-3, 6.5); ctx.lineTo(-3, -1); ctx.lineTo(-7, -1);
  ctx.closePath(); ctx.fill();
  ctx.restore();

  const vert = dy > 22 ? '▲' : (dy < -22 ? '▼' : '●');
  const distStr = Math.round(dist) + 'm' + vert;
  ctx.font = 'bold 8px Consolas, monospace';
  const tw = ctx.measureText(distStr).width;
  const bx = Math.round(axC - tw * 0.5 - 3);
  ctx.fillStyle = '#121936';
  ctx.fillRect(bx, 24, Math.round(tw + 6), 10);
  ctx.strokeStyle = arrowCol;
  ctx.lineWidth = 1;
  ctx.strokeRect(bx + 0.5, 24.5, Math.round(tw + 5), 9);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(distStr, bx + 3, 32);
}

function drawSpiderManSprite(cb, totalSpeed) {
  const centerPt = projectWorldPt(px, py, pz, cb);
  if (!centerPt) return null;

  let poseKey = 'DIVE';
  let spinThisPose = false;
  if (strikeMode === 3) {
    const cm = CARTOON_MOTIONS[strikeMotionIdx];
    poseKey = cm.pose;
    spinThisPose = cm.spin && strikePhase === 'RUSH';
  } else if (strikeMode === 1) {
    poseKey = 'DIVE';
  } else if (isSwinging) {
    poseKey = anchorSide >= 0 ? 'SWING_R' : 'SWING_L';
  } else if (doingFlip) {
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
    const sc = Math.max(12, Math.min(46, (4.2 / ap.z) * cb.d)) / ghostCanvas.height;
    const dw = Math.round(ghostCanvas.width * sc), dh = Math.round(ghostCanvas.height * sc);
    ctx.save();
    ctx.translate(Math.round(ap.x), Math.round(ap.y));
    ctx.rotate(ai.rot);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(ghostCanvas, (-dw * 0.5) | 0, (-dh * 0.5) | 0, dw, dh);
    ctx.restore();
  }

  const pose = spideySprites[poseKey];
  const spr = pose.canvas;
  const screenH = Math.max(14, Math.min(54, (4.2 / centerPt.z) * cb.d));
  const scale = screenH / spr.height;
  const drawW = Math.round(spr.width * scale), drawH = Math.round(spr.height * scale);
  const cx = Math.round(centerPt.x), cy = Math.round(centerPt.y);

  // [전격 스윙 오라] 회전하는 2색 점선 PC-98 오라 링
  const lvAura = getLv('swing_aura');
  if (lvAura > 0 && totalSpeed >= 56.0) {
    const auraScreenR = Math.round(screenH * (0.82 + lvAura * 0.16) + Math.sin(simTime * 22) * 2.0);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(simTime * 5.5);
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = PAL.INDIGO_OUTLINE;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, auraScreenR, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = (Math.floor(simTime * 20) & 1) ? PAL.NEON_CYAN : PAL.GOLD;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, auraScreenR, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // Visual Energy Aura for Active STRIKE Cases or Post-Strike Grace Shield
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
      ctx.strokeStyle = strikeMode === 1 ? PAL.ORANGE : (isChainRush ? PAL.NEON_PINK : PAL.NEON_CYAN);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, auraR, 0, Math.PI * 2); ctx.stroke();
    }
  } else if (strikeGraceTimer > 0) {
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

  if (invulnTimer > 0 && (Math.floor(simTime * 18) & 1) === 0) {
    return { x: cx, y: cy, x1: null, y1: null, x2: null, y2: null };
  }

  if (doingFlip || spinThisPose) {
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

// =========================================================================
// 11. MAIN 60FPS ANIMATION LOOP
// =========================================================================
let lastTime = 0;
let fpsFrames = 0, fpsAcc = 0;
let afterimageSampleAcc = 0;

function tick(now) {
  if (!lastTime) lastTime = now;
  let dt = (now - lastTime) / 1000.0;
  lastTime = now;
  if (dt > 0.05) dt = 0.05;
  if (dt < 0.001) dt = 0.016;

  fpsFrames++;
  fpsAcc += dt;
  if (fpsAcc >= 0.45) {
    if (fpsBadge) fpsBadge.textContent = Math.round(fpsFrames / fpsAcc) + ' FPS';
    fpsFrames = 0;
    fpsAcc = 0;
  }

  if (augmentDraftOpen) {
    if (draftLockTimer > 0) {
      draftLockTimer = Math.max(0, draftLockTimer - dt);
    }
    if (Math.abs(joyX) < 0.25) {
      draftJoyLock = false;
    } else if (!draftJoyLock) {
      moveDraftCursor(joyX > 0 ? 1 : -1);
      draftJoyLock = true;
    }
  } else if (pendingLevelUps > 0 && hitStopTimer <= 0 && !gameOver) {
    swingHeld = false;
    autoCatchAfterJump = false;
    if (btnSwing) btnSwing.classList.remove('pressed', 'ready', 'perfect');
    openAugmentDraft();
  }

  const isFrozen = hitStopTimer > 0 || gameOver || augmentDraftOpen;
  if (hitStopTimer > 0) hitStopTimer = Math.max(0, hitStopTimer - dt);

  const { turn: turnInput, fwd: forwardInput } = getInputs();
  const { blocks: nearbyBlocks, buildings: nearbyBuildings, clouds: nearbyClouds, parks: nearbyParks } = getNearbyWorld();

  if (!isFrozen) {
    const aug = getAugStats();
    simTime += dt;

    if (wallSlideCooldown > 0) wallSlideCooldown -= dt;
    if (strikeCooldown > 0) strikeCooldown -= dt;
    if (strikeGraceTimer > 0) strikeGraceTimer = Math.max(0, strikeGraceTimer - dt);
    if (skimTechTimer > 0) skimTechTimer = Math.max(0, skimTechTimer - dt);
    if (invulnTimer > 0) invulnTimer = Math.max(0, invulnTimer - dt);
    if (damageFlash > 0) damageFlash = Math.max(0, damageFlash - dt);
    if (shakeMag > 0) shakeMag = Math.max(0, shakeMag - 12.0 * dt);
    if (perfectBuffTimer > 0) perfectBuffTimer = Math.max(0, perfectBuffTimer - dt);

    if (py > 4.0) {
      airTimeStack = Math.min(8.0, airTimeStack + dt);
    } else {
      peakFallSpeed = Math.max(0.0, peakFallSpeed - 45.0 * dt);
    }
    if (vy < -15.0) {
      peakFallSpeed = Math.max(peakFallSpeed, -vy);
    }

    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0 && !isSwinging && strikeMode === 0) endComboRun();
    }

    if (autoCatchAfterJump && swingHeld && !isSwinging && py > 13.5) {
      if (startWebSwing(nearbyBuildings, nearbyClouds, true)) autoCatchAfterJump = false;
    }

    const oldPx = px, oldPy = py, oldPz = pz;

    if (strikeTarget && enemies.indexOf(strikeTarget) === -1) {
      clearStrikeState();
      strikeGraceTimer = Math.max(strikeGraceTimer, 0.35);
    }
    const previewCaseNow = strikeMode !== 0 ? strikeMode : classifyStrikeCase();
    homingTarget = strikeTarget || (previewCaseNow === 1 ? findCase1Target() : findBestLockTarget());

    const wantCamBlend = (strikeMode === 3 && strikePhase === 'HANG_SHOOT') ? 1.0 : 0.0;
    strikeCamBlend += (wantCamBlend - strikeCamBlend) * (wantCamBlend > 0.5 ? 14.0 : 8.5) * dt;

    // --- 1. Physics Update ---
    if (strikeMode !== 0) {
      strikeTimer -= dt;
      if (strikeTimer <= 0) {
        clearStrikeState();
        strikeGraceTimer = Math.max(strikeGraceTimer, 0.35);
      } else if (strikeMode === 1) {
        vy -= (BASE_GRAVITY * 1.20 * aug.gravityMult) * dt;
        isDiving = true;
        isGliding = false;

        if (strikeTarget) {
          const dx = strikeTarget.x - px, dy = strikeTarget.y - py, dz = strikeTarget.z - pz;
          const dist = Math.hypot(dx, dy, dz) || 1.0;
          const spd = Math.max(82.0, Math.hypot(vx, vy, vz));
          const desVx = (dx / dist) * spd, desVy = (dy / dist) * spd, desVz = (dz / dist) * spd;
          const subtleSteer = Math.min(0.48, 3.8 * dt);
          vx += (desVx - vx) * subtleSteer;
          vy += (desVy - vy) * subtleSteer;
          vz += (desVz - vz) * subtleSteer;

          const targetYaw = Math.atan2(vx, vz);
          let yd = (targetYaw - camYaw + Math.PI) % (2 * Math.PI) - Math.PI;
          if (yd < -Math.PI) yd += 2 * Math.PI;
          camYaw += yd * 4.5 * dt;
        }

        px += vx * dt;
        py += vy * dt;
        pz += vz * dt;
      } else if (strikeMode === 3) {
        if (!strikeTarget) {
          clearStrikeState();
          strikeGraceTimer = Math.max(strikeGraceTimer, 0.35);
        } else if (strikePhase === 'HANG_SHOOT') {
          vx *= Math.max(0, 1.0 - 12.0 * dt);
          vy *= Math.max(0, 1.0 - 12.0 * dt);
          vz *= Math.max(0, 1.0 - 12.0 * dt);
          px += vx * dt; py += vy * dt; pz += vz * dt;

          const dx = strikeTarget.x - px, dz = strikeTarget.z - pz;
          const targetYaw = Math.atan2(dx, dz);
          let yd = (targetYaw - camYaw + Math.PI) % (2 * Math.PI) - Math.PI;
          if (yd < -Math.PI) yd += 2 * Math.PI;
          camYaw += yd * 14.0 * dt;

          const prevProg = strikeWebProg;
          strikePhaseTimer -= dt;
          const elapsed = strikePhaseDur - strikePhaseTimer;
          strikeWebProg = Math.min(1.0, elapsed / (strikePhaseDur * 0.58));
          if (prevProg < 1.0 && strikeWebProg >= 1.0) {
            spawnSparks(strikeTarget.x, strikeTarget.y, strikeTarget.z, PAL.GOLD, 12, 34);
            shakeMag = Math.max(shakeMag, 2.2);
          }

          if (strikePhaseTimer <= 0) {
            strikePhase = 'RUSH';
            strikeWebProg = 1.0;
            const d3x = strikeTarget.x - px, d3y = strikeTarget.y - py, d3z = strikeTarget.z - pz;
            const dist = Math.hypot(d3x, d3y, d3z) || 1.0;
            const yankSpd = Math.min(175.0 * aug.maxSpeedMult, Math.max(BASE_STRIKE_RUSH_SPD, strikeEntrySpd * 1.22));
            vx = (d3x / dist) * yankSpd;
            vy = (d3y / dist) * yankSpd;
            vz = (d3z / dist) * yankSpd;
            flipAngle = 0.0;
            afterimageTimer = 0.85;
            shakeMag = Math.max(shakeMag, 3.0);
            spawnSparks(px, py, pz, PAL.GOLD, 12, 36);
          }
        } else {
          flipAngle += 16.0 * dt;
          const dx = strikeTarget.x - px, dy = strikeTarget.y - py, dz = strikeTarget.z - pz;
          const dist = Math.hypot(dx, dy, dz) || 1.0;
          const rushSpd = Math.min(205.0 * aug.maxSpeedMult, Math.max(isChainRush ? 162.0 : (BASE_STRIKE_RUSH_SPD + 6.0), strikeEntrySpd * 1.22));
          const steer = Math.min(1.0, 15.0 * dt);
          vx += ((dx / dist) * rushSpd - vx) * steer;
          vy += ((dy / dist) * rushSpd - vy) * steer;
          vz += ((dz / dist) * rushSpd - vz) * steer;

          const targetYaw = Math.atan2(dx, dz);
          let yd = (targetYaw - camYaw + Math.PI) % (2 * Math.PI) - Math.PI;
          if (yd < -Math.PI) yd += 2 * Math.PI;
          camYaw += yd * 13.0 * dt;

          px += vx * dt;
          py += vy * dt;
          pz += vz * dt;
        }
      }
    } else if (isSwinging) {
      vy -= (BASE_GRAVITY * aug.gravityMult) * dt;
      isDiving = false;
      isGliding = false;
      swingTimer += dt;
      comboTimer = Math.max(comboTimer, 2.5);
      if (py < swingMinY) swingMinY = py;

      const sinY = Math.sin(camYaw), cosY = Math.cos(camYaw);
      const rightX = cosY, rightZ = -sinY;

      vx += rightX * (turnInput * 48.0 * aug.turnMult) * dt;
      vz += rightZ * (turnInput * 48.0 * aug.turnMult) * dt;

      if (forwardInput > 0.15) {
        ropeLen = Math.max(24.0, ropeLen - 32.0 * forwardInput * dt);
        vx += sinY * forwardInput * (16.0 * aug.swingPushMult) * dt;
        vz += cosY * forwardInput * (16.0 * aug.swingPushMult) * dt;
      } else if (forwardInput < -0.15) {
        ropeLen = Math.min(ay - SAFE_SKIM_Y, ropeLen - 28.0 * forwardInput * dt);
      }

      if (groundLaunchTimer > 0) {
        groundLaunchTimer -= dt;
        ropeLen = Math.max(32.0, ropeLen - 26.0 * dt);
      }

      const predictedBottom = ay - ropeLen;
      if (predictedBottom < SAFE_SKIM_Y && py < 68.0) {
        const targetLen = Math.max(26.0, ay - SAFE_SKIM_Y);
        const urgency = py < 22.0 ? 8.5 : (py < 40.0 ? 4.8 : 2.6);
        const maxReelPerSec = py < 22.0 ? 52.0 : 34.0;
        const deltaLen = Math.min(maxReelPerSec * dt, (ropeLen - targetLen) * urgency * dt);
        if (deltaLen > 0) ropeLen -= deltaLen;
      }

      px += vx * dt;
      py += vy * dt;
      pz += vz * dt;

      const dx = px - ax, dy = py - ay, dz = pz - az;
      const curDist = Math.hypot(dx, dy, dz);

      if (curDist > ropeLen && curDist > 0.001) {
        const nx = dx / curDist, ny = dy / curDist, nz = dz / curDist;
        px = ax + nx * ropeLen;
        py = ay + ny * ropeLen;
        pz = az + nz * ropeLen;

        const speedBefore = Math.hypot(vx, vy, vz);
        const radialDot = vx * nx + vy * ny + vz * nz;
        if (radialDot > 0) {
          vx -= radialDot * nx;
          vy -= radialDot * ny;
          vz -= radialDot * nz;
        }

        const maxSwingSpd = (BASE_SWING_MAX_SPD + (perfectBuffTimer > 0 ? 22.0 : 0.0)) * aug.maxSpeedMult;
        const speedAfter = Math.hypot(vx, vy, vz);
        if (speedAfter > 4.0 && speedBefore > speedAfter) {
          const keep = passedBottom ? 0.94 : 0.88;
          const targetSpd = Math.min(maxSwingSpd, speedAfter + (speedBefore - speedAfter) * keep);
          const sc = targetSpd / speedAfter;
          vx *= sc; vy *= sc; vz *= sc;
        } else if (speedAfter <= 4.0) {
          vx += sinY * (14.0 * aug.swingPushMult) * dt;
          vz += cosY * (14.0 * aug.swingPushMult) * dt;
        }

        const anchorLocalZ = (ax - px) * sinY + (az - pz) * cosY;
        if (anchorLocalZ < 6.0 && swingTimer > 0.14) passedBottom = true;

        const fwdPast = -anchorLocalZ;
        const arcProgress = fwdPast / Math.max(30.0, ropeLen);
        inPerfectWindow = passedBottom && arcProgress >= 0.34 && arcProgress <= 0.88 && vy > 14.0;

        if (py < 24.0 && py > 4.5) {
          const skimBoost = (1.0 - (py - 4.5) / 19.5) * 24.0 * aug.swingPushMult;
          const hNow = Math.hypot(vx, vz);
          if (hNow > 1.0 && hNow < (maxSwingSpd + 14.0)) {
            vx += (vx / hNow) * skimBoost * dt;
            vz += (vz / hNow) * skimBoost * dt;
          }
        }

        if (passedBottom && py < ay + 15.0) {
          const swingDepth = Math.max(12.0, peakYBeforeSwing - swingMinY);
          vy += (9.5 + Math.min(24.0, swingDepth * 0.25)) * aug.bungeeBounce * dt;
        }

        const curHSpd = Math.hypot(vx, vz);
        if (curHSpd > 10.0) {
          const velYaw = Math.atan2(vx, vz);
          let yawDiff = (velYaw - camYaw + Math.PI) % (2 * Math.PI) - Math.PI;
          if (yawDiff < -Math.PI) yawDiff += 2 * Math.PI;
          camYaw += yawDiff * 5.2 * dt;
        }

        if (anchorLocalZ < -230.0 || (passedBottom && py >= ay + 54.0 && vy <= 0)) {
          isSwinging = false;
          inPerfectWindow = false;
          doingFlip = true;
          flipAngle = 0.0;
        }
      }
    } else {
      inPerfectWindow = false;

      if (py > 6.5 && forwardInput < -0.25) {
        isGliding = true;
        isDiving = false;
        diveCharge = Math.max(0.0, diveCharge - 0.35 * dt);
        vy -= (BASE_GRAVITY * 0.16 * aug.gravityMult) * dt;
        if (vy < -9.0) vy += (-9.0 - vy) * 9.0 * dt;
      } else if (py > 8.0 && vy < -6.0 && forwardInput > 0.25) {
        isGliding = false;
        isDiving = true;
        vy -= (BASE_GRAVITY * aug.gravityMult + 34.0 * forwardInput) * dt;
        diveCharge = Math.min(1.0, diveCharge + 0.85 * forwardInput * dt);
      } else {
        isGliding = false;
        isDiving = false;
        diveCharge = Math.max(0.0, diveCharge - 0.28 * dt);
        vy -= (BASE_GRAVITY * aug.gravityMult) * dt;
        if (py > 75.0 && Math.abs(vy) < 20.0) vy += BASE_GRAVITY * 0.36 * dt;
      }

      if (doingFlip) {
        flipAngle += 7.5 * dt;
        if (flipAngle >= Math.PI * 2) { flipAngle = 0.0; doingFlip = false; }
      }

      const hasVacuum = getLv('vacuum') > 0;
      const maxFreeSpd = BASE_FREE_MAX_SPD * aug.maxSpeedMult;
      let curHSpd = Math.hypot(vx, vz);

      if (forwardInput > 0) {
        curHSpd = Math.min(Math.max(curHSpd, maxFreeSpd), curHSpd + 24.0 * aug.swingPushMult * forwardInput * dt);
      } else if (forwardInput < 0 && !isGliding && !hasVacuum) {
        curHSpd = Math.max(0.0, curHSpd + 42.0 * forwardInput * dt);
      } else if (isGliding) {
        curHSpd = hasVacuum ? Math.max(22.0, curHSpd) : Math.max(22.0, curHSpd * (1.0 - 0.14 * dt));
      } else if (!hasVacuum) {
        curHSpd = Math.max(0.0, curHSpd * (1.0 - BASE_AIR_DRAG * dt));
      }

      const turnRate = (isGliding ? 1.65 : 0.95) * aug.turnMult;
      camYaw += turnInput * turnRate * dt;
      vx = Math.sin(camYaw) * curHSpd;
      vz = Math.cos(camYaw) * curHSpd;

      px += vx * dt;
      py += vy * dt;
      pz += vz * dt;
    }

    // Building collisions + proximity
    const { minWallDist, nearestSide } = handleBuildingsCollisionAndProximity(nearbyBuildings);

    // Ground Protection (바닥 로켓 방어 유지 · 탄성 반발은 건물 벽면 정면 충돌 전용)
    if (py < 2.5) {
      py = 2.5;
      doingFlip = false;
      isDiving = false;
      isGliding = false;
      diveCharge = 0;

      if (strikeMode === 1) {
        const slamDmg = 36 + Math.round(Math.min(50, Math.abs(vy) * 0.45));
        triggerShockwave(px, 3.0, pz, 55.0, slamDmg, PAL.ORANGE);
        clearStrikeState();
        strikeGraceTimer = Math.max(strikeGraceTimer, 0.50);
        airTimeStack = 0.0;
        vx *= 0.65; vz *= 0.65; vy = 26.0;
        spawnSparks(px, 1.5, pz, PAL.ORANGE, 14, 34);
        addPopup('METEOR IMPACT!', PAL.ORANGE, 2);
      } else {
        clearStrikeState();
        airTimeStack = 0.0;
        if (isSwinging) {
          vx *= 0.42; vz *= 0.42; vy = 0.0;
          isSwinging = false;
          inPerfectWindow = false;
          spawnSparks(px, 1.5, pz, PAL.ORANGE, 10, 26);
          takeDamage(8, 'GROUND SLAM!');
        } else {
          if (vy < -32.0) {
            vx *= 0.55; vz *= 0.55;
            takeDamage(8, 'HARD LANDING!');
          }
          vy = 0.0;
        }
      }
    }

    if (py > GAME_MAX_ALTITUDE) { py = GAME_MAX_ALTITUDE; if (vy > 0) vy = 0; }
    vy = Math.max(-260.0, Math.min(210.0, vy));

    const horizSpeed = Math.hypot(vx, vz);
    const totalSpeed = Math.hypot(horizSpeed, vy);

    // Enemy AI, Gimmicks & Projectile Combat Update
    updateCombat(dt, oldPx, oldPy, oldPz, nearbyBuildings, totalSpeed);

    // Visual Effects Update (Shockwaves, Lightning Bolts, Damage Numbers)
    for (let i = shockwaves.length - 1; i >= 0; i--) {
      const sw = shockwaves[i];
      sw.life -= dt;
      const prog = 1.0 - Math.max(0, sw.life / sw.maxLife);
      sw.r = 5.0 + (sw.maxR - 5.0) * prog;
      if (sw.life <= 0) shockwaves.splice(i, 1);
    }
    for (let i = lightningBolts.length - 1; i >= 0; i--) {
      lightningBolts[i].life -= dt;
      if (lightningBolts[i].life <= 0) lightningBolts.splice(i, 1);
    }
    for (let i = damageNumbers.length - 1; i >= 0; i--) {
      const dn = damageNumbers[i];
      dn.y += 16.0 * dt;
      dn.life -= dt;
      if (dn.life <= 0) damageNumbers.splice(i, 1);
    }

    // Dotted Afterimage sampling
    if (afterimageTimer > 0 || (strikeMode !== 0 && strikePhase === 'RUSH')) {
      if (afterimageTimer > 0) afterimageTimer -= dt;
      afterimageSampleAcc += dt;
      if (afterimageSampleAcc >= 0.04) {
        afterimageSampleAcc = 0;
        let aiPose = doingFlip ? 'FLIP' : 'DIVE';
        if (strikeMode === 3) aiPose = CARTOON_MOTIONS[strikeMotionIdx].pose;
        afterimages.push({
          x: px, y: py, z: pz,
          poseKey: aiPose,
          rot: doingFlip ? flipAngle : 0,
          tone: afterimages.length & 1
        });
        if (afterimages.length > 3) afterimages.shift();
      }
    } else if (afterimages.length > 0) {
      afterimageSampleAcc += dt;
      if (afterimageSampleAcc >= 0.05) {
        afterimageSampleAcc = 0;
        afterimages.shift();
      }
    }

    // Non-linear Wall Skim & Ground Skim Scoring (+ 마찰 과열 & XP 성장 연동)
    const lvFric = getLv('fric_heat');
    const maxSkimSpd = (BASE_SWING_MAX_SPD + 10.0) * aug.maxSpeedMult;
    const comboMult = Math.pow(1.38, Math.min(swingCombo, 10));
    let isSkimmingNow = false;

    if (minWallDist < 14.5 && totalSpeed > 26.0 && py > 4.0) {
      isSkimmingNow = true;
      skimTechTimer = 2.2;
      const wNorm = Math.max(0, 1.0 - minWallDist / 14.5);
      wallSkimIntensity += (wNorm - wallSkimIntensity) * 12.0 * dt;
      wallSkimSide = nearestSide;

      if (horizSpeed < maxSkimSpd && horizSpeed > 1.0) {
        let wBoost = isSwinging ? (16.0 + wNorm * 28.0) * dt : 0;
        if (lvFric > 0) {
          wBoost += horizSpeed * (0.25 + lvFric * 0.08) * dt;
          frictionCharge = Math.min(1.5, frictionCharge + dt * 0.95);
        }
        if (wBoost > 0) {
          vx += (vx / horizSpeed) * wBoost;
          vz += (vz / horizSpeed) * wBoost;
        }
      }

      score += Math.pow(wNorm, 3.0) * 950.0 * comboMult * dt;
      skimXpAcc += (5.0 + wNorm * 14.0) * dt;
      comboTimer = Math.max(comboTimer, 3.0);

      if (wNorm > 0.65 && Math.random() < 0.45) {
        const rightX = Math.cos(camYaw), rightZ = -Math.sin(camYaw);
        spawnSparks(px + rightX * nearestSide * 1.8, py, pz + rightZ * nearestSide * 1.8, lvFric > 0 ? PAL.CRIMSON : '#b8e4ff', 1, 14);
        addPopup('EXTREME WALL GRAZE!!', '#b8e4ff', 1);
      } else if (wNorm > 0.35 && Math.random() < 0.12) {
        addPopup('WALL SKIM!', '#cceeff', 0);
      }
    } else {
      wallSkimIntensity *= Math.max(0, 1.0 - 8.0 * dt);
    }

    if (py < 24.0 && py > 3.2 && totalSpeed > 30.0) {
      isSkimmingNow = true;
      skimTechTimer = 2.2;
      const gNorm = Math.max(0, 1.0 - (py - 3.5) / 20.5);
      groundSkimIntensity += (gNorm - groundSkimIntensity) * 10.0 * dt;

      if (lvFric > 0 && horizSpeed < maxSkimSpd && horizSpeed > 1.0) {
        const fBoost = horizSpeed * (0.25 + lvFric * 0.08) * dt;
        vx += (vx / horizSpeed) * fBoost;
        vz += (vz / horizSpeed) * fBoost;
        frictionCharge = Math.min(1.5, frictionCharge + dt * 0.95);
      }

      const gPts = Math.pow(gNorm, 3.0) * 1150.0 * comboMult * dt;
      score += gPts;
      skimXpAcc += (6.0 + gNorm * 16.0) * dt;
      comboTimer = Math.max(comboTimer, 3.0);

      if (wallSkimIntensity > 0.35 && gNorm > 0.45) {
        score += (gPts + Math.pow(wallSkimIntensity, 3.0) * 950.0 * comboMult * dt);
        skimXpAcc += 14.0 * dt;
        addPopup('CANYON RUSH!! x2', PAL.GOLD, 2);
      } else if (gNorm > 0.65) {
        addPopup('DANGER GROUND SKIM!', PAL.GOLD, 1);
      }
    } else {
      groundSkimIntensity *= Math.max(0, 1.0 - 8.0 * dt);
    }

    if (skimXpAcc >= 1.0) {
      const grant = Math.floor(skimXpAcc);
      skimXpAcc -= grant;
      gainXp(grant);
    }

    if (!isSkimmingNow && frictionCharge > 0) {
      frictionCharge = Math.max(0.0, frictionCharge - 0.18 * dt);
    }

    updateStageFromScore();

    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
      s.vy -= 30 * dt;
      s.life -= dt;
      if (s.life <= 0) sparks.splice(i, 1);
    }
    for (let i = popups.length - 1; i >= 0; i--) {
      popups[i].life -= dt;
      if (popups[i].life <= 0) popups.splice(i, 1);
    }

    // --- 2. Camera Dynamics ---
    let yawErr = (camYaw - camLagYaw + Math.PI) % (2 * Math.PI) - Math.PI;
    if (yawErr < -Math.PI) yawErr += 2 * Math.PI;
    camLagYaw += yawErr * (strikeCamBlend > 0.1 ? 14.0 : 9.0) * dt;

    const baseDist = 13.0 + totalSpeed * 0.068 + (isSwinging ? -1.2 : 2.2);
    const targetDist = baseDist - strikeCamBlend * 4.8;
    camDist += (targetDist - camDist) * (strikeCamBlend > 0.1 ? 12.0 : 6.0) * dt;

    let targetPitch;
    if (strikeTarget && strikeMode !== 0) {
      const sDx = strikeTarget.x - px, sDy = strikeTarget.y - py, sDz = strikeTarget.z - pz;
      targetPitch = Math.max(-0.85, Math.min(0.55, Math.atan2(sDy, Math.hypot(sDx, sDz) || 1.0)));
    } else {
      const normAlt = Math.max(0.0, Math.min(1.0, (py - 14.0) / 380.0));
      const descentLook = (!isSwinging && vy < -10.0 && py > 24.0) ? Math.max(-0.35, vy * 0.0045) : (vy * 0.0014);
      const divePitchBias = isDiving ? -0.22 : (isGliding ? 0.06 : 0.0);
      targetPitch = Math.max(-0.88, Math.min(0.45, 0.16 - normAlt * 0.62 + descentLook + divePitchBias));
    }
    camPitch += (targetPitch - camPitch) * 8.0 * dt;

    const swingBank = isSwinging ? (0.12 * anchorSide) : 0.0;
    const skimBank = wallSkimIntensity * -wallSkimSide * 0.14;
    const cartoonTilt = strikeCamBlend * (0.20 * strikeCamSide);
    const targetRoll = -turnInput * 0.28 + swingBank + skimBank + cartoonTilt;
    camRoll += (targetRoll - camRoll) * 9.0 * dt;

    const lowThrill = Math.max(0.0, (26.0 - py) * 1.0);
    const wallThrill = wallSkimIntensity * 24.0;
    const rushFov = (strikeMode !== 0 && strikePhase === 'RUSH') ? 32.0 : (diveCharge * 20.0);
    const cartoonZoomFov = strikeCamBlend * 34.0;
    const targetFov = Math.max(66.0, 228.0 - totalSpeed * 0.80 - lowThrill - wallThrill - rushFov + cartoonZoomFov);
    fovD += (targetFov - fovD) * 8.5 * dt;
  }

  // Tactile Action Buttons UI Update
  btnSwing.classList.remove('ready', 'perfect');
  if (augmentDraftOpen) {
    swingBtnLabel.textContent = 'SWING';
    swingBtnSub.textContent = 'USE STRIKE';
  } else if (gameOver) {
    btnSwing.classList.add('ready');
    swingBtnLabel.textContent = 'RETRY';
    swingBtnSub.textContent = 'TAP TO START';
  } else if (isSwinging && inPerfectWindow) {
    btnSwing.classList.add('perfect');
    swingBtnLabel.textContent = 'PERFECT!';
    swingBtnSub.textContent = 'RELEASE NOW!';
  } else if (isSwinging && passedBottom) {
    btnSwing.classList.add('ready');
    swingBtnLabel.textContent = 'RELEASE!';
    swingBtnSub.textContent = 'SLINGSHOT';
  } else if (isSwinging) {
    swingBtnLabel.textContent = 'SWINGING';
    swingBtnSub.textContent = 'W:UP / S:LOW';
  } else {
    swingBtnLabel.textContent = py <= 4.0 ? 'JUMP+ZIP' : 'SWING';
    swingBtnSub.textContent = py <= 4.0 ? 'HOLD TO SOAR' : (isGliding ? 'GLIDING!' : 'HOLD / JUMP');
  }

  if (btnStrike) {
    const previewCase = strikeMode !== 0 ? strikeMode : classifyStrikeCase();
    const curSpdNow = Math.hypot(vx, vy, vz);
    const isInstantNow = (previewCase === 3 && curSpdNow >= STRIKE_NO_FREEZE_SPEED);
    const hasLock = (!!homingTarget || previewCase === 1) && !gameOver && !augmentDraftOpen;
    btnStrike.classList.remove('locked', 'case1', 'case3');
    if (augmentDraftOpen) {
      if (draftLockTimer > 0) {
        strikeBtnLabel.textContent = 'WAIT...';
        strikeBtnSub.textContent = 'LOCKED';
      } else {
        btnStrike.classList.add('locked');
        strikeBtnLabel.textContent = 'SELECT';
        strikeBtnSub.textContent = 'CONFIRM';
      }
    } else if (hasLock) {
      if (previewCase === 1) btnStrike.classList.add('case1');
      else if (isInstantNow) btnStrike.classList.add('locked');
      else btnStrike.classList.add('case3');
      if (strikeMode !== 0) {
        strikeBtnLabel.textContent = strikePhase === 'HANG_SHOOT' ? 'SNAP!!' : (isChainRush ? 'CHAIN!!' : 'STRIKE!');
        strikeBtnSub.textContent = strikeMode === 1 ? 'C1 SLAM' : (isChainRush ? 'PINBALL' : 'C3 YANK');
      } else if (previewCase === 1) {
        strikeBtnLabel.textContent = 'SLAM!';
        strikeBtnSub.textContent = homingTarget ? 'C1 LOCK' : 'C1 DIVE';
      } else if (isInstantNow) {
        strikeBtnLabel.textContent = 'ZIP-HIT';
        strikeBtnSub.textContent = '160+ FAST';
      } else {
        strikeBtnLabel.textContent = 'SNAP!';
        strikeBtnSub.textContent = getCase3FreezeDuration(curSpdNow).toFixed(2) + 's';
      }
    } else {
      strikeBtnLabel.textContent = 'STRIKE';
      strikeBtnSub.textContent = 'NO LOCK';
    }
  }

  const horizSpeed = Math.hypot(vx, vz);
  const totalSpeed = Math.hypot(horizSpeed, vy);
  const comboMult = Math.pow(1.38, Math.min(swingCombo, 10));

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
  ctx.fillRect(-320, horizonY - 520, 640, 520 - panoH + 2);

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
  ctx.fillRect(-320, horizonY, 640, 26);
  ctx.fillStyle = stagePat.asphalt;
  ctx.fillRect(-320, horizonY + 22, 640, 420);
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

  const handPos = thirdPerson
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
  } else if (!isSwinging && strikeMode === 0) {
    const target = findWallAnchor(turnInput, forwardInput, nearbyBuildings, nearbyClouds);
    if (target) {
      const tp = projectWorldPt(target.wx, target.wy, target.wz, cb);
      if (tp) {
        ctx.strokeStyle = PAL.INDIGO_OUTLINE; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(tp.x, tp.y, 4.0, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = target.isCloud ? PAL.NEON_CYAN : PAL.CRIMSON; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(tp.x, tp.y, 4.0, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = target.isCloud ? '#ffffff' : PAL.GOLD; ctx.fillRect((tp.x - 1) | 0, (tp.y - 1) | 0, 2, 2);
      }
    }
  } else if (isSwinging && handPos) {
    const ap = projectWorldPt(ax, ay, az, cb);
    const hasVoltWeb = getLv('volt_web') > 0;
    const webCol = inPerfectWindow ? ((Math.floor(simTime * 28) & 1) ? '#ffffff' : PAL.GOLD)
      : (hasVoltWeb ? ((Math.floor(simTime * 24) & 1) ? PAL.NEON_CYAN : PAL.GOLD)
      : (passedBottom ? PAL.GOLD : '#ffffff'));
    const endPt = ap ? ap : { x: (LCD_W * 0.5 + anchorSide * 55) | 0, y: 0 };
    ctx.strokeStyle = (inPerfectWindow || hasVoltWeb) ? PAL.NEON_CYAN : PAL.INDIGO_OUTLINE;
    ctx.lineWidth = (inPerfectWindow || hasVoltWeb) ? 3.5 : 3;
    ctx.beginPath(); ctx.moveTo(handPos.x, handPos.y); ctx.lineTo(endPt.x, endPt.y); ctx.stroke();
    ctx.strokeStyle = webCol;
    ctx.lineWidth = (inPerfectWindow || hasVoltWeb) ? 2.0 : 1.4;
    ctx.beginPath(); ctx.moveTo(handPos.x, handPos.y); ctx.lineTo(endPt.x, endPt.y); ctx.stroke();

    if (hasVoltWeb) {
      const mx = (handPos.x + endPt.x) * 0.5 + (Math.random() - 0.5) * 8;
      const my = (handPos.y + endPt.y) * 0.5 + (Math.random() - 0.5) * 8;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(handPos.x, handPos.y); ctx.lineTo(mx, my); ctx.lineTo(endPt.x, endPt.y);
      ctx.stroke();
    }

    if (ap) {
      ctx.fillStyle = PAL.INDIGO_OUTLINE; ctx.fillRect((ap.x - 3) | 0, (ap.y - 3) | 0, 6, 6);
      ctx.fillStyle = PAL.CRIMSON; ctx.fillRect((ap.x - 2) | 0, (ap.y - 2) | 0, 4, 4);
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
  if (isDiving) {
    ctx.strokeStyle = diveCharge > 0.7 ? PAL.GOLD : PAL.NEON_CYAN;
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const lx = 24 + Math.random() * (LCD_W - 48);
      const ly = Math.random() * (LCD_H - 25);
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx, ly + 18 + diveCharge * 18); ctx.stroke();
    }
  }
  if (totalSpeed > 82 || (strikeMode !== 0 && strikePhase === 'RUSH') || groundSkimIntensity > 0.4) {
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

  if (strikeCamBlend > 0.08) {
    const barH = Math.round(strikeCamBlend * 11);
    ctx.fillStyle = PAL.INDIGO_OUTLINE;
    ctx.fillRect(0, 0, LCD_W, barH);
    ctx.fillRect(0, LCD_H - barH, LCD_W, barH);
  }

  if (damageFlash > 0) {
    ctx.strokeStyle = 'rgba(232, 40, 72, ' + Math.min(0.85, damageFlash * 2.4).toFixed(2) + ')';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, LCD_W - 6, LCD_H - 6);
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

  // LV / XP 성장 게이지
  const xpRatio = Math.max(0, Math.min(1, playerXp / Math.max(1, xpToNext)));
  drawPC98Box(4, 44, 114, 11, PAL.NEON_CYAN);
  ctx.font = 'bold 7.5px Consolas, monospace';
  ctx.fillStyle = PAL.GOLD;
  ctx.fillText('LV' + playerLevel, 7, 52);
  ctx.fillStyle = '#18203c';
  ctx.fillRect(28, 47, 85, 5);
  ctx.fillStyle = (perfectBuffTimer > 0 || skimTechTimer > 0) ? PAL.GOLD : PAL.NEON_CYAN;
  ctx.fillRect(28, 47, Math.round(xpRatio * 85), 5);
  ctx.strokeStyle = '#68b0f0';
  ctx.strokeRect(27.5, 46.5, 86, 6);

  if (diveCharge > 0.02) {
    drawPC98Box(4, 57, 114, 10, diveCharge > 0.7 ? PAL.GOLD : PAL.NEON_CYAN);
    ctx.fillStyle = '#cceeff';
    ctx.font = 'bold 7px Consolas, monospace';
    ctx.fillText('DIVE', 7, 64);
    ctx.fillStyle = diveCharge > 0.7 ? PAL.GOLD : PAL.NEON_CYAN;
    ctx.fillRect(28, 60, Math.round(diveCharge * 84), 4);
  }

  drawEnemyRadarHUD();

  drawPC98Box(LCD_W - 126, 4, 110, 44, swingCombo >= 3 ? PAL.GOLD : '#8fb8e6');
  ctx.font = 'bold 8px Consolas, monospace';
  ctx.fillStyle = PAL.NEON_CYAN;
  ctx.fillText('W' + wave + ' FOES:' + String(enemies.length).padStart(2, ' ') + ' K:' + kills, LCD_W - 121, 13);
  ctx.fillStyle = '#cceeff';
  ctx.fillText('BEST ' + String(bestScore).padStart(8, '0'), LCD_W - 121, 22);
  ctx.fillStyle = PAL.GOLD;
  ctx.fillText('NOW  ' + String(Math.floor(score)).padStart(8, '0'), LCD_W - 121, 31);
  ctx.fillStyle = swingCombo > 0 ? '#68b0f0' : '#8fb8e6';
  ctx.fillText('COMBO x' + swingCombo + ' (' + comboMult.toFixed(1) + 'x)', LCD_W - 121, 41);

  if (comboTimer > 0 && (swingCombo > 0 || score > 0)) {
    const cw = Math.min(102, (comboTimer / 4.6) * 102);
    ctx.fillStyle = PAL.GOLD;
    ctx.fillRect(LCD_W - 122, 44, cw | 0, 2);
  }

  if (!augmentDraftOpen && !gameOver) {
    drawActiveAugmentsHUD(totalSpeed);
  }

  for (let i = 0; i < popups.length; i++) {
    const pop = popups[i];
    ctx.font = 'bold 10px Consolas, monospace';
    const tw = ctx.measureText(pop.text).width;
    const pyText = 52 + i * 14;
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

  if (augmentDraftOpen) {
    drawAugmentDraftUI(drawPC98Box);
  }

  if (gameOver) {
    ctx.fillStyle = 'rgba(10, 14, 30, 0.62)';
    ctx.fillRect(0, 0, LCD_W, LCD_H);

    const bw = 204, bh = 98;
    const bx = (LCD_W - bw) >> 1, by = (LCD_H - bh) >> 1;
    drawPC98Box(bx, by, bw, bh, PAL.CRIMSON);
    ctx.strokeStyle = PAL.GOLD;
    ctx.strokeRect(bx + 2.5, by + 2.5, bw - 5, bh - 5);

    ctx.textAlign = 'center';
    ctx.font = 'bold 13px Consolas, monospace';
    ctx.fillStyle = PAL.CRIMSON;
    ctx.fillText('SYSTEM DOWN!', LCD_W * 0.5, by + 22);

    ctx.font = 'bold 9.5px Consolas, monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('WAVE REACHED : ' + wave + '   KILLS : ' + kills, LCD_W * 0.5, by + 42);
    ctx.fillStyle = PAL.GOLD;
    ctx.fillText('ALL-TIME BEST: ' + String(bestScore).padStart(8, '0'), LCD_W * 0.5, by + 58);

    if (Math.floor(performance.now() / 420) & 1) {
      ctx.font = 'bold 9px Consolas, monospace';
      ctx.fillStyle = PAL.NEON_CYAN;
      ctx.fillText('PRESS SPACE / TAP TO RETRY', LCD_W * 0.5, by + 84);
    }
    ctx.textAlign = 'left';
  }

  if (scanlineOn && scanlinePattern) {
    ctx.fillStyle = scanlinePattern;
    ctx.fillRect(0, 0, LCD_W, LCD_H);
  }

  requestAnimationFrame(tick);
}

// =========================================================================
// 12. DUAL-THUMB MULTI-TOUCH & PC KEYBOARD CONTROLS
// =========================================================================
function setupControls() {
  const toggleCam = () => {
    thirdPerson = !thirdPerson;
    btnCam.textContent = thirdPerson ? 'CAM: 3RD' : 'CAM: 1ST';
    btnCam.classList.toggle('active', thirdPerson);
  };
  const toggleShadows = () => {
    shadowsOn = !shadowsOn;
    btnShadow.textContent = shadowsOn ? 'SHADOWS: ON' : 'SHADOWS: OFF';
    btnShadow.classList.toggle('active', shadowsOn);
  };
  const toggleScanline = () => {
    scanlineOn = !scanlineOn;
    btnScanline.textContent = scanlineOn ? 'SCANLINE: ON' : 'SCANLINE: OFF';
    btnScanline.classList.toggle('active', scanlineOn);
  };

  btnCam.addEventListener('click', toggleCam);
  btnShadow.addEventListener('click', toggleShadows);
  btnScanline.addEventListener('click', toggleScanline);
  btnReset.addEventListener('click', resetGame);

  let joyPointerId = null;
  const maxRadius = 42;

  function updateJoy(e) {
    const rect = joyBase.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }
    joyKnob.style.transform = 'translate3d(' + dx + 'px, ' + dy + 'px, 0)';
    const nx = dx / maxRadius;
    const ny = -dy / maxRadius;
    joyX = Math.abs(nx) < 0.12 ? 0.0 : nx;
    joyY = Math.abs(ny) < 0.12 ? 0.0 : ny;
  }

  function clearJoy() {
    joyPointerId = null;
    joyX = 0.0; joyY = 0.0;
    joyKnob.style.transform = 'translate3d(0px, 0px, 0)';
    joyKnob.classList.remove('active');
  }

  joyBase.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (joyPointerId !== null) return;
    joyPointerId = e.pointerId;
    joyBase.setPointerCapture(e.pointerId);
    joyKnob.classList.add('active');
    updateJoy(e);
  });
  joyBase.addEventListener('pointermove', (e) => {
    if (e.pointerId !== joyPointerId) return;
    e.preventDefault();
    updateJoy(e);
  });
  joyBase.addEventListener('pointerup', (e) => { if (e.pointerId === joyPointerId) clearJoy(); });
  joyBase.addEventListener('pointercancel', (e) => { if (e.pointerId === joyPointerId) clearJoy(); });

  btnStrike.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    onStrikePress();
  });

  let swingPointerId = null;
  btnSwing.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (swingPointerId !== null) return;
    swingPointerId = e.pointerId;
    btnSwing.setPointerCapture(e.pointerId);
    onSwingDown();
  });
  const releaseSwingPtr = (e) => {
    if (e.pointerId !== swingPointerId) return;
    swingPointerId = null;
    onSwingUp();
  };
  btnSwing.addEventListener('pointerup', releaseSwingPtr);
  btnSwing.addEventListener('pointercancel', releaseSwingPtr);

  canvas.addEventListener('pointerdown', (e) => {
    if (augmentDraftOpen && draftChoices.length > 0) {
      if (draftLockTimer > 0) return;
      const rect = canvas.getBoundingClientRect();
      const lx = ((e.clientX - rect.left) / rect.width) * LCD_W;
      const idx = Math.max(0, Math.min(draftChoices.length - 1, Math.floor(lx / (LCD_W / draftChoices.length))));
      confirmAugment(idx);
      return;
    }
    if (gameOver) resetGame();
  });

  window.addEventListener('keydown', (e) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (!keys[e.code]) {
      keys[e.code] = true;
      if (augmentDraftOpen) {
        if (e.code === 'KeyA' || e.code === 'ArrowLeft') moveDraftCursor(-1);
        else if (e.code === 'KeyD' || e.code === 'ArrowRight') moveDraftCursor(1);
        else if (e.code === 'KeyE' || e.code === 'KeyF' || e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'Enter') confirmAugment(draftCursor);
        else if (e.code === 'Digit1' && draftChoices[0]) confirmAugment(0);
        else if (e.code === 'Digit2' && draftChoices[1]) confirmAugment(1);
        else if (e.code === 'Digit3' && draftChoices[2]) confirmAugment(2);
        return;
      }
      if (e.code === 'Space') onSwingDown();
      else if (e.code === 'KeyE' || e.code === 'KeyF' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') onStrikePress();
      else if (e.code === 'KeyV') toggleCam();
      else if (e.code === 'KeyH') toggleShadows();
      else if (e.code === 'KeyL') toggleScanline();
      else if (e.code === 'KeyR') resetGame();
    }
  });
  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
    if (e.code === 'Space') onSwingUp();
  });
}

// =========================================================================
// 13. SAFE INITIALIZATION
// =========================================================================
let initialized = false;
function initApp() {
  if (initialized) return;
  initialized = true;
  try {
    canvas         = document.getElementById('lcd');
    ctx            = canvas.getContext('2d', { alpha: false });
    ctx.imageSmoothingEnabled = false;

    btnCam         = document.getElementById('btn-cam');
    btnShadow      = document.getElementById('btn-shadow');
    btnScanline    = document.getElementById('btn-scanline');
    btnReset       = document.getElementById('btn-reset');
    btnSwing       = document.getElementById('btn-swing');
    swingBtnLabel  = document.getElementById('swing-btn-label');
    swingBtnSub    = document.getElementById('swing-btn-sub');
    btnStrike      = document.getElementById('btn-strike');
    strikeBtnLabel = document.getElementById('strike-btn-label');
    strikeBtnSub   = document.getElementById('strike-btn-sub');
    fpsBadge       = document.getElementById('fps-badge');
    stageDot       = document.getElementById('stage-dot');
    stageLabel     = document.getElementById('stage-label');
    joyBase        = document.getElementById('joy-base');
    joyKnob        = document.getElementById('joy-knob');

    loadBestScore();
    bakeAllStagePatterns();
    for (let s = 0; s < STAGE_CONFIGS.length; s++) {
      cloud2Sprites.push(bakeCloud2Sprite(STAGE_CONFIGS[s].cloudCols));
      panoramaCanvases.push(bakePanoramaStrip(s));
    }
    bakeAllSpideySprites();
    bakePropSprites();

    setupControls();
    resetGame();
    requestAnimationFrame(tick);
  } catch (err) {
    console.error('Simulator init error:', err);
  }
}

if (document.readyState === 'complete') {
  initApp();
} else {
  window.addEventListener('load', initApp);
}