'use strict';

// =========================================================================
// 스파이더맨 PC-98 로그라이크 증강(카드) 시스템 — 4슬롯 · 13종 · Lv.1~3 각성판
// - 최대 보유 슬롯: 4슬롯 (4종 x Lv.3 = 12픽 완전체, 만충 시 보유 미완성 증강만 출현)
// - 13종 로스터 (물리 변조 3 / 핵심 기믹 4 / 규칙 역전 2 / 물리 변환 4)
//   * 삭제: 달의 인력, 고압 거미줄, 구름 앵커
//   * 신규: 올가미 스윙 (포획 배달 기폭), 연속 돌격 (수동 Shift + 핀볼 연타 증폭/속도보존)
//   * 리워크: 전격 오라 (고속 주행 특화), 체공 예열 (범위 삭제·단일 극딜), 진공 활공 (Lv.1~3 차등)
// - Lv.1(입문) -> Lv.2(강화) -> Lv.3(★각성) 단계별 동적 카드 설명 & 0.65초 오입력 방지
// =========================================================================

const MAX_AUG_LEVEL = 3;
const MAX_AUG_SLOTS = 4;

const AUGMENTS = [
  // ① 물리 변조 (3종 — 단점은 Lv.1 기준 고정, 장점·각성은 단계별 폭발)
  {
    id: 'heavy_suit', tag: '변조', name: '초중력 슈트', col: '#ff9436',
    levels: [
      ['중력 1.55x 고정', 'STRIKE +20%', 'SLAM 충격파 40m'],
      ['STRIKE +45%', 'SLAM 충격파 60m', '하강 화력 강화'],
      ['STRIKE +80%', 'SLAM 충격파 85m', '★SLAM 탄막소거+치명']
    ]
  },
  {
    id: 'overdrive', tag: '변조', name: '오버드라이브', col: '#ff5cf4',
    levels: [
      ['최대속도 1.22x', '추진력 +15%', '선회 0.74x 고정'],
      ['최대속도 1.42x', '추진력 +32%', '고속 돌파 강화'],
      ['최대속도 1.65x', '추진력 +55%', '★115+ 쿨 초기화']
    ]
  },
  {
    id: 'bungee_web', tag: '변조', name: '고탄성 번지줄', col: '#ffe55c',
    levels: [
      ['상승반동 1.22x', '줄길이 +12% 고정', '고공 도약 입문'],
      ['상승반동 1.45x', '퍼펙트 유예+0.06s', '고공 아크 강화'],
      ['상승반동 1.72x', '★퍼펙트 추진+35%', '★플립 무적 0.4s']
    ]
  },

  // ② 핵심 기믹 (4종 — 발동 트리거가 서로 다른 핵심 플레이 엔진)
  {
    id: 'swing_aura', tag: '기믹', name: '전격 오라', col: '#54f8ff',
    levels: [
      ['속도 65+ 감전', '반경 42m 주행타격', '스웜 2배 즉사청소'],
      ['속도 58+ 반경 58m', '오라 내 탄막 소거', '킬 시 전방 +10가속'],
      ['속도 52+ 반경 75m', '★95+ 번개 2연쇄', '★노-STRIKE 폭주']
    ]
  },
  {
    id: 'lasso_swing', tag: '기믹', name: '올가미 스윙', col: '#a78bfa',
    levels: [
      ['스윙 중 4명 포획', '적당 중력 +8%↑', 'STRIKE 일괄기폭'],
      ['최대 6명/반경46m', '기폭 피해 대폭↑', '포획당 본타 +12%'],
      ['최대 8명/반경58m', '★4명+ 치명+1.5x폭발', '★기폭 후 안전도약']
    ]
  },
  {
    id: 'chain_pinball', tag: '기믹', name: '연쇄 핀볼', col: '#ff5cf4',
    levels: [
      ['적중시 자동 1연쇄', '탐색 반경 95m', '속도연동 연쇄 16x'],
      ['자동 3연쇄/120m', '속도연동 연쇄 22x', '체공 스택 유지'],
      ['자동 5연쇄/150m', '속도연동 연쇄 28x', '★종료후 쿨0+가속']
    ]
  },
  {
    id: 'domino_boom', tag: '기믹', name: '도미노 폭발', col: '#ff9436',
    levels: [
      ['처치시 42m 폭발', '피해 24 / 2연쇄', '스웜 편대 연쇄'],
      ['반경 60m 폭발', '피해 44 / 4연쇄', '광역 연쇄 폭파'],
      ['반경 80m / 6연쇄', '기본 피해 70', '★연쇄마다 +20%증폭']
    ]
  },

  // ③ 규칙 역전 (2종 — 물리 제약을 무기로 반전)
  {
    id: 'elastic', tag: '역전', name: '탄성 반발', col: '#4ade80',
    levels: [
      ['벽 반사 0.9x/1회', '충격파 44m (20)', '타격·퍼펙트 충전'],
      ['벽 반사 1.0x/2회', '충격파 58m (36)', '연속 벽튕김 방어'],
      ['벽 반사 1.15x/3회', '충격파 76m (56)', '★반사후 2.5s 치명']
    ]
  },
  {
    id: 'vacuum', tag: '역전', name: '진공 활공', col: '#54f8ff',
    levels: [
      ['공기저항 50% 감소', '고속 감쇠 절반화', '속도 유지 입문'],
      ['공기저항 0% 제거', '초과속 감쇠 제거', '공중 감속 불가'],
      ['공기저항 0% 유지', '★70+ 비행 자동가속', '★전격 오라 상시']
    ]
  },

  // ④ 물리 변환 (4종 — 서로 다른 물리/전투 변수를 화력으로 변환)
  {
    id: 'strike_rush', tag: '변환', name: '연속 돌격', col: '#38bdf8',
    levels: [
      ['2.8s 연타 +15%(4x)', '타격후 속도85%보존', '핀볼 연쇄도 누적'],
      ['연타당 +25% (6x)', '속도 95% 보존', '연타중 광각 락온'],
      ['연타당 +35% (8x)', '★속도 105% 가속', '★쿨 절반+4x 치명']
    ]
  },
  {
    id: 'fall_mom', tag: '변환', name: '낙하 운동량', col: '#ff9436',
    levels: [
      ['하강비례 최대+45%', '하강 80+ 치명타', '급강하 화력 변환'],
      ['하강비례 최대+85%', '하강기억 감쇠 절반', 'SLAM 원샷 특화'],
      ['하강비례 최대+140%', '★적중후 기억50%유지', '★60m 낙하 충격파']
    ]
  },
  {
    id: 'air_heat', tag: '변환', name: '체공 예열', col: '#ffe55c',
    levels: [
      ['체공 초당 +15%', '최대 4초(단일극딜)', '적중시 예열 소모'],
      ['체공 초당 +25%', '최대 5초 (+125%)', '엘리트 단일 폭딜'],
      ['체공 초당 +35%', '최대 6초 (+210%)', '★풀예열치명+50%유지']
    ]
  },
  {
    id: 'fric_heat', tag: '변환', name: '마찰 과열', col: '#e82848',
    levels: [
      ['스침 가속 +18%/s', '충격파 42m(0.55x)', '저공 근접 화력'],
      ['스침 가속 +32%/s', '과열 축적 +40%', '충격파 62m(0.75x)'],
      ['스침 가속 +50%/s', '충격파 84m(1.0x)', '★과열70%+ 화염틱']
    ]
  }
];

// =========================================================================
// 증강 보유 상태 및 실시간 물리·기믹 시너지 변수 (Invariants 유지)
// =========================================================================
let augLevels = {};          // 보유 중인 증강 레벨 (최대 MAX_AUG_SLOTS종)
let augmentDraftOpen = false;
let draftChoices = [];       // 현재 화면에 뜬 선택지 카드 최대 3장
let draftCursor = 1;         // 선택 포커스 인덱스 (0, 1, 2)
let draftJoyLock = false;    // 아날로그 스틱 좌/우 연속 이동 방지 락
let draftLockTimer = 0.0;    // 드래프트 열린 직후 실수 확정 방지 잠금 시간 (초)

// 순수 전투·웨이브 기반 경험치(XP) & 레벨업 증강 성장 상태
let playerLevel = 1;
let playerXp = 0;
let xpToNext = 130;
let pendingLevelUps = 0;
let totalAugmentsPicked = 0;
let overpowerStacks = 0;     // 12픽 만렙 이후 초과 레벨업당 STRIKE 영구 화력 +5%

// 물리 변환 및 기믹 실시간 누적 변수
let airTimeStack = 0.0;      // 체공 예열: 공중 체류 시간 (초)
let peakFallSpeed = 0.0;     // 낙하 운동량: 직전 최대 하강 속도 (-vy)
let frictionCharge = 0.0;    // 마찰 과열: 벽/바닥 스침 누적치 (0 ~ 1.5)
let perfectBuffTimer = 0.0;  // PERFECT RELEASE 후 단기 화력 보너스
let elasticChargesLeft = 0;  // 탄성 반발: 남은 벽면 반사 충전량 (0 ~ 레벨 최대치)
let elasticCritTimer = 0.0;  // 탄성 반발 Lv.3: 벽 반사 직후 2.5초 치명타 버프
let strikeRushStack = 0;     // 연속 돌격: 수동 STRIKE + 핀볼 연쇄 누적 스택
let strikeRushTimer = 0.0;   // 연속 돌격: 스택 유지 시간 (2.8s)
let lassoTargets = [];       // 올가미 스윙: 현재 거미줄에 포획된 적 배열
let fricFireTickTimer = 0.0; // 마찰 과열 Lv.3: 과열 70%+ 지속 화염 틱 타이머

// 초경량 PC-98 도트 이펙트 배열 (ESP32-S3 친화적 선분/원형 기반)
let shockwaves = [];         // { x, y, z, r, maxR, life, maxLife, col }
let lightningBolts = [];     // { x1, y1, z1, x2, y2, z2, life, maxLife, col }
let damageNumbers = [];      // { x, y, z, text, col, life, maxLife, big }
let pendingExplosions = [];  // { x, y, z, radius, dmg, col, delay, depth }

// =========================================================================
// [Step 4] 플레이 방식 변혁 6종 증강 Lv.3(★각성) 3초 3-Act 불릿타임 3D 컷씬 정의
// - 100% 수동 STRIKE(Shift) 적중 트리거 · 순수 연출 중심 (추가 딜 0 / 글로벌 40s · 개별 85s)
// =========================================================================
const APEX_GLOBAL_COOLDOWN = 40.0;
const APEX_AUG_COOLDOWN    = 85.0;
const APEX_CUT_IDS = [
  'heavy_suit',
  'overdrive',
  'bungee_web',
  'lasso_swing',
  'chain_pinball',
  'elastic'
];
const APEX_CUT_DEFS = {
  heavy_suit: {
    id: 'heavy_suit', name: '초중력 슈트', title: 'GRAVITY ZERO',
    col: '#ff9436', pose1: 'APEX_SLAM', pose2: 'FLIP', spin2: true
  },
  overdrive: {
    id: 'overdrive', name: '오버드라이브', title: 'MACH BREAK',
    col: '#ff5cf4', pose1: 'APEX_MACH', pose2: 'APEX_MACH', spin2: false
  },
  bungee_web: {
    id: 'bungee_web', name: '고탄성 번지줄', title: 'SKY SLINGSHOT',
    col: '#ffe55c', pose1: 'DROP_HERO', pose2: 'FLIP', spin2: true
  },
  lasso_swing: {
    id: 'lasso_swing', name: '올가미 스윙', title: 'WEB SUPERNOVA',
    col: '#a78bfa', pose1: 'STRIKE_TWOWEB', pose2: 'FLIP', spin2: true
  },
  chain_pinball: {
    id: 'chain_pinball', name: '연쇄 핀볼', title: 'PHANTOM PINBALL',
    col: '#ff5cf4', pose1: 'STRIKE_SPIN', pose2: 'STRIKE_SPIN', spin2: true
  },
  elastic: {
    id: 'elastic', name: '탄성 반발', title: 'RICOCHET COUNTER',
    col: '#4ade80', pose1: 'APEX_RICOCHET', pose2: 'STRIKE_DROPKICK', spin2: false
  }
};
let apexGlobalCd = 0.0;
let apexAugCds = {};
let apexTestCycleIdx = 0;

// 특정 증강 카드의 현재 레벨 반환 (미보유 시 0)
function getLv(id) {
  if (augLevels[id] === undefined) {
    return 0;
  }
  return augLevels[id];
}

// 현재 보유 중인 증강 종류 수 반환 (0 ~ MAX_AUG_SLOTS)
function getOwnedAugmentCount() {
  let cnt = 0;
  for (let i = 0; i < AUGMENTS.length; i++) {
    if (getLv(AUGMENTS[i].id) > 0) cnt++;
  }
  return cnt;
}

// 탄성 반발 레벨별 최대 충전량 (Lv.1: 1회 / Lv.2: 2회 / Lv.3: 3회)
function getElasticMaxCharges() {
  const lv = getLv('elastic');
  if (lv <= 0) return 0;
  return Math.min(MAX_AUG_LEVEL, lv);
}

// 탄성 반발 레벨별 벽면 반사 속도 배율 (Lv.1: 0.9x / Lv.2: 1.0x / Lv.3: 1.15x)
function getElasticBounceMult() {
  const lv = getLv('elastic');
  if (lv <= 0) return 0.0;
  if (lv === 1) return 0.9;
  if (lv === 2) return 1.0;
  return 1.15;
}

// 탄성 반발 레벨별 반사 충격파 사양
function getElasticShockSpec() {
  const lv = getLv('elastic');
  if (lv <= 0) return null;
  if (lv === 1) return { radius: 44.0, dmg: 20 };
  if (lv === 2) return { radius: 58.0, dmg: 36 };
  return { radius: 76.0, dmg: 56 };
}

function refillElasticCharges() {
  const maxCharges = getElasticMaxCharges();
  const recharged = maxCharges > 0 && elasticChargesLeft < maxCharges;
  elasticChargesLeft = maxCharges;
  return recharged;
}

// 진공 활공 레벨별 공기저항 계수 (Lv.0: 1.0 / Lv.1: 0.5 / Lv.2~3: 0.0)
function getVacuumDragFactor() {
  const lv = getLv('vacuum');
  if (lv <= 0) return 1.0;
  if (lv === 1) return 0.5;
  return 0.0;
}

// 연쇄 핀볼 레벨별 사양 (속도 스케일링 기본 계수: 16 / 22 / 28)
function getChainSpec() {
  const lv = getLv('chain_pinball');
  if (lv <= 0) return null;
  if (lv === 1) return { bounces: 1, radius: 95.0, baseDmg: 16.0, keepAir: false, endBonus: false };
  if (lv === 2) return { bounces: 3, radius: 120.0, baseDmg: 22.0, keepAir: true, endBonus: false };
  return { bounces: 5, radius: 150.0, baseDmg: 28.0, keepAir: true, endBonus: true };
}

// 하위 호환: 연쇄 핀볼 레벨별 자동 튕김 횟수 (Lv.1: 1회 / Lv.2: 3회 / Lv.3: 5회)
function getChainBounceCount() {
  const spec = getChainSpec();
  return spec ? spec.bounces : 0;
}

// 도미노 폭발 레벨별 사양
function getDominoSpec() {
  const lv = getLv('domino_boom');
  if (lv <= 0) return null;
  if (lv === 1) return { radius: 42.0, dmg: 24, maxDepth: 2, depthAmp: 0.0 };
  if (lv === 2) return { radius: 60.0, dmg: 44, maxDepth: 4, depthAmp: 0.0 };
  return { radius: 80.0, dmg: 70, maxDepth: 6, depthAmp: 0.20 };
}

// 전격 오라 레벨별 고속 주행 사양
function getSwingAuraSpec() {
  const lv = getLv('swing_aura');
  if (lv <= 0) return null;
  if (lv === 1) return { minSpd: 65.0, radius: 42.0, dmg: 16, tick: 0.25, clearProj: false, killBoost: 0.0, chainArc: false };
  if (lv === 2) return { minSpd: 58.0, radius: 58.0, dmg: 26, tick: 0.21, clearProj: true, killBoost: 10.0, chainArc: false };
  return { minSpd: 52.0, radius: 75.0, dmg: 38, tick: 0.17, clearProj: true, killBoost: 12.0, chainArc: true };
}

// 전격 오라 활성화 판정 공용 함수 (진공 활공 Lv.3 시 상시 전개!)
function isSwingAuraActive(totalSpeed, swingingNow) {
  const spec = getSwingAuraSpec();
  if (!spec) return false;
  if (getLv('vacuum') >= 3) return true;
  const reqSpd = swingingNow ? (spec.minSpd - 6.0) : spec.minSpd;
  return totalSpeed >= reqSpd;
}

// 올가미 스윙 레벨별 포획/기폭 사양
function getLassoSpec() {
  const lv = getLv('lasso_swing');
  if (lv <= 0) return null;
  if (lv === 1) return { maxTied: 4, radius: 36.0, detonatePer: 22, hitMultPer: 0.0, awakenCount: 99 };
  if (lv === 2) return { maxTied: 6, radius: 46.0, detonatePer: 34, hitMultPer: 0.12, awakenCount: 99 };
  return { maxTied: 8, radius: 58.0, detonatePer: 48, hitMultPer: 0.16, awakenCount: 4 };
}

// 연속 돌격 레벨별 연타/속도보존 사양
function getStrikeRushSpec() {
  const lv = getLv('strike_rush');
  if (lv <= 0) return null;
  if (lv === 1) return { maxStack: 4, dmgPerStack: 0.15, keepSpdRatio: 0.85, cdMult: 1.0, critAt: 99 };
  if (lv === 2) return { maxStack: 6, dmgPerStack: 0.25, keepSpdRatio: 0.95, cdMult: 0.85, critAt: 99 };
  return { maxStack: 8, dmgPerStack: 0.35, keepSpdRatio: 1.05, cdMult: 0.50, critAt: 4 };
}

// 체공 예열 레벨별 단일 극딜 사양 (광역 충격파 제거)
function getAirHeatSpec() {
  const lv = getLv('air_heat');
  if (lv <= 0) return null;
  if (lv === 1) return { perSec: 0.15, maxSec: 4.0, keepRatio: 0.0, fullCrit: false };
  if (lv === 2) return { perSec: 0.25, maxSec: 5.0, keepRatio: 0.0, fullCrit: false };
  return { perSec: 0.35, maxSec: 6.0, keepRatio: 0.5, fullCrit: true };
}

// 낙하 운동량 레벨별 사양
function getFallMomSpec() {
  const lv = getLv('fall_mom');
  if (lv <= 0) return null;
  if (lv === 1) return { maxBonus: 0.45, decayRate: 45.0, keepRatio: 0.0, shockR: 0.0 };
  if (lv === 2) return { maxBonus: 0.85, decayRate: 22.0, keepRatio: 0.0, shockR: 0.0 };
  return { maxBonus: 1.40, decayRate: 22.0, keepRatio: 0.5, shockR: 60.0 };
}

// 마찰 과열 레벨별 사양
function getFricHeatSpec() {
  const lv = getLv('fric_heat');
  if (lv <= 0) return null;
  if (lv === 1) return { boostRate: 0.18, chargeRate: 0.95, shockR: 42.0, shockDmgRatio: 0.55, fireTick: false };
  if (lv === 2) return { boostRate: 0.32, chargeRate: 1.33, shockR: 62.0, shockDmgRatio: 0.75, fireTick: false };
  return { boostRate: 0.50, chargeRate: 1.50, shockR: 84.0, shockDmgRatio: 1.00, fireTick: true };
}

// 레벨별 필요 경험치 (순수 전투·웨이브 6분 기준 12픽 만렙 누적 9,216 XP)
function getXpRequirement(lv) {
  return Math.round(130 + (lv - 1) * 70 + (lv - 1) * (lv - 1) * 6);
}

// 경험치 획득 및 레벨업 예약
function gainXp(amount) {
  if (amount <= 0 || gameOver) return;
  playerXp += amount;
  while (playerXp >= xpToNext) {
    playerXp -= xpToNext;
    playerLevel++;
    xpToNext = getXpRequirement(playerLevel);
    pendingLevelUps++;
    if (typeof addPopup === 'function') {
      addPopup('LEVEL UP! LV.' + playerLevel, PAL.NEON_CYAN, 3);
    }
  }
}

// 새 게임 시작 시 증강 및 누적 스택 전체 초기화
function resetAugments() {
  augLevels = {};
  augmentDraftOpen = false;
  draftChoices = [];
  draftCursor = 1;
  draftJoyLock = false;
  draftLockTimer = 0.0;

  playerLevel = 1;
  playerXp = 0;
  xpToNext = getXpRequirement(1);
  pendingLevelUps = 0;
  totalAugmentsPicked = 0;
  overpowerStacks = 0;

  airTimeStack = 0.0;
  peakFallSpeed = 0.0;
  frictionCharge = 0.0;
  perfectBuffTimer = 0.0;
  elasticChargesLeft = 0;
  elasticCritTimer = 0.0;
  strikeRushStack = 0;
  strikeRushTimer = 0.0;
  lassoTargets = [];
  fricFireTickTimer = 0.0;

  shockwaves = [];
  lightningBolts = [];
  damageNumbers = [];
  pendingExplosions = [];

  apexGlobalCd = 0.0;
  apexAugCds = {};
}

// =========================================================================
// 중앙 스탯 계산기: 보유 증강들을 바탕으로 최종 물리/전투 배율 계산
// (단점은 Lv.1 기준 고정, 장점·각성은 Lv.1 -> Lv.2 -> Lv.3 단계별 강화)
// =========================================================================
function getAugStats() {
  let gravityMult   = 1.0; // 중력 배율
  let maxSpeedMult  = 1.0; // 최대 속도 배율
  let swingPushMult = 1.0; // 스윙/비행 추진력 배율
  let turnMult      = 1.0; // 공중/스윙 선회력 배율
  let lockRangeMult = 1.0; // STRIKE 락온 사거리 배율
  let lockDotBonus  = 0.0; // STRIKE 락온 각도 완화 보너스
  let bungeeBounce  = 1.0; // 스윙 상승 반동 배율
  let baseDmgMult   = 1.0 + overpowerStacks * 0.05; // 기본 STRIKE 피해 배율 (+만렙 초과 OVERPOWER)

  // [초중력 슈트]: 중력 1.55x 고정, 기본 STRIKE 피해 +20% / +45% / +80%
  const lvHeavy = getLv('heavy_suit');
  if (lvHeavy > 0) {
    gravityMult *= 1.55;
    baseDmgMult *= (lvHeavy === 1 ? 1.20 : (lvHeavy === 2 ? 1.45 : 1.80));
  }

  // [오버드라이브]: 최대 속도 1.22x / 1.42x / 1.65x, 추진력 +15% / +32% / +55%, 선회력 0.74x 고정
  const lvOver = getLv('overdrive');
  if (lvOver > 0) {
    maxSpeedMult  *= (lvOver === 1 ? 1.22 : (lvOver === 2 ? 1.42 : 1.65));
    swingPushMult *= (lvOver === 1 ? 1.15 : (lvOver === 2 ? 1.32 : 1.55));
    turnMult      *= 0.74;
  }

  // [고탄성 번지줄]: 스윙 상승 반동 1.22x / 1.45x / 1.72x
  const lvBung = getLv('bungee_web');
  if (lvBung > 0) {
    bungeeBounce *= (lvBung === 1 ? 1.22 : (lvBung === 2 ? 1.45 : 1.72));
  }

  // [연속 돌격] Lv.2+: 연타 유지 중 광각 락온 보정 (방향 꺾어 다음 타겟 연계 지원)
  const lvRush = getLv('strike_rush');
  if (lvRush >= 2 && strikeRushStack > 0 && strikeRushTimer > 0) {
    lockRangeMult *= 1.25;
    lockDotBonus  += 0.14;
  }

  // [올가미 스윙]: 포획된 적 1명당 유효 중력 +8% (무게 리스크 -> 급강하/SLAM 시너지)
  if (lassoTargets.length > 0) {
    gravityMult *= (1.0 + lassoTargets.length * 0.08);
  }

  return {
    gravityMult:   gravityMult,
    maxSpeedMult:  maxSpeedMult,
    swingPushMult: swingPushMult,
    turnMult:      turnMult,
    lockRangeMult: lockRangeMult,
    lockDotBonus:  lockDotBonus,
    bungeeBounce:  bungeeBounce,
    baseDmgMult:   baseDmgMult
  };
}

// =========================================================================
// 4슬롯 상한 기반 3지선다 드래프트 로직
// =========================================================================
function openAugmentDraft() {
  const ownedCount = getOwnedAugmentCount();
  const slotsFull = ownedCount >= MAX_AUG_SLOTS;

  const available = [];
  const ownedUpgradable = [];
  const gimmickPool = [];

  for (let i = 0; i < AUGMENTS.length; i++) {
    const card = AUGMENTS[i];
    const lv = getLv(card.id);
    if (lv >= MAX_AUG_LEVEL) continue;
    if (slotsFull && lv === 0) continue; // 4슬롯 만충 시 보유 미완성 증강만 출현

    available.push(card);
    if (lv > 0) ownedUpgradable.push(card);
    if (card.tag === '기믹') gimmickPool.push(card);
  }

  if (available.length === 0) {
    hp = Math.min(MAX_HP, hp + 25);
    overpowerStacks++;
    pendingLevelUps = Math.max(0, pendingLevelUps - 1);
    addPopup('BUILD MAX!! +25HP PWR+' + (overpowerStacks * 5) + '%', PAL.GOLD, 3);
    return;
  }

  const shuffle = (arr) => {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  };

  const picked = [];

  // 첫 번째 선택에는 핵심 기믹 카드 1장 이상 보장(초반부터 빌드 방향성 제시)
  if (totalAugmentsPicked === 0 && gimmickPool.length > 0) {
    const gShuf = shuffle(gimmickPool);
    picked.push(gShuf[0]);
  } else if (ownedUpgradable.length > 0 && Math.random() < 0.72) {
    const upPool = shuffle(ownedUpgradable);
    picked.push(upPool[0]);
  }

  const restPool = shuffle(available);
  for (let i = 0; i < restPool.length && picked.length < 3; i++) {
    if (picked.indexOf(restPool[i]) === -1) {
      picked.push(restPool[i]);
    }
  }

  draftChoices = shuffle(picked);
  draftCursor = draftChoices.length >= 2 ? 1 : 0;
  draftJoyLock = false;
  draftLockTimer = 0.65; // 창이 열린 직후 0.65초간 실수 확정 방지 (Invariant 유지)
  augmentDraftOpen = true;
  if (typeof playSfx === 'function') playSfx('draft_open');
}

function moveDraftCursor(dir) {
  if (!augmentDraftOpen || draftChoices.length === 0) return;
  const n = draftChoices.length;
  draftCursor = (draftCursor + dir + n) % n;
  if (typeof playSfx === 'function') playSfx('ui_move');
}

function confirmAugment(idx) {
  if (!augmentDraftOpen || draftLockTimer > 0) return;
  const picked = draftChoices[idx];
  if (!picked) return;

  const newLv = Math.min(MAX_AUG_LEVEL, getLv(picked.id) + 1);
  augLevels[picked.id] = newLv;
  totalAugmentsPicked++;
  pendingLevelUps = Math.max(0, pendingLevelUps - 1);
  augmentDraftOpen = false;
  draftChoices = [];

  // 웨이브 도중 레벨업 후 복귀 시 짧은 보호 무적 & 탄성 반발 획득/강화 시 최대치 충전
  invulnTimer = Math.max(invulnTimer, 0.85);
  swingHeld = false;
  autoCatchAfterJump = false;
  if (picked.id === 'elastic') {
    refillElasticCharges();
  }

  const popSuffix = newLv === MAX_AUG_LEVEL ? ' ★MAX!!' : (' Lv.' + newLv + '!');
  addPopup(picked.name + popSuffix, newLv === MAX_AUG_LEVEL ? PAL.GOLD : picked.col, 3);
  if (typeof playSfx === 'function') playSfx('ui_confirm');
}

// =========================================================================
// 320x170 LCD용 PC-98 3지선다 카드 선택 UI (목표 레벨별 동적 설명 & 4슬롯 표시)
// =========================================================================
function drawAugmentDraftUI(drawPC98Box) {
  const KR_FONT = '"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';

  ctx.fillStyle = 'rgba(6, 10, 24, 0.88)';
  ctx.fillRect(0, 0, LCD_W, LCD_H);

  const ownedCount = getOwnedAugmentCount();
  const slotsFull = ownedCount >= MAX_AUG_SLOTS;

  ctx.textAlign = 'center';
  ctx.font = 'bold 10.5px ' + KR_FONT;
  const headerTxt = slotsFull
    ? ('LV.' + playerLevel + ' 강화! SLOTS ' + ownedCount + '/' + MAX_AUG_SLOTS + ' (만충)')
    : ('LV.' + playerLevel + ' 성장! SLOTS ' + ownedCount + '/' + MAX_AUG_SLOTS + ' (W' + wave + ')');
  ctx.fillStyle = '#000000';
  ctx.fillText(headerTxt, LCD_W * 0.5 + 1, 15);
  ctx.fillStyle = slotsFull ? PAL.NEON_CYAN : PAL.GOLD;
  ctx.fillText(headerTxt, LCD_W * 0.5, 14);

  const count = draftChoices.length;
  const cardW = 100;
  const cardH = 124;
  const gap = 5;
  const totalW = count * cardW + (count - 1) * gap;
  const startX = Math.round((LCD_W - totalW) * 0.5);

  for (let i = 0; i < count; i++) {
    const card = draftChoices[i];
    const selected = (i === draftCursor);
    const x = startX + i * (cardW + gap);
    const y = selected ? 20 : 24;

    const curLv = getLv(card.id);
    const nextLv = Math.min(MAX_AUG_LEVEL, curLv + 1);
    const isMaxUp = (nextLv === MAX_AUG_LEVEL);
    const borderCol = selected ? PAL.GOLD : (isMaxUp ? PAL.GOLD : card.col);

    drawPC98Box(x, y, cardW, cardH, borderCol);
    ctx.fillStyle = selected ? '#18244a' : '#0f162e';
    ctx.fillRect(x + 2, y + 2, cardW - 4, cardH - 4);
    if (selected) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 2.5, y + 2.5, cardW - 5, cardH - 5);
    }

    const lvText = curLv === 0 ? 'NEW Lv.1' : (isMaxUp ? '★Lv.3 MAX' : ('Lv.' + curLv + '→' + nextLv));
    ctx.fillStyle = isMaxUp ? PAL.GOLD : card.col;
    ctx.fillRect(x + 3, y + 3, cardW - 6, 15);
    ctx.font = 'bold 9px ' + KR_FONT;
    ctx.fillStyle = '#0b1024';
    ctx.fillText('[' + card.tag + '] ' + lvText, x + cardW * 0.5, y + 14);

    ctx.font = 'bold 11.5px ' + KR_FONT;
    ctx.fillStyle = '#000000';
    ctx.fillText(card.name, x + cardW * 0.5 + 1, y + 36);
    ctx.fillStyle = (selected || isMaxUp) ? PAL.GOLD : '#ffffff';
    ctx.fillText(card.name, x + cardW * 0.5, y + 35);

    ctx.fillStyle = (selected || isMaxUp) ? PAL.GOLD : '#384b7a';
    ctx.fillRect(x + 7, y + 41, cardW - 14, 1);

    const descLines = card.levels[nextLv - 1] || card.levels[0];
    ctx.font = 'bold 9.5px ' + KR_FONT;
    for (let li = 0; li < descLines.length; li++) {
      const lineTxt = descLines[li];
      const isAwakenLine = lineTxt.charAt(0) === '★';
      const ly = y + 58 + li * 16;
      ctx.fillStyle = '#000000';
      ctx.fillText(lineTxt, x + cardW * 0.5 + 1, ly + 1);
      ctx.fillStyle = isAwakenLine ? PAL.GOLD : (selected ? '#ffffff' : '#dbeafe');
      ctx.fillText(lineTxt, x + cardW * 0.5, ly);
    }

    if (selected) {
      if (draftLockTimer > 0) {
        const prog = Math.max(0, Math.min(1, 1.0 - draftLockTimer / 0.65));
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(x + 6, y + cardH - 19, cardW - 12, 14);
        ctx.fillStyle = '#64748b';
        ctx.fillRect(x + 6, y + cardH - 19, Math.round((cardW - 12) * prog), 14);
        ctx.font = 'bold 9px ' + KR_FONT;
        ctx.fillStyle = '#e2e8f0';
        ctx.fillText('잠시 대기...', x + cardW * 0.5, y + cardH - 8);
      } else {
        const blink = (Math.floor(performance.now() / 280) & 1) === 0;
        ctx.fillStyle = blink ? PAL.GOLD : '#ffffff';
        ctx.fillRect(x + 6, y + cardH - 19, cardW - 12, 14);
        ctx.font = 'bold 9.5px ' + KR_FONT;
        ctx.fillStyle = '#0b1024';
        ctx.fillText('▶ 선택 확정 ◀', x + cardW * 0.5, y + cardH - 8);
      }
    } else {
      ctx.font = 'bold 9px ' + KR_FONT;
      ctx.fillStyle = '#64748b';
      ctx.fillText((i + 1) + '번 카드', x + cardW * 0.5, y + cardH - 8);
    }
  }

  ctx.font = 'bold 9.5px ' + KR_FONT;
  ctx.fillStyle = PAL.NEON_CYAN;
  ctx.fillText('A/D·스틱: 이동   STRIKE(E/Shift)/터치: 확정', LCD_W * 0.5, 163);
  ctx.textAlign = 'left';
}

// =========================================================================
// 화면 좌측 하단: 고정 4슬롯 프레임 & 실시간 스택(탄성/오라/올가미/연타/체공/마찰)
// =========================================================================
function drawActiveAugmentsHUD(totalSpeed, swingingNow) {
  const KR_FONT = '"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  const owned = [];
  for (let i = 0; i < AUGMENTS.length; i++) {
    const lv = getLv(AUGMENTS[i].id);
    if (lv > 0) owned.push({ card: AUGMENTS[i], lv: lv });
  }

  let infoY = LCD_H - 22;
  ctx.font = 'bold 9px Consolas, monospace';

  // 탄성 반발 남은 충전량 표시 (320x170 HUD 4x4 도트 1~3개 + Lv.3 치명타 버프 점멸)
  const maxElastic = getElasticMaxCharges();
  if (maxElastic > 0) {
    const active = elasticChargesLeft > 0;
    const critOn = elasticCritTimer > 0;
    const dotSize = 4;
    const dotGap = 2;
    const dotStartX = 27;
    const boxX = 4;
    const boxY = infoY - 9;
    const boxH = 11;
    const boxW = (dotStartX - boxX) + maxElastic * (dotSize + dotGap) - dotGap + 4;

    ctx.fillStyle = '#0c1228';
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = critOn ? PAL.GOLD : (active ? PAL.EMERALD : '#475569');
    ctx.lineWidth = 1;
    ctx.strokeRect(boxX + 0.5, boxY + 0.5, boxW - 1, boxH - 1);
    ctx.fillStyle = critOn ? PAL.GOLD : (active ? PAL.EMERALD : '#94a3b8');
    ctx.fillText('BNC', boxX + 3, infoY);

    const dotY = boxY + 3;
    for (let i = 0; i < maxElastic; i++) {
      const dotX = dotStartX + i * (dotSize + dotGap);
      if (i < elasticChargesLeft) {
        ctx.fillStyle = critOn ? PAL.GOLD : PAL.EMERALD;
        ctx.fillRect(dotX, dotY, dotSize, dotSize);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(dotX, dotY, 1, 1);
      } else {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(dotX, dotY, dotSize, dotSize);
        ctx.strokeStyle = '#475569';
        ctx.strokeRect(dotX + 0.5, dotY + 0.5, dotSize - 1, dotSize - 1);
      }
    }
    infoY -= 13;
  }

  // 올가미 스윙 포획 수 표시
  const lassoSpec = getLassoSpec();
  if (lassoSpec && lassoTargets.length > 0) {
    const awakened = lassoTargets.length >= lassoSpec.awakenCount;
    const txt = 'TIED ' + lassoTargets.length + '/' + lassoSpec.maxTied;
    ctx.fillStyle = '#0c1228';
    ctx.fillRect(4, infoY - 9, 58, 11);
    ctx.strokeStyle = awakened ? PAL.GOLD : '#a78bfa';
    ctx.strokeRect(4.5, infoY - 8.5, 57, 10);
    ctx.fillStyle = awakened ? PAL.GOLD : '#d8b4fe';
    ctx.fillText(txt, 7, infoY);
    infoY -= 13;
  }

  // 연속 돌격 스택 표시
  const rushSpec = getStrikeRushSpec();
  if (rushSpec && strikeRushStack > 0 && strikeRushTimer > 0) {
    const isCrit = strikeRushStack >= rushSpec.critAt;
    const txt = 'RUSH x' + strikeRushStack;
    ctx.fillStyle = '#0c1228';
    ctx.fillRect(4, infoY - 9, 56, 11);
    ctx.strokeStyle = isCrit ? PAL.GOLD : '#38bdf8';
    ctx.strokeRect(4.5, infoY - 8.5, 55, 10);
    ctx.fillStyle = isCrit ? PAL.GOLD : '#7dd3fc';
    ctx.fillText(txt, 7, infoY);
    infoY -= 13;
  }

  // 전격 오라 활성화 표시
  if (isSwingAuraActive(totalSpeed, swingingNow)) {
    const overcharge = getLv('swing_aura') >= 3 && totalSpeed >= 95.0;
    ctx.fillStyle = '#0c1228';
    ctx.fillRect(4, infoY - 9, 58, 11);
    ctx.strokeStyle = overcharge ? PAL.GOLD : PAL.NEON_CYAN;
    ctx.strokeRect(4.5, infoY - 8.5, 57, 10);
    ctx.fillStyle = overcharge ? PAL.GOLD : PAL.NEON_CYAN;
    ctx.fillText(overcharge ? 'AURA MAX' : 'AURA ON', 7, infoY);
    infoY -= 13;
  }

  const airSpec = getAirHeatSpec();
  if (airSpec && airTimeStack >= 0.3) {
    const full = airSpec.fullCrit && airTimeStack >= (airSpec.maxSec - 0.5);
    const txt = 'AIR ' + airTimeStack.toFixed(1) + 's';
    ctx.fillStyle = '#0c1228';
    ctx.fillRect(4, infoY - 9, 54, 11);
    ctx.strokeStyle = full ? PAL.ORANGE : PAL.GOLD;
    ctx.strokeRect(4.5, infoY - 8.5, 53, 10);
    ctx.fillStyle = full ? '#ffffff' : PAL.GOLD;
    ctx.fillText(txt, 7, infoY);
    infoY -= 13;
  }

  if (getLv('fric_heat') > 0 && frictionCharge >= 0.1) {
    const pct = Math.min(100, Math.round((frictionCharge / 1.5) * 100));
    const txt = 'HEAT ' + pct + '%';
    ctx.fillStyle = '#0c1228';
    ctx.fillRect(4, infoY - 9, 58, 11);
    ctx.strokeStyle = (getLv('fric_heat') >= 3 && pct >= 70) ? PAL.GOLD : PAL.CRIMSON;
    ctx.strokeRect(4.5, infoY - 8.5, 57, 10);
    ctx.fillStyle = (getLv('fric_heat') >= 3 && pct >= 70) ? PAL.GOLD : '#ff7b93';
    ctx.fillText(txt, 7, infoY);
    infoY -= 13;
  }

  // 고정 4슬롯 프레임 (빈 칸 포함 표시, Lv.3 마스터는 금색 강조)
  const chipW = 28;
  const chipH = 13;
  for (let i = 0; i < MAX_AUG_SLOTS; i++) {
    const x = 4 + i * (chipW + 2);
    const y = LCD_H - 16;
    if (i < owned.length) {
      const item = owned[i];
      const isMax = item.lv >= MAX_AUG_LEVEL;
      ctx.fillStyle = isMax ? '#1f1d38' : '#0c1228';
      ctx.fillRect(x, y, chipW, chipH);
      ctx.strokeStyle = isMax ? PAL.GOLD : item.card.col;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, chipW - 1, chipH - 1);
      ctx.fillStyle = isMax ? PAL.GOLD : '#ffffff';
      ctx.font = 'bold 8.5px ' + KR_FONT;
      ctx.fillText(item.card.name.charAt(0) + item.lv + (isMax ? '★' : ''), x + 3, y + 10);
    } else {
      ctx.fillStyle = 'rgba(12, 18, 40, 0.65)';
      ctx.fillRect(x, y, chipW, chipH);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, chipW - 1, chipH - 1);
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 8px Consolas, monospace';
      ctx.fillText('·', x + 12, y + 9);
    }
  }
}