'use strict';
// Spider 3D — Global Constants, Game State, FX Helpers & Style Rank


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
let strikeGraceTimer = 0; // 공격 직후 반동/관통 이탈 중 몸체 충돌 방지 짧은 유예 시간 (0.20s)
const STRIKE_TUMBLE_DUR = 1.35; // 타격 후 공중 2회전 텀블링 리커버리 시간 (STRIKE 불가, 이동·스윙 가능)
let strikeTumbleTimer = 0;
let strikeTumbleDur = STRIKE_TUMBLE_DUR;
const JUST_CHAIN_MIN = 0.20;
const JUST_CHAIN_MAX = 0.46;
const JUST_CHAIN_WINDOW_END = 0.56;
let justChainElapsed = -1.0;    // >= 0: 연속 돌격 저스트 리듬 창 경과 시간
let justChainLastTarget = null; // 직전 타격 표적 (타겟 전환 +15% / 동일 표적 -25% 판정)
let justChainTargetMult = 1.0;  // 현재 STRIKE에 적용되는 타겟 전환/동일 보정 배율
let justChainParryTimer = 0.0;  // JUST CHAIN 성공 시 짧은 투사체 패링 유예 (0.18s)
let justChainFlashTimer = 0.0;  // JUST CHAIN 성공 HUD 링 플래시 타이머
let strikeIsJustChain = false;  // 현재 STRIKE가 저스트 리듬 체인으로 발동됐는지 여부
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

// Step 2: 5-Cut 건물 관통 0% 영화적 오프닝 상태 머신
// openingPhase: 'ROOF_WAIT' | 'ROOF_WALK' | 'DROP_INTRO' | 'DROP_CATCH' | 'ACTIVE'
const START_ROOF = { bx: 0.0, bz: -100.0, bw: 18.0, bd: 18.0, bh: 510.0 };
const START_ROOF_LEDGE_Z = START_ROOF.bz + START_ROOF.bd * 0.5;
let hasSeenRoofIntro = false;
let openingPhase = 'ROOF_WAIT';
let openingTimer = 0.0;
let openingEdgePause = 0.0;
let openingRetryDrop = false;
let openingLetterbox = 1.0;
let openingCamBlend = 1.0;
let openCamX = 3.8, openCamY = 513.6, openCamZ = -113.0;
let openingPoseMode = 'IDLE';
let openingCloudRush = 0.0;
let openingPoseRadial = 0.0;
let gameOverReason = '';

// Step 4: 플레이 방식 변혁 6종 증강 Lv.3(★각성) 5.0초 4-Act 불릿타임 3D 컷씬 상태
const APEX_ACT1_DUR   = 0.90;   // Act 1 (0.00~0.90s): [기] 0% 시간정지 · 초근접 망원 포즈 컷인 (탄성 반발은 1차 충돌 직후 즉시 빠른 공중 튕김)
const APEX_ACT2_DUR   = 2.35;   // Act 2 (0.90~2.35s): [승] 0% 시간정지 · 매치 컷 줌아웃 95°~115° 3D 오빗 (총 2.35s 정지)
const APEX_ACT3_DUR   = 3.85;   // Act 3 (2.35~3.85s): [전] 0.10x 극저속 슬로우 · 대조 매치 컷 앵글 + 2단계 물리 클라이맥스
const APEX_TOTAL_DUR  = 5.00;   // Act 4 (3.85~5.00s): [결] 100% 원속 해방 + 드라이브바이 지연 추격 + 광각 스냅백
const APEX_ACT3_SCALE = 0.10;   // Act 3 월드 극저속 슬로우 배율
let btnApexTest = null;
let btnSound = null;
let apexActive = false;
let apexId = '';
let apexTimer = 0.0;
let apexLetterbox = 0.0;
let apexCamBlend = 0.0;
let apexCamX = 0.0, apexCamY = 0.0, apexCamZ = 0.0;
let apexAnchorX = 0.0, apexAnchorY = 0.0, apexAnchorZ = 0.0;
let apexStartAng = 0.0;
let apexOrbitArc = 1.80;
let apexOrbitRadius = 20.0;
let apexOrbitRadiusEnd = 15.0;
let apexStartElev = 0.0;
let apexEndElev = 0.0;
let apexTargetRoll = 0.16;
let apexFreezeFov = 192.0;
let apexReleaseFov = 108.0;
let apexAct1Cam = null;         // Act 1 초근접 포즈 컷인 (또는 탄성 반발 즉시 튕김) 카메라 궤도
let apexAct3Cam = null;         // Act 3 대조 매치 컷 클라이맥스 카메라 궤도
let apexAct2Started = false;
let apexAct3Started = false;
let apexAct4Started = false;
let apexFlashTimer = 0.0;       // 2프레임 고대비 임팩트 스냅
let apexHoldCamX = 0.0, apexHoldCamY = 0.0, apexHoldCamZ = 0.0;
let apexIsTest = false;
let apexTestLabel = '';
let apexSceneExtras = null;
let apexPlayerDrawOff = { x: 0.0, y: 0.0, z: 0.0 }; // 탄성 반발 공중 튕김/수축 전용 시각 오프셋 (실제 물리 좌표 불변)
let lastElasticWallPt = null;   // 최근 벽 반사 3D 좌표 { x, y, z, nx, nz }
let lastBungeeAnchorPt = null;  // 최근 고탄성 번지 대아크 앵커 3D 좌표
let bungeeApexTimer = 0.0;      // 번지 대아크 PERFECT 후 STRIKE 적중 트리거 유지 타이머 (3.4s)
let chainPathPts = [];          // 연쇄 핀볼 3D 경로 좌표 기록

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
      if (typeof playSfx === 'function') playSfx('rank_up');
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
  strikeIsJustChain = false;
  justChainTargetMult = 1.0;
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
  strikeTumbleTimer = 0;
  justChainElapsed = -1.0;
  justChainLastTarget = null;
  justChainParryTimer = 0.0;
  dropStyleRanks(2, reasonText + ' -' + amount + 'HP', PAL.CRIMSON);
  if (hp <= 0) {
    gameOver = true;
    isSwinging = false;
    inPerfectWindow = false;
    lassoTargets = [];
    if (typeof playSfx === 'function') playSfx('gameover');
  } else {
    if (typeof playSfx === 'function') playSfx('player_hit');
  }
}
