'use strict';

// =========================================================================
// 3. GAME STATE, 3-TIER WAVE COMBAT & MANUAL 2-CASE STRIKE ENGINE
// =========================================================================
// 기본(노증강) 물리 기준값: 기본은 슴슴하고 쾌적하게, 증강으로 폭발적 성장 체감
const GAME_MAX_ALTITUDE = 650.0;     // 고도 제한 대폭 해제 (335m -> 650m)
const BASE_GRAVITY = 64.0;           // 묵직한 진자 회전과 리드미컬한 체공시간 기준 중력
const BASE_AIR_DRAG = 0.11;          // 진공 활공 체감 확대
const BASE_SWING_MAX_SPD = 92.0;     // 노증강 순항 100 이하 기준 (오버드라이브 성장 여지 확보)
const BASE_FREE_MAX_SPD = 68.0;
const BASE_STRIKE_RUSH_SPD = 136.0;
const BASE_PIERCE_SPD = 78.0;

let px = 0, py = 124, pz = -60, vx = 0, vy = 0, vz = 24, camYaw = 0;
let isSwinging = false, ax = 0, ay = 0, az = 0, ropeLen = 0, anchorSide = 1, lastAnchorSide = -1;
let swingTimer = 0, passedBottom = false, peakYBeforeSwing = 124, swingMinY = 124;
let autoCatchAfterJump = false, groundLaunchTimer = 0;
let swingReattachCooldown = 0, swingWebShootTimer = 0, isRopeTaut = false;
let camDist = 15.5, camLagYaw = 0, camPitch = -0.06, camRoll = 0, fovD = 175.0;
let flipAngle = 0, doingFlip = false;
let shakeMag = 0;

// Timing, Glide & Manual Strike State
let inPerfectWindow = false;
let perfectGraceTimer = 0;
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

// 6분 타이머 & 5단계 스타일 랭크(D/C/B/A/S -> 배경/화력 연동)
let currentStage = 0;
let runTimeRemaining = RUN_DURATION;
let runTimerZeroTriggered = false;

// Step 3: 6분 보스전 루프 상수 & 상태 (INTRO -> 40s EVADE <-> 6.5s/3-HIT GROGGY -> DEFEATED)
const BOSS_MAX_HP = 4200;
const BOSS_EVADE_DURATION = 40.0;
const BOSS_GROGGY_DURATION = 6.5;
const BOSS_GROGGY_MAX_HITS = 3;
const BOSS_INTRO_DURATION = 2.2;
const BOSS_DEATH_DURATION = 1.1;
const BOSS_CORE_RADIUS = 21.0;

let bossActive = false;
let bossPhase = 'NONE'; // 'NONE' | 'INTRO' | 'EVADE' | 'GROGGY' | 'DEFEATED'
let bossEntity = null;
let bossStage = 1; // 1: Normal, 2: Overdrive (HP <= 50%)
let bossPhaseTimer = 0.0;
let bossBattleTime = 0.0;
let bossGroggyHits = 0;
let bossEvadeFlash = 0.0;
let bossLastCutSec = 0.0;
let bossEscortTimer = 0.0;
let bossFireTimer = 0.0;
let bossPulseState = 'IDLE'; // 'IDLE' | 'WARN'
let bossPulseTimer = 0.0;
let bossPulseCd = 3.5;
let bossLaserState = 'IDLE'; // 'IDLE' | 'AIM' | 'FIRE'
let bossLaserTimer = 0.0;
let bossLaserCd = 5.0;
let bossLaserTx = 0.0, bossLaserTy = 95.0, bossLaserTz = 0.0;
let bossMines = [];
let bossDeathX = 0.0, bossDeathY = 95.0, bossDeathZ = 0.0;
let bossDeathBoomTimer = 0.0;
let runCleared = false;
let stylePoints = 0.0;
let styleRankIdx = 0;
let peakStyleRankIdx = 0;
let stylePopTimer = 0.0;
let stylePopDir = 1;
let stylePulseTimer = 0.0;
let swingCombo = 0;
let comboTimer = 0;
let wallSkimIntensity = 0, wallSkimSide = 0, groundSkimIntensity = 0;
let wallSlideCooldown = 0;
let popups = [], sparks = [];
let simTime = 0;

// Step 2: 5-Cut 영화적 옥상 보행 -> 구름 돌파 자유낙하 -> 역방향 공중 포즈 -> 첫 스윙 오프닝 상태 머신
// openingPhase: 'ROOF_WAIT' | 'ROOF_WALK' | 'DROP_INTRO' | 'DROP_CATCH' | 'ACTIVE'
const START_ROOF = { bx: 0.0, bz: -105.0, bw: 54.0, bd: 48.0, bh: 540.0 };
const START_ROOF_LEDGE_Z = START_ROOF.bz + START_ROOF.bd * 0.5;
let hasSeenRoofIntro = false;
let openingPhase = 'ROOF_WAIT';
let openingTimer = 0.0;
let openingEdgePause = 0.0;
let openingRetryDrop = false;
let openingLetterbox = 1.0;
let openingCamBlend = 1.0;
let openCamX = 7.8, openCamY = 543.5, openCamZ = -110.5;
let openingPoseMode = 'IDLE';
let openingCloudRush = 0.0;
let openingPoseRadial = 0.0;
let gameOverReason = '';

// Inputs
const keys = {};
let joyX = 0, joyY = 0, swingHeld = false;

function formatRunTimer(sec) {
  const clamped = Math.max(0, Math.ceil(sec - 0.001));
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function setStageIndicator(stageIdx) {
  const cfg = STAGE_CONFIGS[stageIdx] || STAGE_CONFIGS[0];
  const rank = STYLE_RANKS[stageIdx] || STYLE_RANKS[0];
  if (stageDot) {
    stageDot.className = 'inline-block w-1.5 h-1.5 rounded-full animate-pulse ' + cfg.dotClass;
  }
  if (stageLabel) {
    stageLabel.textContent = 'PC-98 · [' + rank.label + '] ' + cfg.name;
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
      lassoTargets = [];
      bossEntity = null;
      bossPulseState = 'IDLE';
      bossLaserState = 'IDLE';
      clearStrikeState();
      kills++;
      hitStopTimer = 0.14;
      shakeMag = 8.0;
      spawnExplosion(bossDeathX, bossDeathY, bossDeathZ, PAL.GOLD, PAL.CRIMSON, 48);
      shockwaves.push({ x: bossDeathX, y: bossDeathY, z: bossDeathZ, r: 12, maxR: 185, life: 0.55, maxLife: 0.55, col: PAL.GOLD });
      addPopup('OMEGA SOVEREIGN DOWN!!', PAL.GOLD, 3);
      return true;
    }

    spawnSparks(e.x, e.y, e.z, bossPhase === 'GROGGY' ? PAL.GOLD : col, 8, 28);
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

    // 티어별 회복량, 스타일 포인트, 고정 경험치(1.0x 고정) 지급
    const heal = e.tier === 'ELITE' ? 12 : (e.tier === 'MEDIUM' ? 5 : 2);
    hp = Math.min(MAX_HP, hp + heal);

    const killStyle = e.tier === 'ELITE' ? 20 : (e.tier === 'MEDIUM' ? 10 : 3);
    addStylePoints(killStyle, 4.4);

    const earnedXp = e.tier === 'ELITE' ? 135 : (e.tier === 'MEDIUM' ? 46 : 15);
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
    return false;
  }
}

// 광역 충격파 헬퍼 (초중력 C1 / 마찰 과열 / 탄성 반발 / 도미노 폭발 / 낙하 운동량 공용)
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
    applyEnemyDamage(targets[i], dmg, col, false, dominoDepth, false);
  }
}

function getStyleRankIndexFromPoints(pts) {
  for (let i = STYLE_RANKS.length - 1; i >= 0; i--) {
    if (pts >= STYLE_RANKS[i].minPts) return i;
  }
  return 0;
}

function syncStageFromStyleRank(announce = true) {
  const targetRank = getStyleRankIndexFromPoints(stylePoints);
  if (targetRank !== styleRankIdx || targetRank !== currentStage) {
    const prev = styleRankIdx;
    styleRankIdx = targetRank;
    if (styleRankIdx > peakStyleRankIdx) peakStyleRankIdx = styleRankIdx;
    currentStage = styleRankIdx;
    setStageIndicator(currentStage);
    if (announce && styleRankIdx > prev) {
      stylePopTimer = 0.34;
      stylePopDir = 1;
      const info = STYLE_RANKS[styleRankIdx];
      const rankBanners = [
        'RANK D',
        'RANK C · AFTERNOON!',
        'RANK B · SUNSET ZONE!',
        'RANK A · NEON NIGHT!',
        'RANK S · OVERDRIVE!!'
      ];
      addPopup(rankBanners[styleRankIdx] || ('RANK ' + info.label + '!'), info.col, 3);
      spawnSparks(px, py, pz, info.col, 14 + styleRankIdx * 2, 34 + styleRankIdx * 4);
    }
  }
}

function addStylePoints(pts, minComboTimer = 0) {
  if (pts <= 0 || gameOver) return;
  stylePoints = Math.min(100.0, stylePoints + pts);
  if (pts >= 2.0) {
    stylePulseTimer = Math.max(stylePulseTimer, 0.14);
  }
  if (minComboTimer > 0) {
    comboTimer = Math.max(comboTimer, minComboTimer);
  }
  syncStageFromStyleRank(true);
}

// 피격/충돌 시 2단계 랭크 강등 페널티 (S->B, A->C, B/C/D->D)
function dropStyleRanks(ranks, reasonText = null, reasonColor = '#ff6b81') {
  const prevRank = styleRankIdx;
  const targetRank = Math.max(0, prevRank - ranks);
  if (targetRank === 0) {
    stylePoints = 0.0;
  } else {
    const lo = targetRank * 20.0 + 4.0;
    const hi = targetRank * 20.0 + 16.0;
    stylePoints = Math.min(hi, Math.max(lo, stylePoints - ranks * 20.0));
  }
  swingCombo = 0;
  comboTimer = targetRank > 0 ? 2.2 : 0.0;
  if (prevRank > targetRank) {
    stylePopTimer = 0.28;
    stylePopDir = -1;
  }
  syncStageFromStyleRank(false);
  if (reasonText) {
    const rankTag = prevRank > targetRank ? (' [RANK ' + STYLE_RANKS[targetRank].label + ']') : '';
    addPopup(reasonText + rankTag, reasonColor, 2);
  }
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
}

// Step 3 보스전 진입 훅 (06:00 카운트다운 종료 시 1회 발동)
function onRunTimerZero() {
  runTimerZeroTriggered = true;
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
    bossPhaseTimer -= dt;
    if (bossPhaseTimer <= 0) {
      startBossEvadeTurn();
    }
    return;
  }

  // === EVADE TURN (40초 압박 + 접근 방해 기믹) ===
  bossPhaseTimer -= dt;

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

function releaseLassoTargets(reasonText = '') {
  if (lassoTargets.length === 0) return;
  lassoTargets = [];
  if (reasonText) {
    addPopup(reasonText, '#cbd5e1', 1);
  }
}

function takeDamage(amount, reasonText) {
  if (invulnTimer > 0 || gameOver) return;
  hp = Math.max(0, hp - amount);
  invulnTimer = 0.85;
  damageFlash = 0.35;
  shakeMag = Math.max(shakeMag, 4.5);
  if (strikeMode === 0) releaseLassoTargets('LASSO BROKEN!');
  clearStrikeState();
  strikeGraceTimer = 0;
  dropStyleRanks(2, reasonText + ' -' + amount + 'HP', PAL.CRIMSON);
  if (hp <= 0) {
    gameOver = true;
    isSwinging = false;
    inPerfectWindow = false;
    lassoTargets = [];
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

function isOpeningCutscene() {
  return openingPhase === 'ROOF_WAIT' || openingPhase === 'ROOF_WALK' || openingPhase === 'DROP_INTRO';
}

function isOpeningActive() {
  return openingPhase !== 'ACTIVE';
}

function handleOpeningAnyInput() {
  if (openingPhase !== 'ROOF_WAIT') return false;
  hasSeenRoofIntro = true;
  openingPhase = 'ROOF_WALK';
  openingTimer = 0.0;
  openingEdgePause = 0.0;
  openingPoseMode = 'WALK_A';
  swingHeld = false;
  if (btnSwing) btnSwing.classList.remove('pressed', 'ready', 'perfect');
  return true;
}

function completeOpeningCatch() {
  if (openingPhase !== 'DROP_CATCH') return;
  openingPhase = 'ACTIVE';
  openingTimer = 0.0;
  openingEdgePause = 0.0;
  openingCamBlend = 0.0;
  openingLetterbox = 0.0;
  openingCloudRush = 0.0;
  openingPoseRadial = 0.0;
  openingPoseMode = 'NONE';
  runTimeRemaining = RUN_DURATION;
  runTimerZeroTriggered = false;
  resetBossState();

  const sinY = Math.sin(camYaw), cosY = Math.cos(camYaw);
  if (py <= 95.0) {
    addStylePoints(18, 4.4);
    hitStopTimer = 0.048;
    shakeMag = Math.max(shakeMag, 3.0);
    vx += sinY * 18.0;
    vz += cosY * 18.0;
    spawnSparks(px, py, pz, PAL.GOLD, 16, 36);
    addPopup('DAREBLITZ CATCH!!', PAL.GOLD, 2);
  } else if (py <= 200.0) {
    addStylePoints(10, 4.0);
    hitStopTimer = 0.035;
    shakeMag = Math.max(shakeMag, 2.0);
    vx += sinY * 10.0;
    vz += cosY * 10.0;
    spawnSparks(px, py, pz, PAL.NEON_CYAN, 12, 28);
    addPopup('SWEET CATCH!!', PAL.NEON_CYAN, 2);
  } else {
    addStylePoints(5, 3.6);
    hitStopTimer = 0.025;
    spawnSparks(px, py, pz, '#ffffff', 10, 24);
    addPopup('SWING ON!!', '#ffffff', 2);
  }
  spawnWave(1);
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

  // 안 B: 최초 실행은 구름 위 540m 초고층 옥상(ROOF_WAIT) -> 5.8초 5-Cut 영화 컷신, 재도전 시 385m 구름 상단 압축 낙하 컷신(1.55초)
  if (!hasSeenRoofIntro) {
    openingPhase = 'ROOF_WAIT';
    openingRetryDrop = false;
    openingTimer = 0.0;
    openingPoseMode = 'IDLE';
    openingLetterbox = 1.0;
    openingCamBlend = 1.0;
    px = 0.0; py = START_ROOF.bh + 2.1; pz = -102.0;
    vx = 0.0; vy = 0.0; vz = 0.0;
    openCamX = 7.8; openCamY = py + 1.4; openCamZ = pz - 8.5;
    camDist = 11.5; camLagYaw = Math.atan2(px - openCamX, pz - openCamZ); camPitch = -0.05; camRoll = 0.0; fovD = 192.0;
  } else {
    openingPhase = 'DROP_INTRO';
    openingRetryDrop = true;
    openingTimer = 0.0;
    openingPoseMode = 'SLIP';
    openingLetterbox = 1.0;
    openingCamBlend = 1.0;
    px = 0.0; py = 385.0; pz = START_ROOF_LEDGE_Z + 0.5;
    vx = 0.0; vy = -16.0; vz = 13.0;
    openCamX = -2.6; openCamY = 390.5; openCamZ = START_ROOF_LEDGE_Z - 8.5;
    camDist = 14.0; camLagYaw = 0.0; camPitch = -0.35; camRoll = 0.0; fovD = 205.0;
  }
  peakYBeforeSwing = py;
  swingMinY = py;
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
function computeStrikeDamage(mode, entrySpd, entryDist, downVy, isChain) {
  const aug = getAugStats();
  const rankInfo = STYLE_RANKS[styleRankIdx] || STYLE_RANKS[0];
  let rawDmg = 26.0;
  let skillMult = 1.0;
  let isCrit = false;

  if (mode === 1) {
    // Case 1 (SLAM!): 하강·진입 속도 통합 스케일링 + 급강하 가중치 (저속 약낙하 억제, 고속 급강하 폭딜)
    const fallSpd = Math.max(24.0, downVy, peakFallSpeed);
    const effSpd = Math.max(entrySpd, fallSpd * 1.15);
    rawDmg = 26.0 * getSpeedDamageMult(effSpd) * (1.15 + diveCharge * 0.25);
    isCrit = effSpd >= 92.0 || getLv('heavy_suit') >= 3;
  } else if (isChain) {
    // 연쇄 핀볼: 진입 속도 비례 스케일링 적용 (Lv.1~3 기본 계수 16/22/28)
    const cSpec = getChainSpec();
    const baseChain = cSpec ? cSpec.baseDmg : 16.0;
    rawDmg = baseChain * getSpeedDamageMult(entrySpd);
    if (entrySpd >= 95.0) isCrit = true;
  } else {
    // Case 2 / Case 3: 모든 수동 STRIKE에 통합 속도 배율 적용 (저속 SHIFT 난타 18~26 dmg)
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

  // [연속 돌격]: 수동 Shift 연타 및 연쇄 핀볼 적중 스택 비례 증폭
  const rushSpec = getStrikeRushSpec();
  if (rushSpec && strikeRushStack > 0 && strikeRushTimer > 0) {
    rawDmg *= (1.0 + strikeRushStack * rushSpec.dmgPerStack);
    if (strikeRushStack >= rushSpec.critAt) isCrit = true;
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

function onStrikePress() {
  if (augmentDraftOpen) { confirmAugment(draftCursor); return; }
  if (gameOver) { resetGame(); return; }
  if (handleOpeningAnyInput()) return;
  if (isOpeningActive()) return;
  if (strikeCooldown > 0 || strikeMode !== 0) return;

  const aug = getAugStats();
  const rushSpec = getStrikeRushSpec();
  const cdMult = rushSpec ? rushSpec.cdMult : 1.0;
  const caseType = classifyStrikeCase();
  const totalSpd = Math.hypot(vx, vy, vz);
  const overReset = (getLv('overdrive') >= 3 && totalSpd >= 115.0);

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
  const hasTurnIntent = Math.abs(turnInput) >= 0.18;
  const preferSide = !hasTurnIntent ? -lastAnchorSide : (turnInput < 0 ? -1 : 1);

  for (const b of bList) {
    const dx = b.bx - px, dz = b.bz - pz;
    const localX = dx * cosY - dz * sinY;
    const localZ = dx * sinY + dz * cosY;

    if (localZ > 28.0 && localZ < 280.0 && Math.abs(localX) > 6.0 && Math.abs(localX) < 205.0) {
      // 조이스틱 기본 전진 자세에서도 과도하게 높은 벽을 잡지 않도록 균형 높이 유지 (후진 시에만 낮춤)
      const altBias = fwdInput < -0.3 ? 68.0 : 95.0;
      const targetWallY = Math.min(b.bh - 6.0, Math.max(py + altBias, 130.0));
      if (targetWallY <= py + 8.0) continue;

      // 월드 좌표(dx, dz) 기준으로 플레이어와 마주한 실제 앞쪽 모서리 선택 (시점 회전 시 뒷면 부착 버그 수정)
      const wx = b.bx - (dx >= 0 ? b.bw * 0.5 : -b.bw * 0.5);
      const wz = b.bz - (dz >= 0 ? b.bd * 0.5 : -b.bd * 0.5);
      const cornerLocalX = (wx - px) * cosY - (wz - pz) * sinY;
      const side = cornerLocalX >= 0 ? 1 : -1;

      const idealZ = 95.0 + horizSpd * 0.45;
      let sc = Math.abs(localZ - idealZ) + Math.abs(Math.abs(localX) - 56.0) * 0.48;
      if (side === preferSide) sc -= hasTurnIntent ? 75.0 : 35.0;

      if (sc < minScore) {
        minScore = sc;
        best = { wx, wy: targetWallY, wz, side, isCloud: false };
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

  const wasOpeningDropCatch = (openingPhase === 'DROP_CATCH');

  if (!wasOpeningDropCatch && diveCharge >= 0.22) {
    const aug = getAugStats();
    const lowBonus = py < 45.0 ? (1.0 + (45.0 - py) / 45.0 * 0.30) : 1.0;
    const softBoostCap = (BASE_SWING_MAX_SPD + 16.0) * aug.maxSpeedMult;
    const curSpd = Math.hypot(vx, vy, vz);
    const rawBoost = (10.0 + diveCharge * 10.0) * lowBonus * aug.swingPushMult;
    const boost = curSpd < softBoostCap ? Math.min(rawBoost, softBoostCap - curSpd) : 0.0;
    vx += sinY * boost;
    vz += cosY * boost;
    addStylePoints(Math.round(10 * lowBonus), 3.8);
    shakeMag = Math.max(shakeMag, 2.4);
    spawnSparks(px, py, pz, PAL.NEON_CYAN, 12, 32);
    addPopup('DIVE BOOST!', PAL.NEON_CYAN, 2);
    diveCharge = 0;
    isDiving = false;
  } else if (wasOpeningDropCatch) {
    diveCharge = 0;
    isDiving = false;
    // 아슬아슬한 저공 첫 캐치 시 도로를 멋지게 스쳐 지나가도록 최소 지상 여유 보장
    ropeLen = Math.min(ropeLen, Math.max(24.0, ay - 8.5));
  }

  peakYBeforeSwing = Math.max(py, 115.0);
  swingMinY = py;
  isSwinging = true;
  swingTimer = 0.0;
  passedBottom = false;
  inPerfectWindow = false;
  perfectGraceTimer = 0.0;
  swingWebShootTimer = 0.05;
  isRopeTaut = false;
  doingFlip = false;
  spawnSparks(ax, ay, az, target.isCloud ? '#b8e4ff' : '#ffffff', 7, 22);
  if (wasOpeningDropCatch) {
    completeOpeningCatch();
  }
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
  if (handleOpeningAnyInput()) {
    return;
  }
  if (isOpeningCutscene()) {
    return;
  }

  swingHeld = true;
  swingReattachCooldown = 0;
  btnSwing.classList.add('pressed');

  if (py <= 4.0) {
    vy = 58.0;
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
    const wasPerfect = inPerfectWindow || perfectGraceTimer > 0;
    isSwinging = false;
    inPerfectWindow = false;
    perfectGraceTimer = 0;
    isRopeTaut = false;
    swingWebShootTimer = 0;
    groundLaunchTimer = 0;

    if ((swingTimer > 0.18 && (passedBottom || vy > 8.0)) || wasPerfect) {
      swingCombo = Math.min(12, swingCombo + (wasPerfect ? 2 : 1));
      comboTimer = 4.6;

      const swingDepth = Math.max(10.0, peakYBeforeSwing - swingMinY);
      const depthRatio = Math.min(1.0, swingDepth / 75.0);
      const sinY = Math.sin(camYaw), cosY = Math.cos(camYaw);
      const maxCruiseSpd = BASE_SWING_MAX_SPD * aug.maxSpeedMult;
      const softBoostCap = (BASE_SWING_MAX_SPD + 16.0) * aug.maxSpeedMult;

      if (wasPerfect) {
        const lvBung = getLv('bungee_web');
        hitStopTimer = 0.045;
        const upwardKick = (10.0 + depthRatio * 7.0) * aug.bungeeBounce;
        const targetVy = Math.min(78.0 * aug.bungeeBounce, vy + upwardKick);
        vy = Math.max(vy, targetVy);

        const curSpd = Math.hypot(vx, vy, vz);
        const bungPerfMult = lvBung >= 3 ? 1.35 : 1.0;
        const rawFwd = (10.0 + depthRatio * 6.0) * aug.swingPushMult * bungPerfMult;
        const fwdAdd = curSpd < softBoostCap ? Math.min(rawFwd, softBoostCap - curSpd) : 0.0;
        vx += sinY * fwdAdd;
        vz += cosY * fwdAdd;
        perfectBuffTimer = 3.4;
        if (lvBung >= 3) {
          invulnTimer = Math.max(invulnTimer, 0.40);
        }
        if (refillElasticCharges()) {
          spawnSparks(px, py, pz, PAL.EMERALD, 6, 26);
        }

        addStylePoints(12, 4.6);
        afterimageTimer = 0.85;
        afterimages = [];
        shakeMag = Math.max(shakeMag, 2.8);
        spawnSparks(px, py, pz, PAL.GOLD, 10, 34);
        spawnSparks(px, py, pz, PAL.NEON_CYAN, 8, 30);
        addPopup('PERFECT RELEASE!!', PAL.NEON_CYAN, 3);
      } else {
        const upwardKick = (6.0 + depthRatio * 6.0) * aug.bungeeBounce;
        const targetVy = Math.min(64.0 * aug.bungeeBounce, vy + upwardKick);
        vy = Math.max(vy, targetVy);

        const curHSpd = Math.hypot(vx, vz);
        if (curHSpd < maxCruiseSpd) {
          const fwdAdd = Math.min((3.0 + depthRatio * 4.0) * aug.swingPushMult, maxCruiseSpd - curHSpd);
          vx += sinY * fwdAdd;
          vz += cosY * fwdAdd;
        }

        if (swingDepth > 55) {
          addStylePoints(5, 4.6);
          addPopup('BIG ARC!', PAL.GOLD, 1);
        } else {
          addStylePoints(2, 4.6);
        }
      }

      doingFlip = true;
      flipAngle = 0.0;
    } else if (swingTimer > 0.10 && vy > 4.0) {
      // 짧은 스윙 이탈 시에도 가벼운 도약 보정
      const microKick = 7.0 * aug.bungeeBounce;
      vy = Math.max(vy, Math.min(48.0 * aug.bungeeBounce, vy + microKick));
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
              perfectGraceTimer = 0;
              isRopeTaut = false;
              swingReattachCooldown = 0.18;
              clearStrikeState();
              if (getLv('fric_heat') > 0) frictionCharge = Math.min(1.5, frictionCharge + 0.55);
              if (lvElastic >= 3) elasticCritTimer = 2.5;
              shakeMag = Math.max(shakeMag, 2.8);
              const eShock = getElasticShockSpec();
              triggerShockwave(px, py, pz, eShock ? eShock.radius : 44, eShock ? eShock.dmg : 20, PAL.EMERALD);
              spawnSparks(px, py, pz, PAL.EMERALD, 14, 34);
              const maxCharges = getElasticMaxCharges();
              const critTag = lvElastic >= 3 ? ' CRIT!' : '';
              addPopup('ELASTIC ' + bounceMult.toFixed(2) + 'x' + critTag + ' (' + elasticChargesLeft + '/' + maxCharges + ')', lvElastic >= 3 ? PAL.GOLD : PAL.EMERALD, 2);
              continue;
            }

            vx = (vx - vn * nx) * 0.25 + nx * Math.min(18.0, Math.abs(vn) * 0.28);
            vz = (vz - vn * nz) * 0.25 + nz * Math.min(18.0, Math.abs(vn) * 0.28);
            vy *= 0.45;
            isSwinging = false;
            inPerfectWindow = false;
            perfectGraceTimer = 0;
            isRopeTaut = false;
            swingReattachCooldown = 0.18;
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
              addStylePoints(6, 3.2);
              spawnSparks(px, py, pz, '#b8e4ff', 7, 22);
              addPopup('WALL SLIDE!', '#b8e4ff', 1);
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
      hp = Math.min(MAX_HP, hp + 15);
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
          spawnSparks(e.x, e.y, e.z, '#a78bfa', 6, 20);
          addPopup('TIED ' + lassoTargets.length + '/' + lassoSpec.maxTied, lassoTargets.length >= lassoSpec.awakenCount ? PAL.GOLD : '#d8b4fe', 1);
        }
      }
    }
  }

  const segDx = px - oldX, segDy = py - oldY, segDz = pz - oldZ;
  const segLenSq = segDx * segDx + segDy * segDy + segDz * segDz;
  const isActiveAttack = (strikeMode !== 0 && strikePhase === 'RUSH');
  let isStrikeProtected = (strikeMode !== 0) || (strikeGraceTimer > 0);
  const hMoveSpd = Math.hypot(vx, vz);
  const backSin = hMoveSpd > 4.0 ? (vx / hMoveSpd) : Math.sin(camYaw);
  const backCos = hMoveSpd > 4.0 ? (vz / hMoveSpd) : Math.cos(camYaw);

  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (!e) continue;

    const tiedIdx = lassoTargets.indexOf(e);
    if (tiedIdx !== -1) {
      // 올가미로 포획된 적은 초경량 Lerp로 플레이어 뒤쪽 궤적을 따라 끌려옴 (독립 AI·원거리 사격·몸통 피격 정지)
      const trailDist = 14.0 + (tiedIdx % 4) * 5.5;
      const sideSign = (tiedIdx & 1) ? 1 : -1;
      const sideMag = 4.5 + Math.floor(tiedIdx / 2) * 2.5;
      const rightX = backCos, rightZ = -backSin;
      const gx = px - backSin * trailDist + rightX * sideSign * sideMag;
      const gy = Math.max(8.0, py - 3.0 - (tiedIdx % 3) * 2.2);
      const gz = pz - backCos * trailDist + rightZ * sideSign * sideMag;
      const lerpT = Math.min(1.0, 9.5 * dt);
      e.x += (gx - e.x) * lerpT;
      e.y += (gy - e.y) * lerpT;
      e.z += (gz - e.z) * lerpT;
      e.vx = vx; e.vy = vy; e.vz = vz;
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

        const calc = computeStrikeDamage(curMode, strikeEntrySpd, strikeEntryDist, Math.max(0, -vy), isChainRush);
        const dmg = calc.dmg;
        const isCrit = calc.isCrit;
        const impactCol = curMode === 1 ? PAL.ORANGE : (isChainRush ? PAL.NEON_PINK : (isCrit ? PAL.GOLD : (dmg <= 30 ? '#cbd5e1' : PAL.NEON_CYAN)));

        hitStopTimer = curMode === 1 ? 0.055 : (isCrit ? 0.052 : (isChainRush ? 0.032 : 0.038));
        shakeMag = Math.max(shakeMag, curMode === 1 ? 4.8 : (isCrit ? 4.4 : 3.2));
        swingCombo = Math.min(12, swingCombo + 1);
        addStylePoints((curMode === 1 || strikeEntrySpd >= 95.0) ? 12 : 8, 5.0);
        afterimageTimer = 0.75;

        // 타격 직후 0.65초 공격 보호 유예 + 타격 지점 영거리 투사체 소거 (초중력 Lv.3 SLAM은 95m 광역 소거!)
        strikeGraceTimer = 0.65;
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

        // [연속 돌격] 수동 STRIKE 및 연쇄 핀볼 적중 모두 RUSH 스택 누적!
        const rushSpec = getStrikeRushSpec();
        if (rushSpec) {
          strikeRushStack = Math.min(rushSpec.maxStack, strikeRushStack + 1);
          strikeRushTimer = 2.8;
        }

        // [올가미 스윙] 포획된 적 전원 일괄 기폭!
        let lassoAwakenBounce = false;
        if (lassoSpec && lassoTargets.length > 0) {
          const tiedSnap = lassoTargets.slice();
          lassoTargets = [];
          const tiedCount = tiedSnap.length;
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

        // 연쇄 종료 -> 정상 반동/관통 마무리
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
          const blockedBehind = bossForceRebound || hasObstacleBehindTarget(e, dirX, dirY, dirZ, bList);
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

        // [연속 돌격] 벡터가 바뀌어도 타격 후 속력 보존(85%/95%/105%) -> 정지 없는 고속 연타 연계!
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

        // 체공 예열 / 낙하 운동량 스택 후처리 (Lv.3 각성 50% 유지 및 핀볼 Lv.2+ 체공 유지)
        const airSpec = getAirHeatSpec();
        if (!(chainSpec && chainSpec.keepAir)) {
          airTimeStack = (airSpec && airSpec.keepRatio > 0) ? (airTimeStack * airSpec.keepRatio) : 0.0;
        }
        peakFallSpeed = (fallSpec && fallSpec.keepRatio > 0) ? (peakFallSpeed * fallSpec.keepRatio) : 0.0;
        frictionCharge = 0.0;
        perfectBuffTimer = 0.0;
        skimTechTimer = 0.0;
        elasticCritTimer = 0.0;

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
        addStylePoints(10, 3.8);
        spawnSparks(pr.x, pr.y, pr.z, PAL.NEON_CYAN, 10, 32);
        addPopup('DEFLECT!', PAL.NEON_CYAN, 1);
        projectiles.splice(i, 1);
      } else {
        spawnSparks(pr.x, pr.y, pr.z, PAL.CRIMSON, 12, 28);
        projectiles.splice(i, 1);
        takeDamage(10, 'PLASMA HIT!');
      }
    }
  }

  if (bossActive) {
    updateBossSystem(dt, bList, oldX, oldY, oldZ, isStrikeProtected);
  }
}

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
function drawBossHazards3D(cb) {
  if (!bossActive) return;

  // 1) 공전 및 비행 경로 에너지 기뢰
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

    ctx.fillStyle = m.orbitMode ? (blink ? PAL.CRIMSON : '#9b1c48') : (blink ? PAL.ORANGE : PAL.CRIMSON);
    ctx.beginPath();
    ctx.moveTo(mx, my - mr); ctx.lineTo(mx + mr, my);
    ctx.lineTo(mx, my + mr); ctx.lineTo(mx - mr, my);
    ctx.closePath(); ctx.fill();

    ctx.fillStyle = blink ? '#ffffff' : PAL.GOLD;
    ctx.fillRect(mx - 1, my - 1, 2, 2);
  }

  // 2) 근접 견제 반발 펄스 경고 링
  if (bossEntity && bossPulseState === 'WARN') {
    const bp = projectWorldPt(bossEntity.x, bossEntity.y, bossEntity.z, cb);
    if (bp && bp.z > 4) {
      const prog = 1.0 - Math.max(0.0, bossPulseTimer / 0.85);
      const pr = Math.max(8, Math.min(130, ((58.0 * (1.0 - prog * 0.65)) / bp.z) * cb.d));
      ctx.strokeStyle = ((Math.floor(simTime * 20) & 1) === 0) ? PAL.CRIMSON : PAL.GOLD;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(bp.x, bp.y, pr, 0, Math.PI * 2); ctx.stroke();
    }
  }

  // 3) 조준 레이저 (AIM 예고선 -> FIRE 고출력 빔)
  if (bossEntity && (bossLaserState === 'AIM' || bossLaserState === 'FIRE')) {
    const b = bossEntity;
    const bx2 = b.x + (bossLaserTx - b.x) * 2.2;
    const by2 = b.y + (bossLaserTy - b.y) * 2.2;
    const bz2 = b.z + (bossLaserTz - b.z) * 2.2;
    if (bossLaserState === 'AIM') {
      const blink = ((Math.floor(simTime * 22) & 1) === 0);
      drawClippedLine3D([b.x, b.y, b.z], [bx2, by2, bz2], cb, blink ? PAL.CRIMSON : PAL.GOLD, 1);
    } else {
      drawClippedLine3D([b.x, b.y, b.z], [bx2, by2, bz2], cb, PAL.INDIGO_OUTLINE, 6);
      drawClippedLine3D([b.x, b.y, b.z], [bx2, by2, bz2], cb, PAL.CRIMSON, 4);
      drawClippedLine3D([b.x, b.y, b.z], [bx2, by2, bz2], cb, PAL.GOLD, 2);
      drawClippedLine3D([b.x, b.y, b.z], [bx2, by2, bz2], cb, '#ffffff', 1);
    }
  }
}

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

function drawSpiderManSprite(cb, totalSpeed) {
  const centerPt = projectWorldPt(px, py, pz, cb);
  if (!centerPt) return null;

  let poseKey = 'DIVE';
  let spinThisPose = false;
  const isHeroPoseCut = (openingPhase === 'DROP_INTRO' && openingPoseMode === 'POSE');
  if (openingPhase === 'ROOF_WAIT') {
    poseKey = 'ROOF_IDLE';
  } else if (openingPhase === 'ROOF_WALK') {
    poseKey = (openingPoseMode === 'IDLE') ? 'ROOF_IDLE' : ((openingPoseMode === 'WALK_B') ? 'ROOF_WALK_B' : 'ROOF_WALK_A');
  } else if (openingPhase === 'DROP_INTRO') {
    if (openingPoseMode === 'SLIP') poseKey = 'GROUND_JUMP';
    else if (openingPoseMode === 'FLIP') poseKey = 'FLIP';
    else if (openingPoseMode === 'POSE') poseKey = 'DROP_HERO';
    else poseKey = 'DIVE';
  } else if (strikeMode === 3) {
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
    const maxGhostH = isHeroPoseCut ? 64 : 46;
    const sc = Math.max(12, Math.min(maxGhostH, (4.2 / ap.z) * cb.d)) / ghostCanvas.height;
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
  const maxSprH = isHeroPoseCut ? 72 : 54;
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

// Step 2: 5-Cut 영화적 오프닝 컷신 (540m 구름 위 옥상 -> 보행 & 난간 숨고르기 -> 난간 잔류 스르륵 추락 -> 구름 돌파 급추격 -> 역방향 공중 포즈 -> 다이브 스냅)
function updateOpeningCutscene(dt) {
  if (!isOpeningCutscene()) return false;
  simTime += dt;
  const prevT = openingTimer;
  openingTimer += dt;

  const aimOpeningCam = (tx, ty, tz, rate) => {
    const dx = tx - openCamX, dy = ty - openCamY, dz = tz - openCamZ;
    const hDist = Math.hypot(dx, dz) || 1.0;
    const desYaw = Math.atan2(dx, dz);
    const desPitch = Math.max(-1.22, Math.min(0.68, Math.atan2(dy, hDist)));
    if (rate >= 99.0) {
      camLagYaw = desYaw;
      camPitch = desPitch;
    } else {
      let yd = (desYaw - camLagYaw + Math.PI) % (Math.PI * 2) - Math.PI;
      if (yd < -Math.PI) yd += Math.PI * 2;
      camLagYaw += yd * Math.min(1.0, rate * dt);
      camPitch += (desPitch - camPitch) * Math.min(1.0, rate * dt);
    }
  };

  if (openingPhase === 'ROOF_WAIT') {
    px = 0.0; py = START_ROOF.bh + 2.1; pz = -102.0;
    vx = 0.0; vy = 0.0; vz = 0.0;
    openCamX = 7.8 + Math.sin(openingTimer * 0.7) * 0.45;
    openCamY = py + 1.4 + Math.sin(openingTimer * 1.1) * 0.14;
    openCamZ = pz - 8.5;
    camYaw = 0.0;
    aimOpeningCam(px - 1.2, py + 0.2, pz + 6.0, 12.0);
    camRoll = 0.0;
    fovD = 192.0;
    openingCamBlend = 1.0;
    openingLetterbox = 1.0;
    openingCloudRush = 0.0;
    openingPoseRadial = 0.0;
    openingPoseMode = 'IDLE';
    return true;
  }

  if (openingPhase === 'ROOF_WALK') {
    openingCloudRush = 0.0;
    openingPoseRadial = 0.0;
    const stopZ = START_ROOF_LEDGE_Z - 1.0; // -82.0
    if (pz < stopZ) {
      const distToEdge = Math.max(0.0, stopZ - pz);
      const walkSpd = distToEdge < 5.5 ? (8.5 + (distToEdge / 5.5) * 4.5) : 13.0;
      pz = Math.min(stopZ, pz + walkSpd * dt);
      vx = 0.0; vy = 0.0; vz = walkSpd;
      py = START_ROOF.bh + 2.1 + Math.abs(Math.sin(openingTimer * 6.4)) * 0.22;
      openingPoseMode = ((Math.floor(openingTimer * 4.4) & 1) === 0) ? 'WALK_A' : 'WALK_B';

      const walkProg = Math.max(0.0, Math.min(1.0, (pz - (-102.0)) / (stopZ - (-102.0))));
      // 전반 등 뒤 로우 앵글 -> 후반 난간 측면 대각선 앵글로 영화적 카메라 스윕
      const desCamX = walkProg < 0.55 ? (7.8 - walkProg * 14.5) : (-6.2);
      const desCamY = START_ROOF.bh + 3.4 + walkProg * 0.8;
      const desCamZ = walkProg < 0.55 ? (pz - 10.2) : (pz - 4.2 + (walkProg - 0.55) * 4.5);
      openCamX += (desCamX - openCamX) * 3.2 * dt;
      openCamY += (desCamY - openCamY) * 3.5 * dt;
      openCamZ += (desCamZ - openCamZ) * 4.0 * dt;
      camYaw = 0.0;
      aimOpeningCam(px, START_ROOF.bh + 1.6 - walkProg * 1.4, pz + 4.5, 5.0);
      camRoll = 0.0;
      fovD += ((192.0 + walkProg * 14.0) - fovD) * 3.5 * dt;
    } else {
      // 난간 끝 0.32초 정지: 발밑 540m 구름 바다 심연을 내려다보는 숨 고르기
      openingEdgePause += dt;
      vx = 0.0; vy = 0.0; vz = 0.0;
      py = START_ROOF.bh + 2.1;
      openingPoseMode = 'IDLE';

      openCamX += (-3.4 - openCamX) * 3.8 * dt;
      openCamY += ((START_ROOF.bh + 5.2) - openCamY) * 3.5 * dt;
      openCamZ += ((START_ROOF_LEDGE_Z - 6.8) - openCamZ) * 3.8 * dt;
      aimOpeningCam(px, START_ROOF.bh - 6.0, START_ROOF_LEDGE_Z + 12.0, 5.5);
      fovD += (208.0 - fovD) * 3.5 * dt;

      if (openingEdgePause >= 0.32) {
        openingPhase = 'DROP_INTRO';
        openingTimer = 0.0;
        openingEdgePause = 0.0;
        openingPoseMode = 'SLIP';
        py = START_ROOF.bh + 1.0;
        pz = START_ROOF_LEDGE_Z + 0.2;
        vx = 0.0; vy = -2.0; vz = 9.0;
      }
    }
    openingCamBlend = 1.0;
    openingLetterbox = 1.0;
    return true;
  }

  if (openingPhase === 'DROP_INTRO') {
    const introDur      = openingRetryDrop ? 1.55 : 3.85;
    const lingerEnd     = openingRetryDrop ? 0.24 : 0.78;
    const chaseStart    = openingRetryDrop ? 0.30 : 1.00;
    const poseCutStart  = openingRetryDrop ? 0.72 : 2.15;
    const heroHoldStart = openingRetryDrop ? 0.96 : 2.63;
    const diveSnapStart = openingRetryDrop ? 1.22 : 3.25;
    const t = openingTimer;

    // 1) 캐릭터 5-Cut 낙하 물리 (슬로우 스르륵 -> 구름 돌파 급강하 -> 슬로우 공중 플립/히어로 포즈 -> 다이브 스냅)
    if (t < chaseStart) {
      openingPoseMode = 'SLIP';
      doingFlip = false;
      isDiving = false;
      const g = openingRetryDrop ? 56.0 : (16.0 + (t / Math.max(0.01, chaseStart)) * 32.0);
      vy -= g * dt;
      vz += ((openingRetryDrop ? 14.0 : 9.5) - vz) * 2.0 * dt;
    } else if (t < poseCutStart) {
      openingPoseMode = 'DIVE';
      doingFlip = false;
      isDiving = true;
      vy -= (openingRetryDrop ? 118.0 : 112.0) * dt;
      vz += ((openingRetryDrop ? 16.0 : 12.0) - vz) * 2.5 * dt;
    } else if (t < heroHoldStart) {
      // Cut 4 전반: 역방향 앵글 공중 1회전 플립 (미세 슬로우)
      openingPoseMode = 'FLIP';
      doingFlip = true;
      isDiving = false;
      flipAngle = ((t - poseCutStart) / Math.max(0.01, heroHoldStart - poseCutStart)) * Math.PI * 2;
      const targetVy = openingRetryDrop ? -64.0 : -58.0;
      vy += (targetVy - vy) * 5.0 * dt;
      vz += (14.0 - vz) * 2.5 * dt;
      afterimageTimer = 0.16;
    } else if (t < diveSnapStart) {
      // Cut 4 후반: 스파이더버스 오마주 DROP_HERO 포즈 홀드 (미세 슬로우)
      openingPoseMode = 'POSE';
      doingFlip = false;
      flipAngle = 0.0;
      isDiving = false;
      const targetVy = openingRetryDrop ? -54.0 : -46.0;
      vy += (targetVy - vy) * 6.0 * dt;
      vz += (14.5 - vz) * 2.5 * dt;
      afterimageTimer = 0.16;
    } else {
      // Cut 5: 다이브 스냅 & 3인칭 시점 복귀
      openingPoseMode = 'DIVE';
      doingFlip = false;
      flipAngle = 0.0;
      isDiving = true;
      vy -= (openingRetryDrop ? 86.0 : 78.0) * dt;
      vz += (22.0 - vz) * 4.5 * dt;
      diveCharge = Math.min(0.42, diveCharge + dt * 1.0);
    }

    px += vx * dt;
    py += vy * dt;
    pz += vz * dt;
    camYaw = 0.0;

    // 2) 멀티-컷 영화 카메라 워크
    if (t < chaseStart) {
      // Cut 2: 카메라는 난간 위에 머물러 스파이더맨이 구름 속 심연으로 작아지며 떨어지는 모습 추적
      openingCloudRush = 0.0;
      openingPoseRadial = 0.0;
      if (t < lingerEnd) {
        const ledgeY = openingRetryDrop ? 390.5 : (START_ROOF.bh + 5.0);
        openCamX += (-2.8 - openCamX) * 1.6 * dt;
        openCamY += (ledgeY - openCamY) * 1.2 * dt;
        openCamZ += ((START_ROOF_LEDGE_Z - 4.5) - openCamZ) * 1.4 * dt;
      } else {
        // 추격 직전 난간 너머로 서서히 몸을 기울이며 낙하 개시
        const tipRate = 1.6 + ((t - lingerEnd) / Math.max(0.01, chaseStart - lingerEnd)) * 2.4;
        openCamX += (0.0 - openCamX) * tipRate * dt;
        openCamY += ((py + 14.0) - openCamY) * tipRate * dt;
        openCamZ += ((pz - 10.0) - openCamZ) * tipRate * dt;
      }
      aimOpeningCam(px, py, pz, 7.5);
      camRoll += (0.0 - camRoll) * 6.0 * dt;
      fovD += (212.0 - fovD) * 4.0 * dt;
      openingCamBlend = 1.0;
      openingLetterbox = 1.0;
    } else if (t < poseCutStart) {
      // Cut 3: 뒤늦게 난간을 박차고 초고속 수직 급추격 + 495m->330m 구름층 돌파 연출!
      const cProg = Math.max(0.0, Math.min(1.0, (t - chaseStart) / Math.max(0.01, poseCutStart - chaseStart)));
      const chaseRate = 3.2 + cProg * cProg * 12.5;
      openCamX += (px - openCamX) * Math.min(1.0, chaseRate * dt);
      openCamY += ((py + 6.5 - vy * 0.04) - openCamY) * Math.min(1.0, chaseRate * dt);
      openCamZ += ((pz - 14.5) - openCamZ) * Math.min(1.0, chaseRate * dt);
      aimOpeningCam(px, py - 2.0, pz + 3.0, 9.0);
      camRoll += (Math.sin(cProg * Math.PI) * 0.08 - camRoll) * 6.0 * dt;
      const targetFov = 198.0 - Math.sin(cProg * Math.PI * 0.85) * 70.0;
      fovD += (targetFov - fovD) * 7.5 * dt;
      // 구름층 통과 중(또는 추격 피크) 화면 좌우 구름 스프라이트 돌파 연출
      const inCloudBand = (py <= 495.0 && py >= 310.0) ? 1.0 : 0.45;
      openingCloudRush = Math.sin(cProg * Math.PI) * inCloudBand;
      openingPoseRadial = 0.0;
      openingCamBlend = 1.0;
      openingLetterbox = 1.0;
    } else if (t < diveSnapStart) {
      // Cut 4: 스파이더버스 역방향 올려다보는 공중 포즈 컷 (앞쪽 아래에서 하늘/구름 배경으로 올려다보기!)
      const pProg = Math.max(0.0, Math.min(1.0, (t - poseCutStart) / Math.max(0.01, diveSnapStart - poseCutStart)));
      const inHold = (t >= heroHoldStart);
      const desCamX = px + (3.3 - pProg * 1.1);
      const desCamY = py - (4.5 - pProg * 0.6);
      const desCamZ = pz + (7.4 - pProg * 1.1);
      if (prevT < poseCutStart) {
        // 매치 컷: 즉시 역방향 앵글로 스냅
        openCamX = desCamX; openCamY = desCamY; openCamZ = desCamZ;
        aimOpeningCam(px, py + 0.3, pz, 100.0);
        camRoll = -0.18;
        fovD = 202.0;
      } else {
        openCamX += (desCamX - openCamX) * 14.0 * dt;
        openCamY += (desCamY - openCamY) * 14.0 * dt;
        openCamZ += (desCamZ - openCamZ) * 14.0 * dt;
        aimOpeningCam(px, py + 0.3, pz, 14.0);
        camRoll += ((inHold ? -0.22 : -0.14) - camRoll) * 7.0 * dt;
        fovD += ((inHold ? 214.0 : 196.0) - fovD) * 6.0 * dt;
      }
      openingCloudRush = 0.0;
      openingPoseRadial = inHold ? 1.0 : 0.35;
      openingCamBlend = 1.0;
      openingLetterbox = 1.0;
    } else {
      // Cut 5: 매치 컷으로 등 뒤 3인칭 시점 복귀 + 다이브 스냅 + 레터박스 해제
      const dProg = Math.max(0.0, Math.min(1.0, (t - diveSnapStart) / Math.max(0.01, introDur - diveSnapStart)));
      const desCamX = px;
      const desCamY = py + 3.8 - vy * 0.032;
      const desCamZ = pz - 16.5;
      if (prevT < diveSnapStart) {
        openCamX = desCamX; openCamY = desCamY + 2.5; openCamZ = desCamZ - 2.0;
        camLagYaw = 0.0;
        camPitch = -0.58;
        camRoll = 0.12;
        fovD = 148.0;
      } else {
        openCamX += (desCamX - openCamX) * 10.0 * dt;
        openCamY += (desCamY - openCamY) * 10.0 * dt;
        openCamZ += (desCamZ - openCamZ) * 10.0 * dt;
        camLagYaw = 0.0;
        camPitch += (-0.54 - camPitch) * 8.0 * dt;
        camRoll += (0.0 - camRoll) * 9.0 * dt;
        fovD += (160.0 - fovD) * 7.0 * dt;
      }
      openingCloudRush = 0.0;
      openingPoseRadial = 0.0;
      openingLetterbox = 1.0 - dProg;
      openingCamBlend = 1.0 - dProg;
      camDist = 16.5;
    }

    if (afterimageTimer > 0) {
      afterimageTimer -= dt;
      afterimageSampleAcc += dt;
      if (afterimageSampleAcc >= 0.04) {
        afterimageSampleAcc = 0;
        afterimages.push({
          x: px, y: py, z: pz,
          poseKey: openingPoseMode === 'POSE' ? 'DROP_HERO' : 'FLIP',
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

    if (t >= introDur) {
      openingPhase = 'DROP_CATCH';
      openingTimer = 0.0;
      openingCamBlend = 0.0;
      openingLetterbox = 0.0;
      openingCloudRush = 0.0;
      openingPoseRadial = 0.0;
      doingFlip = false;
      flipAngle = 0.0;
      isDiving = true;
      swingHeld = false;
      openingPoseMode = 'NONE';
      camDist = 16.5;
      camLagYaw = 0.0;
      camYaw = 0.0;
      camRoll = 0.0;
    }
    return true;
  }

  return false;
}

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

  if (!isFrozen && updateOpeningCutscene(dt)) {
    // 컷신(ROOF_WAIT / ROOF_WALK / DROP_INTRO) 중에는 본 게임 물리·전투·타이머 스킵
  } else if (!isFrozen) {
    const aug = getAugStats();
    simTime += dt;
    if (openingPhase === 'DROP_CATCH') {
      openingTimer += dt;
    }

    if (openingPhase === 'ACTIVE' && runTimeRemaining > 0) {
      runTimeRemaining = Math.max(0.0, runTimeRemaining - dt);
      if (runTimeRemaining <= 0 && !runTimerZeroTriggered) {
        onRunTimerZero();
      }
    }

    if (wallSlideCooldown > 0) wallSlideCooldown -= dt;
    if (strikeCooldown > 0) strikeCooldown -= dt;
    if (strikeGraceTimer > 0) strikeGraceTimer = Math.max(0, strikeGraceTimer - dt);
    if (skimTechTimer > 0) skimTechTimer = Math.max(0, skimTechTimer - dt);
    if (invulnTimer > 0) invulnTimer = Math.max(0, invulnTimer - dt);
    if (damageFlash > 0) damageFlash = Math.max(0, damageFlash - dt);
    if (shakeMag > 0) shakeMag = Math.max(0, shakeMag - 12.0 * dt);
    if (stylePopTimer > 0) stylePopTimer = Math.max(0, stylePopTimer - dt);
    if (stylePulseTimer > 0) stylePulseTimer = Math.max(0, stylePulseTimer - dt);
    if (perfectBuffTimer > 0) perfectBuffTimer = Math.max(0, perfectBuffTimer - dt);
    if (elasticCritTimer > 0) elasticCritTimer = Math.max(0, elasticCritTimer - dt);
    if (strikeRushTimer > 0) {
      strikeRushTimer = Math.max(0, strikeRushTimer - dt);
      if (strikeRushTimer <= 0) strikeRushStack = 0;
    }
    if (swingReattachCooldown > 0) swingReattachCooldown = Math.max(0, swingReattachCooldown - dt);
    if (swingWebShootTimer > 0) swingWebShootTimer = Math.max(0, swingWebShootTimer - dt);
    if (perfectGraceTimer > 0) perfectGraceTimer = Math.max(0, perfectGraceTimer - dt);
    if (getLv('overdrive') >= 3 && Math.hypot(vx, vy, vz) >= 115.0 && strikeCooldown > 0) {
      strikeCooldown = 0;
    }

    const airSpecTick = getAirHeatSpec();
    const fallSpecTick = getFallMomSpec();
    const fallDecay = fallSpecTick ? fallSpecTick.decayRate : 45.0;
    if (py > 4.0) {
      const airMax = airSpecTick ? airSpecTick.maxSec : 6.0;
      airTimeStack = Math.min(airMax, airTimeStack + dt);
      if (vy >= -10.0 && peakFallSpeed > 0) {
        peakFallSpeed = Math.max(0.0, peakFallSpeed - fallDecay * 0.35 * dt);
      }
    } else {
      peakFallSpeed = Math.max(0.0, peakFallSpeed - fallDecay * dt);
    }
    if (vy < -15.0) {
      peakFallSpeed = Math.max(peakFallSpeed, -vy);
    }

    if (openingPhase === 'ACTIVE') {
      if (comboTimer > 0) {
        comboTimer = Math.max(0.0, comboTimer - dt);
      } else if (!isSwinging && strikeMode === 0) {
        if (stylePoints > 0) {
          stylePoints = Math.max(0.0, stylePoints - 14.0 * dt);
          syncStageFromStyleRank(false);
          if (stylePoints <= 0) swingCombo = 0;
        } else if (swingCombo > 0) {
          swingCombo = 0;
        }
      }
    }

    if (autoCatchAfterJump && swingHeld && !isSwinging && py > 13.5) {
      if (startWebSwing(nearbyBuildings, nearbyClouds, true)) autoCatchAfterJump = false;
    } else if (swingHeld && !isSwinging && !autoCatchAfterJump && strikeMode === 0 && py > 4.0 && swingReattachCooldown <= 0) {
      startWebSwing(nearbyBuildings, nearbyClouds, false);
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

      // 현재 시점 기준 앵커의 좌/우 위치 실시간 갱신 (모서리 연속 회전 시에도 정확한 방향 판정)
      const relAnchorX = (ax - px) * cosY - (az - pz) * sinY;
      const currentAnchorSide = relAnchorX >= 0 ? 1 : -1;
      anchorSide = currentAnchorSide;

      // 1) 좌우 조향: 수평 속도 벡터 직접 선회(Yaw Carving) + 횡추력 병행 (슬랙 포함 전 구간 즉시 반응)
      if (Math.abs(turnInput) > 0.01) {
        const carveAng = turnInput * 1.35 * aug.turnMult * dt;
        const cA = Math.cos(carveAng), sA = Math.sin(carveAng);
        const rVx = vx * cA + vz * sA;
        const rVz = -vx * sA + vz * cA;
        vx = rVx;
        vz = rVz;

        vx += rightX * (turnInput * 56.0 * aug.turnMult) * dt;
        vz += rightZ * (turnInput * 56.0 * aug.turnMult) * dt;
      }

      const maxSwingSpd = (BASE_SWING_MAX_SPD + (perfectBuffTimer > 0 ? 12.0 : 0.0)) * aug.maxSpeedMult;

      // 2) 아날로그 3구간 매핑 (조이스틱 전진 기본 자세 + 모서리 회전 + 벽 회피 양립)
      const isEvadingOutward = (turnInput * currentAnchorSide) < -0.25;
      if (forwardInput > 0.15) {
        // 접선(진행) 방향 추진 펌핑 (전진 크루즈 및 모서리 회전 시 속도 유지)
        if (Math.hypot(vx, vy, vz) < maxSwingSpd) {
          vx += sinY * forwardInput * (22.0 * aug.swingPushMult) * dt;
          vz += cosY * forwardInput * (22.0 * aug.swingPushMult) * dt;
        }
        // 정면 풀 푸시(>0.65) & 좌우 꺾기 적음(|turn|<0.35)일 때만 연속 비례 줄 당기기 (최소 46m 하한으로 벽 빨림 차단)
        if (forwardInput > 0.65 && Math.abs(turnInput) < 0.35 && ropeLen > 46.0) {
          const reelIntensity = Math.min(1.0, (forwardInput - 0.65) / 0.35);
          ropeLen = Math.max(46.0, ropeLen - 20.0 * reelIntensity * dt);
        }
      } else if (forwardInput < -0.30) {
        // 의도적 후진(S): 연속 비례 줄 풀기 (깊은 저공 스윙 / 넓은 회전 반경)
        const payOutIntensity = Math.min(1.0, (-forwardInput - 0.30) / 0.70);
        ropeLen = Math.min(ay - SAFE_SKIM_Y, ropeLen + 28.0 * payOutIntensity * dt);
      }

      // 앵커 반대쪽 강선회(건물 회피): 바깥쪽으로만 줄 여유 부드럽게 완화 (모서리 회전 시에는 반경 고정)
      if (isEvadingOutward) {
        const evadeMaxLen = Math.min(230.0, Math.max(ropeLen, ay - SAFE_SKIM_Y));
        ropeLen = Math.min(evadeMaxLen, ropeLen + 22.0 * Math.abs(turnInput) * dt);
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
      isRopeTaut = curDist >= ropeLen - 1.5;

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

        const vacDrag = getVacuumDragFactor();
        const speedAfter = Math.hypot(vx, vy, vz);
        if (speedAfter > 4.0) {
          let targetSpd = speedAfter;
          if (speedBefore > speedAfter) {
            // 직전 속력을 하드캡 없이 접선 방향으로 98.5% 보존
            targetSpd = speedAfter + (speedBefore - speedAfter) * 0.985;
          }
          // 기본 순항 상한(maxSwingSpd) 초과 고속 구간은 공력 감쇠로 자연 수렴 (진공 활공 Lv.1 50%, Lv.2~3 0%)
          if (targetSpd > maxSwingSpd && vacDrag > 0) {
            targetSpd -= (targetSpd - maxSwingSpd) * Math.min(1.0, 1.35 * vacDrag * dt);
          }
          const sc = targetSpd / speedAfter;
          vx *= sc; vy *= sc; vz *= sc;
        } else {
          vx += sinY * (14.0 * aug.swingPushMult) * dt;
          vz += cosY * (14.0 * aug.swingPushMult) * dt;
        }

        const anchorLocalZ = (ax - px) * sinY + (az - pz) * cosY;
        if (anchorLocalZ < 6.0 && swingTimer > 0.14) passedBottom = true;

        const fwdPast = -anchorLocalZ;
        const arcProgress = fwdPast / Math.max(30.0, ropeLen);
        const prevPerfect = inPerfectWindow;
        const perfGraceBase = getLv('bungee_web') >= 2 ? 0.15 : 0.09;
        inPerfectWindow = passedBottom && arcProgress >= 0.34 && arcProgress <= 0.88 && vy > 14.0;
        if (inPerfectWindow || prevPerfect) {
          perfectGraceTimer = perfGraceBase;
        }

        if (py < 24.0 && py > 4.5) {
          const skimBoost = (1.0 - (py - 4.5) / 19.5) * 24.0 * aug.swingPushMult;
          const hNow = Math.hypot(vx, vz);
          if (hNow > 1.0 && hNow < (maxSwingSpd + 6.0)) {
            vx += (vx / hNow) * skimBoost * dt;
            vz += (vz / hNow) * skimBoost * dt;
          }
        }
      } else {
        const perfGraceBase = getLv('bungee_web') >= 2 ? 0.15 : 0.09;
        if (inPerfectWindow) perfectGraceTimer = Math.max(perfectGraceTimer, perfGraceBase);
        inPerfectWindow = false;
      }

      // 슬랙/장력 무관하게 카메라가 속도 방향을 기민하게 추종 (자동 해제 없음: 모서리 연속 회전 지원)
      const curHSpd = Math.hypot(vx, vz);
      if (curHSpd > 8.0) {
        const velYaw = Math.atan2(vx, vz);
        let yawDiff = (velYaw - camYaw + Math.PI) % (2 * Math.PI) - Math.PI;
        if (yawDiff < -Math.PI) yawDiff += 2 * Math.PI;
        camYaw += yawDiff * 8.5 * dt;
      }
    } else {
      inPerfectWindow = false;

      const effGrav = BASE_GRAVITY * aug.gravityMult;
      const fallT = vy < -4.0 ? Math.min(1.0, (-vy - 4.0) / 70.0) : 0.0;
      const fallGravMult = 1.40 + 0.35 * fallT;

      if (openingPhase === 'DROP_CATCH') {
        // 자유낙하 캐치 구간: 글라이드 꼼수 차단, 다이브 낙하 유지 + 약 1.8초의 스윙 캐치 타이밍 창 제공
        isGliding = false;
        isDiving = true;
        vy -= (effGrav * 0.92 + Math.max(0.0, forwardInput) * 24.0) * dt;
        diveCharge = Math.min(0.65, diveCharge + 0.35 * dt);
      } else if (py > 6.5 && forwardInput < -0.25) {
        isGliding = true;
        isDiving = false;
        diveCharge = Math.max(0.0, diveCharge - 0.35 * dt);
        vy -= (effGrav * 0.16) * dt;
        if (vy < -9.0) vy += (-9.0 - vy) * 9.0 * dt;
      } else if (py > 8.0 && vy < -4.0 && forwardInput > 0.25) {
        isGliding = false;
        isDiving = true;
        vy -= (effGrav * fallGravMult + 42.0 * forwardInput) * dt;
        diveCharge = Math.min(1.0, diveCharge + 0.85 * forwardInput * dt);
      } else {
        isGliding = false;
        isDiving = false;
        diveCharge = Math.max(0.0, diveCharge - 0.28 * dt);
        if (vy < -4.0) {
          vy -= (effGrav * fallGravMult) * dt;
        } else if (py > 45.0 && vy <= 8.0) {
          vy -= (effGrav * 0.52) * dt;
        } else {
          vy -= effGrav * dt;
        }
      }

      if (doingFlip) {
        flipAngle += 7.5 * dt;
        if (flipAngle >= Math.PI * 2) { flipAngle = 0.0; doingFlip = false; }
      }

      const lvVac = getLv('vacuum');
      const vacDrag = getVacuumDragFactor();
      const maxFreeSpd = BASE_FREE_MAX_SPD * aug.maxSpeedMult;
      const maxSwingSpd = (BASE_SWING_MAX_SPD + (perfectBuffTimer > 0 ? 12.0 : 0.0)) * aug.maxSpeedMult;
      let curHSpd = Math.hypot(vx, vz);

      if (forwardInput > 0) {
        if (curHSpd < maxFreeSpd) {
          curHSpd = Math.min(maxFreeSpd, curHSpd + 24.0 * aug.swingPushMult * forwardInput * dt);
        } else if (vacDrag > 0) {
          curHSpd = Math.max(maxFreeSpd, curHSpd * (1.0 - BASE_AIR_DRAG * vacDrag * dt));
        }
      } else if (forwardInput < 0 && !isGliding && vacDrag > 0) {
        curHSpd = Math.max(0.0, curHSpd + 42.0 * vacDrag * forwardInput * dt);
      } else if (isGliding) {
        curHSpd = vacDrag <= 0 ? Math.max(22.0, curHSpd) : Math.max(22.0, curHSpd * (1.0 - 0.14 * vacDrag * dt));
      } else if (vacDrag > 0) {
        curHSpd = Math.max(0.0, curHSpd * (1.0 - BASE_AIR_DRAG * vacDrag * dt));
      }

      if (vacDrag > 0 && curHSpd > maxSwingSpd) {
        curHSpd -= (curHSpd - maxSwingSpd) * Math.min(1.0, 1.15 * vacDrag * dt);
      }
      // [진공 활공 Lv.3 각성]: 고속(70+) 비행 중 초당 +8 자동 가속!
      if (lvVac >= 3 && curHSpd >= 70.0 && curHSpd < maxSwingSpd * 1.18) {
        curHSpd = Math.min(maxSwingSpd * 1.18, curHSpd + 8.0 * dt);
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
      strikeRushStack = 0;
      strikeRushTimer = 0.0;

      if (openingPhase === 'DROP_CATCH') {
        // 마지막까지 첫 스윙을 걸지 못하고 지면 충돌 시 즉시 게임 오버
        clearStrikeState();
        isSwinging = false;
        inPerfectWindow = false;
        perfectGraceTimer = 0;
        isRopeTaut = false;
        vx = 0.0; vy = 0.0; vz = 0.0;
        hp = 0;
        damageFlash = 0.65;
        shakeMag = 5.5;
        gameOver = true;
        gameOverReason = 'MISSED THE SWING!';
        spawnSparks(px, 2.0, pz, PAL.CRIMSON, 18, 42);
        addPopup('MISSED THE SWING!', PAL.CRIMSON, 2);
      } else if (strikeMode === 1) {
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
        releaseLassoTargets('GROUNDED!');
        if (isSwinging) {
          vx *= 0.42; vz *= 0.42; vy = 0.0;
          isSwinging = false;
          inPerfectWindow = false;
          perfectGraceTimer = 0;
          isRopeTaut = false;
          swingReattachCooldown = 0.18;
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
    if (openingPhase === 'ACTIVE') {
      updateCombat(dt, oldPx, oldPy, oldPz, nearbyBuildings, totalSpeed);
    }

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

    // Non-linear Wall Skim & Ground Skim Style Gauge (+ 마찰 과열 연동)
    const fricSpecTick = getFricHeatSpec();
    const maxSkimSpd = (BASE_SWING_MAX_SPD + 10.0) * aug.maxSpeedMult;
    let isSkimmingNow = false;

    if (minWallDist < 14.5 && totalSpeed > 26.0 && py > 4.0) {
      isSkimmingNow = true;
      skimTechTimer = 2.2;
      const wNorm = Math.max(0, 1.0 - minWallDist / 14.5);
      wallSkimIntensity += (wNorm - wallSkimIntensity) * 12.0 * dt;
      wallSkimSide = nearestSide;

      if (horizSpeed < maxSkimSpd && horizSpeed > 1.0) {
        let wBoost = isSwinging ? (16.0 + wNorm * 28.0) * dt : 0;
        if (fricSpecTick) {
          wBoost += horizSpeed * fricSpecTick.boostRate * dt;
          frictionCharge = Math.min(1.5, frictionCharge + dt * fricSpecTick.chargeRate);
        }
        if (wBoost > 0) {
          vx += (vx / horizSpeed) * wBoost;
          vz += (vz / horizSpeed) * wBoost;
        }
      }

      addStylePoints((6.0 + wNorm * 8.0) * dt, 3.0);

      if (wNorm > 0.65 && Math.random() < 0.45) {
        const rightX = Math.cos(camYaw), rightZ = -Math.sin(camYaw);
        spawnSparks(px + rightX * nearestSide * 1.8, py, pz + rightZ * nearestSide * 1.8, fricSpecTick ? PAL.CRIMSON : '#b8e4ff', 1, 14);
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

      if (fricSpecTick && horizSpeed < maxSkimSpd && horizSpeed > 1.0) {
        const fBoost = horizSpeed * fricSpecTick.boostRate * dt;
        vx += (vx / horizSpeed) * fBoost;
        vz += (vz / horizSpeed) * fBoost;
        frictionCharge = Math.min(1.5, frictionCharge + dt * fricSpecTick.chargeRate);
      }

      addStylePoints((6.0 + gNorm * 8.0) * dt, 3.0);

      if (wallSkimIntensity > 0.35 && gNorm > 0.45) {
        addStylePoints(8.0 * dt, 3.0);
        addPopup('CANYON RUSH!!', PAL.GOLD, 2);
      } else if (gNorm > 0.65) {
        addPopup('DANGER GROUND SKIM!', PAL.GOLD, 1);
      }
    } else {
      groundSkimIntensity *= Math.max(0, 1.0 - 8.0 * dt);
    }

    // [마찰 과열 Lv.3 각성]: 과열 70%+(1.05+) 스침 중 주변 적 지속 화염 틱 피해
    if (fricSpecTick && fricSpecTick.fireTick && isSkimmingNow && frictionCharge >= 1.05) {
      fricFireTickTimer -= dt;
      if (fricFireTickTimer <= 0) {
        fricFireTickTimer = 0.24;
        const fireHits = [];
        for (let i = 0; i < enemies.length; i++) {
          const e = enemies[i];
          if (Math.hypot(e.x - px, e.y - py, e.z - pz) <= 48.0 + e.radius) {
            fireHits.push(e);
          }
        }
        if (fireHits.length > 0) {
          shockwaves.push({ x: px, y: py, z: pz, r: 5, maxR: 48.0, life: 0.22, maxLife: 0.22, col: PAL.CRIMSON });
          for (let i = 0; i < fireHits.length; i++) {
            applyEnemyDamage(fireHits[i], 22, PAL.CRIMSON, false, 0, false);
          }
        }
      }
    }

    if (!isSkimmingNow && frictionCharge > 0) {
      frictionCharge = Math.max(0.0, frictionCharge - 0.18 * dt);
    }

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
      targetPitch = Math.max(-0.92, Math.min(0.55, Math.atan2(sDy, Math.hypot(sDx, sDz) || 1.0)));
    } else {
      const normAlt = Math.max(0.0, Math.min(1.0, (py - 14.0) / 360.0));
      const descentLook = (!isSwinging && vy < -10.0 && py > 24.0) ? Math.max(-0.50, vy * 0.0062) : (vy * 0.0014);
      const divePitchBias = isDiving ? -0.26 : (isGliding ? 0.05 : 0.0);
      // 저공 고속 주행(캐니언 스침/전방 돌파) 시 하늘 대신 도로 앞길과 저공 터렛이 정면에 들어오도록 수평 보정
      const lowSpeedLevel = (py < 30.0 && totalSpeed > 45.0) ? -0.11 : 0.0;
      targetPitch = Math.max(-0.96, Math.min(0.42, 0.14 - normAlt * 0.64 + descentLook + divePitchBias + lowSpeedLevel));
      // 고공 하강 중 발밑 SLAM 락온 표적이 있으면 시선을 부드럽게 표적 쪽으로 35% 기울여 가시성 확보
      if (homingTarget && !isSwinging && (isDiving || vy < -18.0) && homingTarget.y < py - 10.0) {
        const hDx = homingTarget.x - px, hDy = homingTarget.y - py, hDz = homingTarget.z - pz;
        const aimPitch = Math.max(-0.96, Math.min(0.15, Math.atan2(hDy, Math.hypot(hDx, hDz) || 1.0)));
        targetPitch = targetPitch * 0.65 + aimPitch * 0.35;
      }
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
  } else if (openingPhase === 'ROOF_WAIT') {
    btnSwing.classList.add('ready');
    swingBtnLabel.textContent = 'START';
    swingBtnSub.textContent = 'ANY BUTTON';
  } else if (openingPhase === 'ROOF_WALK' || openingPhase === 'DROP_INTRO') {
    swingBtnLabel.textContent = 'CUTSCENE';
    swingBtnSub.textContent = 'WAIT...';
  } else if (openingPhase === 'DROP_CATCH') {
    if (py <= 95.0) btnSwing.classList.add('perfect');
    else if (py <= 200.0) btnSwing.classList.add('ready');
    swingBtnLabel.textContent = py <= 95.0 ? 'NOW!!' : 'CATCH!';
    swingBtnSub.textContent = py <= 95.0 ? 'LAST CHANCE!' : 'PRESS SWING';
  } else if (isSwinging && (inPerfectWindow || perfectGraceTimer > 0)) {
    btnSwing.classList.add('perfect');
    swingBtnLabel.textContent = 'PERFECT!';
    swingBtnSub.textContent = 'RELEASE NOW!';
  } else if (isSwinging && passedBottom) {
    btnSwing.classList.add('ready');
    swingBtnLabel.textContent = 'RELEASE!';
    swingBtnSub.textContent = 'SLINGSHOT';
  } else if (isSwinging) {
    swingBtnLabel.textContent = 'SWINGING';
    swingBtnSub.textContent = 'A/D:TURN S:WIDE';
  } else {
    swingBtnLabel.textContent = py <= 4.0 ? 'JUMP+ZIP' : 'SWING';
    swingBtnSub.textContent = py <= 4.0 ? 'HOLD TO SOAR' : (isGliding ? 'GLIDING!' : 'HOLD / JUMP');
  }

  if (btnStrike) {
    const previewCase = strikeMode !== 0 ? strikeMode : classifyStrikeCase();
    const curSpdNow = Math.hypot(vx, vy, vz);
    const isInstantNow = (previewCase === 3 && curSpdNow >= STRIKE_NO_FREEZE_SPEED);
    const hasLock = (!!homingTarget || previewCase === 1) && !gameOver && !augmentDraftOpen && openingPhase === 'ACTIVE';
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
    } else if (openingPhase === 'ROOF_WAIT') {
      btnStrike.classList.add('locked');
      strikeBtnLabel.textContent = 'START';
      strikeBtnSub.textContent = 'ANY BUTTON';
    } else if (openingPhase === 'ROOF_WALK' || openingPhase === 'DROP_INTRO') {
      strikeBtnLabel.textContent = 'CUTSCENE';
      strikeBtnSub.textContent = 'LOCKED';
    } else if (openingPhase === 'DROP_CATCH') {
      strikeBtnLabel.textContent = 'STRIKE';
      strikeBtnSub.textContent = 'SWING FIRST';
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

  const handPos = (thirdPerson || openingCamBlend > 0.01)
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

  // [올가미 스윙] 포획된 적 연결 1px 초경량 벡터 선분 (4명+ 각성 시 황금색 강조)
  if (lassoTargets.length > 0 && handPos) {
    const lSpecDraw = getLassoSpec();
    const lassoAwaken = lSpecDraw && lassoTargets.length >= lSpecDraw.awakenCount;
    const lassoCol = lassoAwaken
      ? ((Math.floor(simTime * 22) & 1) ? PAL.GOLD : '#ffffff')
      : '#d8b4fe';
    ctx.lineWidth = 1;
    for (let i = 0; i < lassoTargets.length; i++) {
      const te = lassoTargets[i];
      const ep = projectWorldPt(te.x, te.y, te.z, cb);
      if (!ep) continue;
      ctx.strokeStyle = PAL.INDIGO_OUTLINE;
      ctx.beginPath(); ctx.moveTo(handPos.x | 0, (handPos.y + 1) | 0); ctx.lineTo(ep.x | 0, (ep.y + 1) | 0); ctx.stroke();
      ctx.strokeStyle = lassoCol;
      ctx.beginPath(); ctx.moveTo(handPos.x | 0, handPos.y | 0); ctx.lineTo(ep.x | 0, ep.y | 0); ctx.stroke();
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

  if (isDiving || (openingPhase === 'DROP_INTRO' && openingTimer > (openingRetryDrop ? 0.30 : 1.00) && openingPoseRadial <= 0.04)) {
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
  if ((totalSpeed > 82 && !isOpeningCutscene()) || (strikeMode !== 0 && strikePhase === 'RUSH') || groundSkimIntensity > 0.4) {
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

  const lbBlend = Math.max(strikeCamBlend, openingLetterbox);
  if (lbBlend > 0.04) {
    const barH = Math.round(lbBlend * (openingLetterbox > strikeCamBlend ? 14 : 11));
    ctx.fillStyle = PAL.INDIGO_OUTLINE;
    ctx.fillRect(0, 0, LCD_W, barH);
    ctx.fillRect(0, LCD_H - barH, LCD_W, barH);
  }

  if (damageFlash > 0) {
    ctx.strokeStyle = 'rgba(232, 40, 72, ' + Math.min(0.85, damageFlash * 2.4).toFixed(2) + ')';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, LCD_W - 6, LCD_H - 6);
  }

  if (!augmentDraftOpen && !gameOver && openingPhase === 'ACTIVE') {
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

  if (!isOpeningCutscene()) {
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

  const joyZone = document.getElementById('joy-zone') || joyBase;
  let joyPointerId = null;
  let joyOriginX = 0;
  let joyOriginY = 0;
  let joyMaxRadius = 40;
  const JOY_MAX_ORIGIN_SHIFT = 18;

  function updateJoy(e) {
    let dx = e.clientX - joyOriginX;
    let dy = e.clientY - joyOriginY;
    const dist = Math.hypot(dx, dy);
    if (dist > joyMaxRadius) {
      dx = (dx / dist) * joyMaxRadius;
      dy = (dy / dist) * joyMaxRadius;
    }
    joyKnob.style.transform = 'translate3d(' + dx + 'px, ' + dy + 'px, 0)';
    const nx = dx / joyMaxRadius;
    const ny = -dy / joyMaxRadius;
    joyX = Math.abs(nx) < 0.12 ? 0.0 : nx;
    joyY = Math.abs(ny) < 0.12 ? 0.0 : ny;
  }

  function clearJoy() {
    joyPointerId = null;
    joyX = 0.0; joyY = 0.0;
    joyKnob.style.transform = 'translate3d(0px, 0px, 0)';
    joyBase.style.transform = 'translate3d(0px, 0px, 0)';
    joyKnob.classList.remove('active');
    joyBase.classList.remove('active');
  }

  joyZone.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (handleOpeningAnyInput()) return;
    if (joyPointerId !== null) return;
    joyPointerId = e.pointerId;
    joyZone.setPointerCapture(e.pointerId);
    // Reset transform before measuring so rapid re-taps never drift the resting center
    joyBase.classList.add('active');
    joyBase.style.transform = 'translate3d(0px, 0px, 0)';
    const rect = joyBase.getBoundingClientRect();
    const restCx = rect.left + rect.width * 0.5;
    const restCy = rect.top + rect.height * 0.5;
    joyMaxRadius = Math.min(42, Math.max(32, rect.width * 0.34));

    let shiftX = e.clientX - restCx;
    let shiftY = e.clientY - restCy;
    const shiftDist = Math.hypot(shiftX, shiftY);
    if (shiftDist > JOY_MAX_ORIGIN_SHIFT) {
      shiftX = (shiftX / shiftDist) * JOY_MAX_ORIGIN_SHIFT;
      shiftY = (shiftY / shiftDist) * JOY_MAX_ORIGIN_SHIFT;
    }
    joyOriginX = restCx + shiftX;
    joyOriginY = restCy + shiftY;
    joyBase.style.transform = 'translate3d(' + shiftX + 'px, ' + shiftY + 'px, 0)';
    joyKnob.classList.add('active');
    updateJoy(e);
  });
  joyZone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== joyPointerId) return;
    e.preventDefault();
    updateJoy(e);
  });
  joyZone.addEventListener('pointerup', (e) => { if (e.pointerId === joyPointerId) clearJoy(); });
  joyZone.addEventListener('pointercancel', (e) => { if (e.pointerId === joyPointerId) clearJoy(); });

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
    if (handleOpeningAnyInput()) return;
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
      if (openingPhase === 'ROOF_WAIT') {
        const isSysKey = ['Tab', 'Escape', 'MetaLeft', 'MetaRight', 'AltLeft', 'AltRight', 'ControlLeft', 'ControlRight'].includes(e.code) || /^F\d+$/.test(e.code);
        if (!isSysKey && handleOpeningAnyInput()) return;
      }
      if (e.code === 'Space') onSwingDown();
      else if (e.code === 'KeyE' || e.code === 'KeyF' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') onStrikePress();
      else if (e.code === 'KeyV') toggleCam();
      else if (e.code === 'KeyH') toggleShadows();
      else if (e.code === 'KeyL') toggleScanline();
      else if (e.code === 'KeyR') resetGame();
      else if (e.code === 'KeyB' && openingPhase === 'ACTIVE' && !bossActive && !gameOver) {
        runTimeRemaining = 3.0;
        addPopup('DEBUG: BOSS IN 3s!', PAL.GOLD, 2);
      }
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

    bakeAllStagePatterns();
    for (let s = 0; s < STAGE_CONFIGS.length; s++) {
      cloud2Sprites.push(bakeCloud2Sprite(STAGE_CONFIGS[s].cloudCols));
      panoramaCanvases.push(bakePanoramaStrip(s));
    }
    bakeAllSpideySprites();
    bakePropSprites();
    bakeStyleRankSprites();

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