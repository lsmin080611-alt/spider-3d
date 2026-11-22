'use strict';

// =========================================================================
// 스파이더맨 PC-98 로그라이크 증강(카드) 시스템 — 기믹 확장 완전판
// - 14종 유기적 증강 (물리 변조 4 / 폭발 기믹 4 / 변환·역전 6)
// - 탄성 반발: 벽면 정면 충돌 전용 반사, 최대 1/2/3회, 배율 0.9x/1.0x/1.1x, STRIKE·PERFECT 전량 재충전
// - 실력 기반 경험치(XP) 레벨업 증강 + 0.65초 오입력 방지 잠금
// - 320x170 고대비 한글 카드 UI & 좌측 하단 보유 배지/실시간 스택 표시
// =========================================================================

const MAX_AUG_LEVEL = 3;

const AUGMENTS = [
  // ① 물리 변조 (유불리 트레이드오프)
  { id: 'heavy_suit',    tag: '변조', name: '초중력 슈트',   col: '#ff9436', desc: ['중력 1.55배', 'STRIKE +45%', 'C1 충격파↑'] },
  { id: 'moon_pull',     tag: '변조', name: '달의 인력',     col: '#54f8ff', desc: ['중력 0.55배', '락온·선회↑', '고공 체공↑'] },
  { id: 'overdrive',     tag: '변조', name: '오버드라이브',  col: '#ff5cf4', desc: ['최대속도1.5x', '추진력 +35%', '선회 둔화'] },
  { id: 'bungee_web',    tag: '변조', name: '고탄성 번지줄', col: '#ffe55c', desc: ['상승반동1.45x', '650m 고공도약', '저점 깊어짐'] },

  // ② 폭발 기믹 (집자마자 화면이 터지는 핵심 기믹)
  { id: 'chain_pinball', tag: '기믹', name: '연쇄 핀볼',     col: '#ff5cf4', desc: ['적중시 자동연쇄', '2/3/5회 튕김', '가속+체공유지'] },
  { id: 'swing_aura',    tag: '기믹', name: '전격 오라',     col: '#54f8ff', desc: ['스윙·고속시 전개', '광역 감전+보정', '스웜 자동학살'] },
  { id: 'volt_web',      tag: '기믹', name: '고압 거미줄',   col: '#ffe55c', desc: ['거미줄 주변 넓은', '고압 전기 아크', '스윙으로 베기'] },
  { id: 'domino_boom',   tag: '기믹', name: '도미노 폭발',   col: '#ff9436', desc: ['적 처치시 광역', '2차 연쇄폭발', '편대 일괄폭파'] },

  // ③ 물리 변환 & 규칙 역전 (범용 화력 엔진 ↔ 단점 역전 스위치)
  { id: 'elastic',       tag: '역전', name: '탄성 반발',     col: '#4ade80', desc: ['벽 반사 0.9~1.1x', '1/2/3회 + 충격파', '타격·퍼펙트 충전'] },
  { id: 'cloud_hook',    tag: '역전', name: '구름 앵커',     col: '#b8e4ff', desc: ['상공 구름스윙', '160m+ 치명타', '성층권 제압'] },
  { id: 'vacuum',        tag: '역전', name: '진공 활공',     col: '#54f8ff', desc: ['공기저항 0%', '오라 상시유지', '공중감속 불가'] },
  { id: 'fall_mom',      tag: '변환', name: '낙하 운동량',   col: '#ff9436', desc: ['하강속도 비례', 'STRIKE 폭증', 'C1 보스원샷'] },
  { id: 'air_heat',      tag: '변환', name: '체공 예열',     col: '#ffe55c', desc: ['체공 1초당', '피해 +35%', '폭발범위 확대'] },
  { id: 'fric_heat',     tag: '변환', name: '마찰 과열',     col: '#e82848', desc: ['벽·바닥 스침', '가속+화염파동', '근접 화력↑'] }
];

// =========================================================================
// 증강 보유 상태 및 실시간 물리·기믹 시너지 변수
// =========================================================================
let augLevels = {};          // 보유 중인 증강 레벨 (예: { elastic: 1, swing_aura: 2 })
let augmentDraftOpen = false;
let draftChoices = [];       // 현재 화면에 뜬 선택지 카드 최대 3장
let draftCursor = 1;         // 선택 포커스 인덱스 (0, 1, 2)
let draftJoyLock = false;    // 아날로그 스틱 좌/우 연속 이동 방지 락
let draftLockTimer = 0.0;    // 드래프트 열린 직후 실수 확정 방지 잠금 시간 (초)

// 실력 기반 경험치(XP) & 레벨업 증강 성장 상태
let playerLevel = 1;
let playerXp = 0;
let xpToNext = 160;
let pendingLevelUps = 0;
let totalAugmentsPicked = 0;

// 물리 변환 및 기믹 실시간 누적 변수
let airTimeStack = 0.0;      // 체공 예열: 공중 체류 시간 (초)
let peakFallSpeed = 0.0;     // 낙하 운동량: 직전 최대 하강 속도 (-vy)
let frictionCharge = 0.0;    // 마찰 과열: 벽/바닥 스침 누적치 (0 ~ 1.5)
let perfectBuffTimer = 0.0;  // PERFECT RELEASE 후 단기 화력 보너스
let elasticChargesLeft = 0;  // 탄성 반발: 남은 벽면 반사 충전량 (0 ~ 레벨 최대치)

// 초경량 PC-98 도트 이펙트 배열 (ESP32-S3 친화적 선분/원형 기반)
let shockwaves = [];         // { x, y, z, r, maxR, life, maxLife, col }
let lightningBolts = [];     // { x1, y1, z1, x2, y2, z2, life, maxLife, col }
let damageNumbers = [];      // { x, y, z, text, col, life, maxLife, big }
let pendingExplosions = [];  // { x, y, z, radius, dmg, col, delay, depth }

// 특정 증강 카드의 현재 레벨 반환 (미보유 시 0)
function getLv(id) {
  if (augLevels[id] === undefined) {
    return 0;
  }
  return augLevels[id];
}

// 탄성 반발 레벨별 최대 충전량 (Lv.1: 1회 / Lv.2: 2회 / Lv.3: 3회)
function getElasticMaxCharges() {
  const lv = getLv('elastic');
  if (lv <= 0) return 0;
  return Math.min(MAX_AUG_LEVEL, lv);
}

// 탄성 반발 레벨별 벽면 반사 속도 배율 (Lv.1: 0.9x / Lv.2: 1.0x / Lv.3: 1.1x)
function getElasticBounceMult() {
  const lv = getLv('elastic');
  if (lv <= 0) return 0.0;
  if (lv === 1) return 0.9;
  if (lv === 2) return 1.0;
  return 1.1;
}

function refillElasticCharges() {
  const maxCharges = getElasticMaxCharges();
  const recharged = maxCharges > 0 && elasticChargesLeft < maxCharges;
  elasticChargesLeft = maxCharges;
  return recharged;
}

// 연쇄 핀볼 레벨별 자동 튕김 횟수 (Lv.1: 2회 / Lv.2: 3회 / Lv.3: 5회)
function getChainBounceCount() {
  const lv = getLv('chain_pinball');
  if (lv <= 0) return 0;
  if (lv === 1) return 2;
  if (lv === 2) return 3;
  return 5;
}

// 전격 오라 활성화 판정 공용 함수 (스윙 중에는 34+ 속도만 되어도 즉시 전개!)
function isSwingAuraActive(totalSpeed, swingingNow) {
  if (getLv('swing_aura') <= 0) return false;
  if (totalSpeed >= 48.0) return true;
  if (swingingNow && totalSpeed >= 34.0) return true;
  return false;
}

// 레벨별 필요 경험치 (초반 실력 플레이로 1웨이브 내 빠른 성장 가속)
function getXpRequirement(lv) {
  return Math.round(160 + (lv - 1) * 85 + (lv - 1) * (lv - 1) * 14);
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

  airTimeStack = 0.0;
  peakFallSpeed = 0.0;
  frictionCharge = 0.0;
  perfectBuffTimer = 0.0;
  elasticChargesLeft = 0;

  shockwaves = [];
  lightningBolts = [];
  damageNumbers = [];
  pendingExplosions = [];
}

// =========================================================================
// 중앙 스탯 계산기: 보유 증강들을 바탕으로 최종 물리/전투 배율 계산
// (레벨업 시 단점은 1레벨 고정, 장점 수치만 강화)
// =========================================================================
function getAugStats() {
  let gravityMult   = 1.0; // 중력 배율
  let maxSpeedMult  = 1.0; // 최대 속도 배율
  let swingPushMult = 1.0; // 스윙/비행 추진력 배율
  let turnMult      = 1.0; // 공중/스윙 선회력 배율
  let lockRangeMult = 1.0; // STRIKE 락온 사거리 배율
  let lockDotBonus  = 0.0; // STRIKE 락온 각도 완화 보너스
  let bungeeBounce  = 1.0; // 스윙 상승 반동 배율
  let baseDmgMult   = 1.0; // 기본 STRIKE 피해 배율

  // [초중력 슈트]: 중력 1.55배 고정, 기본 STRIKE 피해 대폭 증가
  const lvHeavy = getLv('heavy_suit');
  if (lvHeavy > 0) {
    gravityMult = gravityMult * 1.55;
    baseDmgMult = baseDmgMult * (1.20 + lvHeavy * 0.25);
  }

  // [달의 인력]: 중력 0.55배 고정, 선회력·락온 범위 확대, 추진력 소폭 감소
  const lvMoon = getLv('moon_pull');
  if (lvMoon > 0) {
    gravityMult   = gravityMult * 0.55;
    turnMult      = turnMult * (1.30 + lvMoon * 0.15);
    lockRangeMult = lockRangeMult * (1.30 + lvMoon * 0.15);
    lockDotBonus  = lockDotBonus + (0.08 + lvMoon * 0.04);
    swingPushMult = swingPushMult * 0.85;
  }

  // [오버드라이브]: 최대 속도 및 추진력 대폭 증가, 선회력 0.74배 고정 둔화
  const lvOver = getLv('overdrive');
  if (lvOver > 0) {
    maxSpeedMult  = maxSpeedMult * (1.35 + lvOver * 0.15);
    swingPushMult = swingPushMult * (1.23 + lvOver * 0.12);
    turnMult      = turnMult * 0.74;
  }

  // [고탄성 번지줄]: 스윙 상승 반동 강화
  const lvBung = getLv('bungee_web');
  if (lvBung > 0) {
    bungeeBounce = bungeeBounce * (1.30 + lvBung * 0.15);
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
// 3지선다 드래프트 로직
// =========================================================================
function openAugmentDraft() {
  const available = [];
  const ownedUpgradable = [];
  const gimmickPool = [];

  for (let i = 0; i < AUGMENTS.length; i++) {
    const card = AUGMENTS[i];
    const lv = getLv(card.id);
    if (lv < MAX_AUG_LEVEL) {
      available.push(card);
      if (lv > 0) ownedUpgradable.push(card);
      if (card.tag === '기믹') gimmickPool.push(card);
    }
  }

  if (available.length === 0) {
    hp = Math.min(MAX_HP, hp + 30);
    pendingLevelUps = Math.max(0, pendingLevelUps - 1);
    addPopup('ALL AUGMENTS MAX! +30HP', PAL.GOLD, 3);
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

  // 첫 번째 증강 선택지에는 반드시 기믹 카드 1장 이상 보장(초반부터 터지는 맛!)
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
  draftLockTimer = 0.65; // 창이 열린 직후 0.65초간 실수 확정 방지
  augmentDraftOpen = true;
}

function moveDraftCursor(dir) {
  if (!augmentDraftOpen || draftChoices.length === 0) return;
  const n = draftChoices.length;
  draftCursor = (draftCursor + dir + n) % n;
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

  addPopup(picked.name + ' Lv.' + newLv + '!', picked.col, 3);
}

// =========================================================================
// 320x170 LCD용 PC-98 3지선다 카드 선택 UI 렌더링 (고대비 한글 가독성 강화)
// =========================================================================
function drawAugmentDraftUI(drawPC98Box) {
  const KR_FONT = '"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';

  ctx.fillStyle = 'rgba(6, 10, 24, 0.88)';
  ctx.fillRect(0, 0, LCD_W, LCD_H);

  ctx.textAlign = 'center';
  ctx.font = 'bold 11px ' + KR_FONT;
  const headerTxt = 'LV.' + playerLevel + ' 성장! 증강 선택 (W' + wave + ')';
  ctx.fillStyle = '#000000';
  ctx.fillText(headerTxt, LCD_W * 0.5 + 1, 15);
  ctx.fillStyle = PAL.GOLD;
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

    drawPC98Box(x, y, cardW, cardH, selected ? PAL.GOLD : card.col);
    ctx.fillStyle = selected ? '#18244a' : '#0f162e';
    ctx.fillRect(x + 2, y + 2, cardW - 4, cardH - 4);
    if (selected) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 2.5, y + 2.5, cardW - 5, cardH - 5);
    }

    const curLv = getLv(card.id);
    const lvText = curLv === 0 ? 'NEW' : ('Lv.' + curLv + '→' + (curLv + 1));
    ctx.fillStyle = card.col;
    ctx.fillRect(x + 3, y + 3, cardW - 6, 15);
    ctx.font = 'bold 9.5px ' + KR_FONT;
    ctx.fillStyle = '#0b1024';
    ctx.fillText('[' + card.tag + '] ' + lvText, x + cardW * 0.5, y + 14);

    ctx.font = 'bold 12px ' + KR_FONT;
    ctx.fillStyle = '#000000';
    ctx.fillText(card.name, x + cardW * 0.5 + 1, y + 36);
    ctx.fillStyle = selected ? PAL.GOLD : '#ffffff';
    ctx.fillText(card.name, x + cardW * 0.5, y + 35);

    ctx.fillStyle = selected ? PAL.GOLD : '#384b7a';
    ctx.fillRect(x + 7, y + 41, cardW - 14, 1);

    ctx.font = 'bold 10px ' + KR_FONT;
    for (let li = 0; li < card.desc.length; li++) {
      const ly = y + 58 + li * 16;
      ctx.fillStyle = '#000000';
      ctx.fillText(card.desc[li], x + cardW * 0.5 + 1, ly + 1);
      ctx.fillStyle = selected ? '#ffffff' : '#dbeafe';
      ctx.fillText(card.desc[li], x + cardW * 0.5, ly);
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
// 화면 좌측 하단: 보유 증강 배지 & 실시간 스택(탄성 횟수/오라/체공/마찰) 표시
// =========================================================================
function drawActiveAugmentsHUD(totalSpeed, swingingNow) {
  const KR_FONT = '"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  const owned = [];
  for (let i = 0; i < AUGMENTS.length; i++) {
    const lv = getLv(AUGMENTS[i].id);
    if (lv > 0) owned.push({ card: AUGMENTS[i], lv: lv });
  }
  if (owned.length === 0) return;

  let infoY = LCD_H - 22;
  ctx.font = 'bold 9px Consolas, monospace';

  // 탄성 반발 남은 충전량 표시 (320x170 HUD 4x4 도트 1~3개)
  const maxElastic = getElasticMaxCharges();
  if (maxElastic > 0) {
    const active = elasticChargesLeft > 0;
    const dotSize = 4;
    const dotGap = 2;
    const dotStartX = 27;
    const boxX = 4;
    const boxY = infoY - 9;
    const boxH = 11;
    const boxW = (dotStartX - boxX) + maxElastic * (dotSize + dotGap) - dotGap + 4;

    ctx.fillStyle = '#0c1228';
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = active ? PAL.EMERALD : '#475569';
    ctx.lineWidth = 1;
    ctx.strokeRect(boxX + 0.5, boxY + 0.5, boxW - 1, boxH - 1);
    ctx.fillStyle = active ? PAL.EMERALD : '#94a3b8';
    ctx.fillText('BNC', boxX + 3, infoY);

    const dotY = boxY + 3;
    for (let i = 0; i < maxElastic; i++) {
      const dotX = dotStartX + i * (dotSize + dotGap);
      if (i < elasticChargesLeft) {
        ctx.fillStyle = PAL.EMERALD;
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

  // 전격 오라 활성화 표시
  if (isSwingAuraActive(totalSpeed, swingingNow)) {
    ctx.fillStyle = '#0c1228';
    ctx.fillRect(4, infoY - 9, 54, 11);
    ctx.strokeStyle = PAL.NEON_CYAN;
    ctx.strokeRect(4.5, infoY - 8.5, 53, 10);
    ctx.fillStyle = PAL.NEON_CYAN;
    ctx.fillText('AURA ON', 7, infoY);
    infoY -= 13;
  }

  if (getLv('air_heat') > 0 && airTimeStack >= 0.3) {
    const txt = 'AIR ' + airTimeStack.toFixed(1) + 's';
    ctx.fillStyle = '#0c1228';
    ctx.fillRect(4, infoY - 9, 54, 11);
    ctx.strokeStyle = PAL.GOLD;
    ctx.strokeRect(4.5, infoY - 8.5, 53, 10);
    ctx.fillStyle = PAL.GOLD;
    ctx.fillText(txt, 7, infoY);
    infoY -= 13;
  }

  if (getLv('fric_heat') > 0 && frictionCharge >= 0.1) {
    const pct = Math.min(100, Math.round((frictionCharge / 1.5) * 100));
    const txt = 'HEAT ' + pct + '%';
    ctx.fillStyle = '#0c1228';
    ctx.fillRect(4, infoY - 9, 58, 11);
    ctx.strokeStyle = PAL.CRIMSON;
    ctx.strokeRect(4.5, infoY - 8.5, 57, 10);
    ctx.fillStyle = '#ff7b93';
    ctx.fillText(txt, 7, infoY);
    infoY -= 13;
  }

  // 보유 증강 컬러 칩
  const chipW = 24;
  const chipH = 13;
  for (let i = 0; i < owned.length; i++) {
    const x = 4 + i * (chipW + 2);
    const y = LCD_H - 16;
    if (x + chipW > LCD_W - 18) break;
    const item = owned[i];
    ctx.fillStyle = '#0c1228';
    ctx.fillRect(x, y, chipW, chipH);
    ctx.strokeStyle = item.card.col;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, chipW - 1, chipH - 1);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px ' + KR_FONT;
    ctx.fillText(item.card.name.charAt(0) + item.lv, x + 3, y + 10);
  }
}