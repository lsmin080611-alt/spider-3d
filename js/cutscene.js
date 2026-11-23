'use strict';
// Spider 3D — Opening 5-Cut Rooftop Sequence & Step 4 APEX CUT 3-Act Engine

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
  // Cut 1 진입 시 타워 바깥쪽 측면 허공으로 매치 컷 전환 (건물 관통 원천 차단)
  openCamX = 16.5;
  openCamY = START_ROOF.bh + 3.0;
  openCamZ = -96.5;
  camLagYaw = Math.atan2(px - openCamX, (pz + 3.0) - openCamZ);
  camPitch = -0.06;
  camRoll = 0.0;
  fovD = 194.0;
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
    // 510m 첨탑 옥상: 등 뒤 오른쪽 위에서 황금 난간 너머 맨해튼 마천루 숲을 바라보는 와이드 샷
    px = 0.0; py = START_ROOF.bh + 2.1; pz = -105.5;
    vx = 0.0; vy = 0.0; vz = 0.0;
    openCamX = 3.8 + Math.sin(openingTimer * 0.65) * 0.35;
    openCamY = py + 1.5 + Math.sin(openingTimer * 1.1) * 0.12;
    openCamZ = pz - 7.5;
    camYaw = 0.0;
    aimOpeningCam(px - 0.8, py - 1.2, pz + 14.0, 12.0);
    camRoll = 0.0;
    fovD = 190.0;
    openingCamBlend = 1.0;
    openingLetterbox = 1.0;
    openingCloudRush = 0.0;
    openingPoseRadial = 0.0;
    openingPoseMode = 'IDLE';
    return true;
  }

  if (openingPhase === 'ROOF_WALK') {
    // Cut 1: 타워 바깥쪽 측면 허공(x=16+)에서 옆모습 보행 + 배경 마천루 패럴랙스 -> 난간 끝 0.40s 숨 고르기
    openingCloudRush = 0.0;
    openingPoseRadial = 0.0;
    const stopZ = START_ROOF_LEDGE_Z - 0.8; // -91.8
    if (pz < stopZ) {
      const distToEdge = Math.max(0.0, stopZ - pz);
      const walkSpd = distToEdge < 4.5 ? (7.5 + (distToEdge / 4.5) * 5.0) : 12.5;
      pz = Math.min(stopZ, pz + walkSpd * dt);
      vx = 0.0; vy = 0.0; vz = walkSpd;
      py = START_ROOF.bh + 2.1 + Math.abs(Math.sin(openingTimer * 6.4)) * 0.22;
      openingPoseMode = ((Math.floor(openingTimer * 4.4) & 1) === 0) ? 'WALK_A' : 'WALK_B';

      const walkProg = Math.max(0.0, Math.min(1.0, (pz - (-105.5)) / (stopZ - (-105.5))));
      openCamX += ((16.5 - walkProg * 0.5) - openCamX) * 3.5 * dt;
      openCamY += ((START_ROOF.bh + 3.0 - walkProg * 0.8) - openCamY) * 3.5 * dt;
      openCamZ += ((-96.5 + walkProg * 9.5) - openCamZ) * 3.5 * dt;
      camYaw = 0.0;
      aimOpeningCam(px, START_ROOF.bh + 1.5 - walkProg * 0.8, pz + 3.5, 6.0);
      camRoll = 0.0;
      fovD += ((194.0 + walkProg * 8.0) - fovD) * 3.5 * dt;
    } else {
      openingEdgePause += dt;
      vx = 0.0; vy = 0.0; vz = 0.0;
      py = START_ROOF.bh + 2.1;
      openingPoseMode = 'IDLE';

      openCamX += (16.2 - openCamX) * 3.5 * dt;
      openCamY += ((START_ROOF.bh + 2.0) - openCamY) * 3.5 * dt;
      openCamZ += (-86.0 - openCamZ) * 3.5 * dt;
      aimOpeningCam(px, START_ROOF.bh + 0.6, pz + 4.5, 5.5);
      fovD += (204.0 - fovD) * 3.5 * dt;

      if (openingEdgePause >= 0.40) {
        openingPhase = 'DROP_INTRO';
        openingTimer = 0.0;
        openingEdgePause = 0.0;
        openingPoseMode = 'SLIP';
        // 난간 앞쪽 완전 개방 허공으로 부드럽게 몸을 띄워 타워 외벽에서 확실히 멀어짐
        py = START_ROOF.bh + 2.0;
        pz = START_ROOF_LEDGE_Z + 0.8; // -90.2 (> -91.0)
        vx = 0.0; vy = 3.5; vz = 22.0;
      }
    }
    openingCamBlend = 1.0;
    openingLetterbox = 1.0;
    return true;
  }

  if (openingPhase === 'DROP_INTRO') {
    const introDur      = openingRetryDrop ? 1.50 : 4.05;
    const chaseStart    = openingRetryDrop ? 0.00 : 1.15;
    const poseCutStart  = openingRetryDrop ? 0.62 : 2.35;
    const heroHoldStart = openingRetryDrop ? 0.86 : 2.83;
    const diveSnapStart = openingRetryDrop ? 1.15 : 3.45;
    const t = openingTimer;

    // 1) 캐릭터 낙하 물리 (허공 측면 도약 -> 구름 돌파 급강하 -> 슬로우 공중 플립/히어로 포즈 -> 다이브 스냅)
    if (t < chaseStart) {
      openingPoseMode = 'SLIP';
      doingFlip = false;
      isDiving = false;
      const g = 24.0 + (t / Math.max(0.01, chaseStart)) * 36.0;
      vy -= g * dt;
      vz += (21.5 - vz) * 2.0 * dt;
    } else if (t < poseCutStart) {
      openingPoseMode = 'DIVE';
      doingFlip = false;
      isDiving = true;
      vy -= (openingRetryDrop ? 115.0 : 108.0) * dt;
      vz += (15.0 - vz) * 2.5 * dt;
    } else if (t < heroHoldStart) {
      // Cut 4 전반: 역방향 앵글 공중 1회전 플립 (미세 슬로우)
      openingPoseMode = 'FLIP';
      doingFlip = true;
      isDiving = false;
      flipAngle = ((t - poseCutStart) / Math.max(0.01, heroHoldStart - poseCutStart)) * Math.PI * 2;
      const targetVy = openingRetryDrop ? -60.0 : -54.0;
      vy += (targetVy - vy) * 5.0 * dt;
      vz += (10.0 - vz) * 3.0 * dt;
      afterimageTimer = 0.16;
    } else if (t < diveSnapStart) {
      // Cut 4 후반: 스파이더버스 오마주 DROP_HERO 포즈 홀드 (미세 슬로우)
      openingPoseMode = 'POSE';
      doingFlip = false;
      flipAngle = 0.0;
      isDiving = false;
      const targetVy = openingRetryDrop ? -50.0 : -44.0;
      vy += (targetVy - vy) * 6.0 * dt;
      vz += (10.0 - vz) * 3.0 * dt;
      afterimageTimer = 0.16;
    } else {
      // Cut 5: 다이브 스냅 & 3인칭 시점 복귀
      openingPoseMode = 'DIVE';
      doingFlip = false;
      flipAngle = 0.0;
      isDiving = true;
      vy -= (openingRetryDrop ? 86.0 : 78.0) * dt;
      vz += (19.0 - vz) * 4.5 * dt;
      diveCharge = Math.min(0.42, diveCharge + dt * 1.0);
    }

    px += vx * dt;
    py += vy * dt;
    pz += vz * dt;
    camYaw = 0.0;

    // 2) 건물 관통 0% 멀티-컷 영화 카메라 워크
    if (t < chaseStart) {
      // Cut 2: 타워 바깥쪽 측면 허공(x=16.5, z=-84)에 머물러 왼쪽 유리 외벽 너머로 떨어지는 실루엣을 틸트다운 추적
      openingCloudRush = 0.0;
      openingPoseRadial = 0.0;
      openCamX += (16.5 - openCamX) * 2.0 * dt;
      openCamY += ((START_ROOF.bh + 1.2) - openCamY) * 1.4 * dt;
      openCamZ += (-84.0 - openCamZ) * 1.5 * dt;
      aimOpeningCam(px, py, pz, 8.0);
      camRoll += (0.0 - camRoll) * 6.0 * dt;
      fovD += (208.0 - fovD) * 4.0 * dt;
      openingCamBlend = 1.0;
      openingLetterbox = 1.0;
    } else if (t < poseCutStart) {
      // Cut 3: 타워 앞쪽 완전 개방 허공으로 빠져나온 캐릭터를 측면->등 뒤 상공으로 휘감아 들어가며 수직 급추격 + 구름 돌파!
      const cProg = Math.max(0.0, Math.min(1.0, (t - chaseStart) / Math.max(0.01, poseCutStart - chaseStart)));
      const chaseRate = 3.5 + cProg * cProg * 12.0;
      openCamX += (px - openCamX) * Math.min(1.0, chaseRate * dt);
      openCamY += ((py + 6.5 - vy * 0.04) - openCamY) * Math.min(1.0, chaseRate * dt);
      openCamZ += ((pz - 14.5) - openCamZ) * Math.min(1.0, chaseRate * dt);
      aimOpeningCam(px, py - 2.0, pz + 3.0, 9.0);
      camRoll += (Math.sin(cProg * Math.PI) * 0.08 - camRoll) * 6.0 * dt;
      const targetFov = 198.0 - Math.sin(cProg * Math.PI * 0.85) * 70.0;
      fovD += (targetFov - fovD) * 7.5 * dt;
      const inCloudBand = (py <= 495.0 && py >= 310.0) ? 1.0 : 0.45;
      openingCloudRush = Math.sin(cProg * Math.PI) * inCloudBand;
      openingPoseRadial = 0.0;
      openingCamBlend = 1.0;
      openingLetterbox = 1.0;
    } else if (t < diveSnapStart) {
      // Cut 4: 스파이더버스 역방향 올려다보는 공중 포즈 컷 (앞쪽 아래 허공에서 하늘/구름 배경으로 올려다보기)
      const pProg = Math.max(0.0, Math.min(1.0, (t - poseCutStart) / Math.max(0.01, diveSnapStart - poseCutStart)));
      const inHold = (t >= heroHoldStart);
      const desCamX = px + (3.2 - pProg * 1.0);
      const desCamY = py - (4.4 - pProg * 0.6);
      const desCamZ = pz + (7.2 - pProg * 1.0);
      if (prevT < poseCutStart) {
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


// =========================================================================
// [Step 4] 플레이 방식 변혁 6종 증강 Lv.3(★각성) 3.0초 3-Act 불릿타임 3D 컷씬 엔진
// - Act 1 (0.00~1.05s): 완전 0% 시간정지 + 70°~80° 3D 시점 선회(Orbit) + 레터박스
// - Act 2 (1.05~2.05s): 매치 컷 앵글 전환 + 0.14x 초슬로우 + 비마법적 3D 물리 이펙트
// - Act 3 (2.05~3.00s): 100% 원속 재개 + 드라이브바이 지연 추격 + 광각 스냅백
// - 100% 수동 STRIKE(Shift) 적중 트리거 · 순수 연출 중심 (추가 딜 0 / 종료 후 0.80s 무적)
// =========================================================================
function resetApexCutState() {
  apexActive = false;
  apexId = '';
  apexTimer = 0.0;
  apexLetterbox = 0.0;
  apexCamBlend = 0.0;
  apexAct2Cam = null;
  apexAct2Started = false;
  apexAct3Started = false;
  apexFlashTimer = 0.0;
  apexIsTest = false;
  apexTestLabel = '';
  apexSceneExtras = null;
  lastElasticWallPt = null;
  lastBungeeAnchorPt = null;
  bungeeApexTimer = 0.0;
  chainPathPts = [];
}

function isApexFreezePhase() {
  return apexActive && apexTimer < APEX_ACT1_DUR;
}

function isApexAct2Phase() {
  return apexActive && apexTimer >= APEX_ACT1_DUR && apexTimer < APEX_ACT2_DUR;
}

function isApexInputLocked() {
  return apexActive && apexTimer < APEX_ACT2_DUR;
}

function isApexCamBlocked(cx, cy, cz, bList) {
  if (cy < 4.0) return true;
  if (!bList) return false;
  for (let i = 0; i < bList.length; i++) {
    const b = bList[i];
    if (cy < b.bh + 3.5) {
      const hw = b.bw * 0.5 + 5.5;
      const hd = b.bd * 0.5 + 5.5;
      if (cx > b.bx - hw && cx < b.bx + hw && cz > b.bz - hd && cz < b.bz + hd) {
        return true;
      }
    }
  }
  return false;
}

function pickSafeApexOrbitArc(ancX, ancY, ancZ, startAng, rawArc, r0, r1, e0, e1, bList) {
  const testArc = (arcVal, radScale, elevAdd) => {
    for (let s = 0; s <= 4; s++) {
      const u = s / 4.0;
      const ang = startAng + arcVal * u;
      const rad = (r0 + (r1 - r0) * u) * radScale;
      const tx = ancX + Math.sin(ang) * rad;
      const ty = Math.max(4.5, ancY + e0 + (e1 - e0) * u + elevAdd);
      const tz = ancZ + Math.cos(ang) * rad;
      if (isApexCamBlocked(tx, ty, tz, bList)) return false;
    }
    return true;
  };
  if (testArc(rawArc, 1.0, 0.0)) return { arc: rawArc, radScale: 1.0, elevAdd: 0.0 };
  if (testArc(-rawArc, 1.0, 0.0)) return { arc: -rawArc, radScale: 1.0, elevAdd: 0.0 };
  if (testArc(rawArc, 0.76, 5.5)) return { arc: rawArc, radScale: 0.76, elevAdd: 5.5 };
  if (testArc(-rawArc, 0.76, 5.5)) return { arc: -rawArc, radScale: 0.76, elevAdd: 5.5 };
  return { arc: rawArc * 0.65, radScale: 0.68, elevAdd: 8.5 };
}

function pickSafeAct2Pos(lookX, lookY, lookZ, ang, dist, elev, bList) {
  const candidates = [
    { a: ang, d: dist, e: elev },
    { a: ang + Math.PI * 0.5, d: dist * 0.9, e: elev + 3.0 },
    { a: ang - Math.PI * 0.5, d: dist * 0.9, e: elev + 3.0 },
    { a: ang + Math.PI, d: dist * 0.85, e: elev + 5.0 },
    { a: ang, d: dist * 0.62, e: elev + 12.0 }
  ];
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const cx = lookX + Math.sin(c.a) * c.d;
    const cy = Math.max(5.0, lookY + c.e);
    const cz = lookZ + Math.cos(c.a) * c.d;
    if (!isApexCamBlocked(cx, cy, cz, bList)) {
      return { x: cx, y: cy, z: cz, a: c.a, d: c.d, e: c.e };
    }
  }
  return {
    x: lookX + Math.sin(ang) * (dist * 0.55),
    y: Math.max(8.0, lookY + elev + 14.0),
    z: lookZ + Math.cos(ang) * (dist * 0.55),
    a: ang, d: dist * 0.55, e: elev + 14.0
  };
}

function tryTriggerApexCut(augId, payload, forceTest = false) {
  const def = APEX_CUT_DEFS[augId];
  if (!def) return false;
  if (gameOver || augmentDraftOpen) return false;
  if (!forceTest) {
    if (openingPhase !== 'ACTIVE' || apexActive) return false;
    if (bossActive && (bossPhase === 'INTRO' || bossPhase === 'DEFEATED')) return false;
    if (getLv(augId) < MAX_AUG_LEVEL) return false;
    if (apexGlobalCd > 0.0 || (apexAugCds[augId] || 0.0) > 0.0) return false;
  } else {
    if (isOpeningCutscene()) return false;
    if (apexActive) resetApexCutState();
  }

  const w = getNearbyWorld();
  const bList = w ? w.buildings : [];
  const data = payload || {};
  const sinY = Math.sin(camYaw), cosY = Math.cos(camYaw);
  const rightX = cosY, rightZ = -sinY;

  apexActive = true;
  apexId = augId;
  if (typeof playSfx === 'function') playSfx('apex_freeze');
  apexTimer = 0.0;
  apexAct2Started = false;
  apexAct3Started = false;
  apexFlashTimer = 0.055; // Act 1 진입 2~3프레임 임팩트 스냅
  apexIsTest = !!forceTest;
  apexTestLabel = data.testLabel || '';
  apexLetterbox = 0.40;
  apexCamBlend = 1.0;

  // 쿨타임 적용 (실전 발동 시에만: 글로벌 40s · 증강별 개별 85s)
  if (!forceTest) {
    apexGlobalCd = APEX_GLOBAL_COOLDOWN;
    apexAugCds[augId] = APEX_AUG_COOLDOWN;
  }

  const targetPt = data.targetPt || {
    x: px + sinY * 13.0,
    y: Math.max(8.0, py + (augId === 'heavy_suit' ? -7.5 : 1.0)),
    z: pz + cosY * 13.0
  };

  let rawArc = 1.32; // ~75° 여유로운 3D 오빗
  let r0 = 17.5, r1 = 14.2, e0 = 1.5, e1 = 0.5;
  let startAng = camYaw + Math.PI + 0.35;
  let roll = 0.14;
  let freezeFov = 192.0;
  let releaseFov = 108.0;

  // Act 2 매치 컷 기본 파라미터
  let act2Look = { x: targetPt.x, y: targetPt.y, z: targetPt.z };
  let act2Ang = camYaw + Math.PI * 0.25;
  let act2Dist = 34.0;
  let act2Elev = 4.0;
  let act2DriftAng = 0.22;
  let act2Roll = -0.10;
  let act2Fov = 152.0;

  const hSpd = Math.hypot(vx, vz);
  const moveYaw = hSpd > 6.0 ? Math.atan2(vx, vz) : camYaw;
  const mSin = Math.sin(moveYaw), mCos = Math.cos(moveYaw);
  const extras = { targetPt: targetPt, isDummy: !!data.isDummy, moveYaw: moveYaw, mSin: mSin, mCos: mCos };

  if (augId === 'heavy_suit') {
    // 초중력 슈트: Act 1 로우 앵글 75° 오빗 -> Act 2 45m 원경 와이드 컷(수직 기압 기둥 + 3중 3D 수평 원반)
    apexAnchorX = px * 0.48 + targetPt.x * 0.52;
    apexAnchorY = Math.max(6.0, py * 0.45 + targetPt.y * 0.55);
    apexAnchorZ = pz * 0.48 + targetPt.z * 0.52;
    startAng = camYaw + Math.PI * 0.62;
    rawArc = 1.34;
    r0 = 17.5; r1 = 14.2; e0 = -5.5; e1 = -2.0;
    roll = 0.16;
    freezeFov = 196.0; releaseFov = 108.0;
    extras.dropTopY = py + 38.0;

    act2Look = { x: targetPt.x, y: Math.max(10.0, targetPt.y + 8.0), z: targetPt.z };
    act2Ang = startAng + rawArc + 0.75;
    act2Dist = 44.0;
    act2Elev = -4.0;
    act2DriftAng = 0.18;
    act2Roll = -0.06;
    act2Fov = 144.0;
  } else if (augId === 'overdrive') {
    // 오버드라이브: Act 1 측면 90°->정면 30° 80° 슬라이드 + 7중 3D 잔상 + 마하 콘 -> Act 2 정면 저각 매치 컷(초음속 통과 + 정전기 아크)
    apexAnchorX = px * 0.52 + targetPt.x * 0.48;
    apexAnchorY = py * 0.52 + targetPt.y * 0.48;
    apexAnchorZ = pz * 0.52 + targetPt.z * 0.48;
    startAng = moveYaw + Math.PI * 0.55;
    rawArc = -1.40;
    r0 = 18.5; r1 = 14.5; e0 = 1.8; e1 = -0.4;
    roll = -0.18;
    freezeFov = 188.0; releaseFov = 104.0;

    for (let gi = 1; gi <= 7; gi++) {
      afterimages.push({
        x: px - mSin * (gi * 3.2),
        y: py - Math.max(-1.4, Math.min(1.4, vy * 0.014)) * gi,
        z: pz - mCos * (gi * 3.2),
        poseKey: 'APEX_MACH',
        rot: 0,
        tone: (gi & 1),
        life: 1.85 - gi * 0.06
      });
    }

    act2Look = { x: px + mSin * 6.0, y: py + 0.5, z: pz + mCos * 6.0 };
    act2Ang = moveYaw + 0.24; // 진행 방향 정면 저각 매치 컷
    act2Dist = 26.0;
    act2Elev = -4.5;
    act2DriftAng = -0.24;
    act2Roll = 0.14;
    act2Fov = 142.0;
  } else if (augId === 'bungee_web') {
    // 고탄성 번지줄: Act 1 발아래 앙각 72° 오빗(적과의 고도차 + 장력 거미줄) -> Act 2 상공 측면 와이드 컷(장력 파동 링 + 2번 구름 상승 스윕)
    const ancPt = data.anchorPt || lastBungeeAnchorPt || { x: px + rightX * 28.0, y: py + 48.0, z: pz + sinY * 22.0 };
    apexAnchorX = px * 0.62 + targetPt.x * 0.38;
    apexAnchorY = Math.max(10.0, py * 0.62 + targetPt.y * 0.38);
    apexAnchorZ = pz * 0.62 + targetPt.z * 0.38;
    startAng = camYaw + Math.PI * 0.76;
    rawArc = 1.26;
    r0 = 16.5; r1 = 13.5; e0 = -7.5; e1 = -10.0;
    roll = -0.16;
    freezeFov = 192.0; releaseFov = 106.0;
    extras.anchorPt = ancPt;

    act2Look = { x: px, y: py + 6.0, z: pz };
    act2Ang = startAng + rawArc + 0.90;
    act2Dist = 30.0;
    act2Elev = -11.0;
    act2DriftAng = 0.22;
    act2Roll = 0.10;
    act2Fov = 146.0;
  } else if (augId === 'lasso_swing') {
    // 올가미 스윙: Act 1 3D 거미줄 구체망 외곽 80° 오빗 -> Act 2 와이드 컷(중앙 1점 압착 수축 + 대형 3D 팔각 충격 링)
    const lPts = (data.lassoPts && data.lassoPts.length > 0) ? data.lassoPts : [];
    let sx = px, sy = py, sz = pz;
    for (let i = 0; i < lPts.length; i++) {
      sx += lPts[i].x; sy += lPts[i].y; sz += lPts[i].z;
    }
    const cnt = 1 + lPts.length;
    apexAnchorX = (sx / cnt) * 0.55 + targetPt.x * 0.45;
    apexAnchorY = Math.max(8.0, (sy / cnt) * 0.55 + targetPt.y * 0.45);
    apexAnchorZ = (sz / cnt) * 0.55 + targetPt.z * 0.45;
    startAng = camYaw + Math.PI * 0.68;
    rawArc = 1.40;
    r0 = 23.0; r1 = 18.0; e0 = 6.5; e1 = 2.8;
    roll = 0.13;
    freezeFov = 182.0; releaseFov = 110.0;
    extras.lassoPts = lPts;
    extras.lassoBurstDone = false;

    act2Look = { x: targetPt.x, y: targetPt.y, z: targetPt.z };
    act2Ang = startAng + rawArc + 0.70;
    act2Dist = 38.0;
    act2Elev = 9.0;
    act2DriftAng = 0.20;
    act2Roll = -0.09;
    act2Fov = 148.0;
  } else if (augId === 'chain_pinball') {
    // 연쇄 핀볼: Act 1 상공 32m 부감 75° 오빗 -> Act 2 측면 와이드 컷(1->6 꼭짓점 순차 3D 충격 링 + 정전기 번개 점화)
    const cPts = (data.chainPts && data.chainPts.length >= 2) ? data.chainPts : [
      { x: px - sinY * 18, y: py + 4, z: pz - cosY * 18 },
      { x: px, y: py, z: pz }
    ];
    let sx = 0, sy = 0, sz = 0;
    for (let i = 0; i < cPts.length; i++) {
      sx += cPts[i].x; sy += cPts[i].y; sz += cPts[i].z;
    }
    apexAnchorX = (sx / cPts.length) * 0.55 + px * 0.45;
    apexAnchorY = Math.max(10.0, (sy / cPts.length) * 0.55 + py * 0.45);
    apexAnchorZ = (sz / cPts.length) * 0.55 + pz * 0.45;
    startAng = camYaw + Math.PI * 0.65;
    rawArc = 1.32;
    r0 = 28.0; r1 = 22.0; e0 = 15.0; e1 = 10.0;
    roll = -0.14;
    freezeFov = 174.0; releaseFov = 110.0;
    extras.chainPts = cPts;
    extras.chainSparkIdx = -1;
    // 6개 타격 지점 중 앞 5개 지점에 3D 분신 잔상 박제 (Act 1 오빗 시 3D 연쇄 궤적 강조)
    for (let ci = 0; ci < cPts.length - 1; ci++) {
      afterimages.push({
        x: cPts[ci].x,
        y: cPts[ci].y,
        z: cPts[ci].z,
        poseKey: 'STRIKE_SPIN',
        rot: ci * 0.9,
        tone: (ci & 1),
        life: 2.15 - ci * 0.06
      });
    }

    act2Look = { x: apexAnchorX, y: apexAnchorY, z: apexAnchorZ };
    act2Ang = startAng + rawArc + 0.85;
    act2Dist = 38.0;
    act2Elev = 5.0;
    act2DriftAng = -0.22;
    act2Roll = 0.11;
    act2Fov = 146.0;
  } else if (augId === 'elastic') {
    // 탄성 반발: Act 1 벽면 균열 <-> 캐릭터 <-> 적 V자 70° 오빗 -> Act 2 벽면 뒤 오버-더-숄더 컷(3겹 V자 반발 링 + 드롭킥 임팩트)
    const wallPt = data.wallPt || lastElasticWallPt || {
      x: px - rightX * 14.0 - sinY * 6.0,
      y: Math.max(8.0, py - 1.5),
      z: pz - rightZ * 14.0 - cosY * 6.0,
      nx: rightX, nz: rightZ
    };
    apexAnchorX = px * 0.50 + targetPt.x * 0.30 + wallPt.x * 0.20;
    apexAnchorY = Math.max(7.0, py * 0.55 + targetPt.y * 0.25 + wallPt.y * 0.20);
    apexAnchorZ = pz * 0.50 + targetPt.z * 0.30 + wallPt.z * 0.20;
    const wAng = Math.atan2(px - wallPt.x, pz - wallPt.z);
    startAng = wAng + 0.50;
    rawArc = 1.24;
    r0 = 18.0; r1 = 14.5; e0 = 2.2; e1 = 0.8;
    roll = 0.16;
    freezeFov = 190.0; releaseFov = 108.0;
    extras.wallPt = wallPt;

    act2Look = { x: px * 0.45 + targetPt.x * 0.55, y: py * 0.45 + targetPt.y * 0.55, z: pz * 0.45 + targetPt.z * 0.55 };
    act2Ang = Math.atan2(wallPt.x - targetPt.x, wallPt.z - targetPt.z) + 0.22;
    act2Dist = 26.0;
    act2Elev = 3.5;
    act2DriftAng = 0.20;
    act2Roll = -0.14;
    act2Fov = 152.0;
  }

  // Act 1 건물 관통 0% 안전 오빗 방향 자동 선택
  const safe = pickSafeApexOrbitArc(apexAnchorX, apexAnchorY, apexAnchorZ, startAng, rawArc, r0, r1, e0, e1, bList);
  apexStartAng = startAng;
  apexOrbitArc = safe.arc;
  apexOrbitRadius = r0 * safe.radScale;
  apexOrbitRadiusEnd = r1 * safe.radScale;
  apexStartElev = e0 + safe.elevAdd;
  apexEndElev = e1 + safe.elevAdd;
  apexTargetRoll = (safe.arc >= 0 ? Math.abs(roll) : -Math.abs(roll));
  apexFreezeFov = freezeFov;
  apexReleaseFov = releaseFov;
  apexSceneExtras = extras;

  // Act 2 매치 컷 안전 카메라 위치 사전 계산
  const safe2 = pickSafeAct2Pos(act2Look.x, act2Look.y, act2Look.z, act2Ang, act2Dist, act2Elev, bList);
  const endAng2 = safe2.a + act2DriftAng;
  apexAct2Cam = {
    x: safe2.x, y: safe2.y, z: safe2.z,
    endX: act2Look.x + Math.sin(endAng2) * (safe2.d * 0.94),
    endY: Math.max(5.0, act2Look.y + safe2.e + 1.5),
    endZ: act2Look.z + Math.cos(endAng2) * (safe2.d * 0.94),
    lookX: act2Look.x, lookY: act2Look.y, lookZ: act2Look.z,
    roll: act2Roll, fov: act2Fov
  };

  // 시작 프레임 카메라 위치 즉시 동기화 (첫 프레임 튐 방지)
  apexCamX = apexAnchorX + Math.sin(apexStartAng) * apexOrbitRadius;
  apexCamY = Math.max(4.2, apexAnchorY + apexStartElev);
  apexCamZ = apexAnchorZ + Math.cos(apexStartAng) * apexOrbitRadius;
  const dx0 = apexAnchorX - apexCamX, dy0 = apexAnchorY - apexCamY, dz0 = apexAnchorZ - apexCamZ;
  camLagYaw = Math.atan2(dx0, dz0);
  camPitch = Math.max(-1.05, Math.min(0.85, Math.atan2(dy0, Math.hypot(dx0, dz0) || 1.0)));
  camRoll = apexTargetRoll * 0.65;
  fovD = apexFreezeFov;
  return true;
}

// PC(Key X) & 모바일 상단 버튼(★CUT) 전용 6종 순환 테스트 시연기
function triggerApexTestCycle() {
  if (gameOver || augmentDraftOpen) return;
  if (openingPhase !== 'ACTIVE') {
    hasSeenRoofIntro = true;
    openingPhase = 'ACTIVE';
    openingCamBlend = 0.0;
    openingLetterbox = 0.0;
    openingCloudRush = 0.0;
    openingPoseRadial = 0.0;
    px = 0.0; py = 128.0; pz = 20.0;
    vx = 0.0; vy = 0.0; vz = 68.0;
    camYaw = 0.0;
    runTimeRemaining = RUN_DURATION;
    if (enemies.length === 0) spawnWave(wave);
  }
  const idx = apexTestCycleIdx % APEX_CUT_IDS.length;
  apexTestCycleIdx = (idx + 1) % APEX_CUT_IDS.length;
  const augId = APEX_CUT_IDS[idx];
  const def = APEX_CUT_DEFS[augId];
  if (btnApexTest) {
    btnApexTest.textContent = '★CUT ' + (idx + 1) + '/6';
  }

  const sinY = Math.sin(camYaw), cosY = Math.cos(camYaw);
  const rightX = cosY, rightZ = -sinY;
  if (py < 32.0) { py = 46.0; }
  const safeY = py;

  const payload = {
    isDummy: true,
    testLabel: 'TEST ' + (idx + 1) + '/6'
  };

  if (augId === 'heavy_suit') {
    payload.targetPt = { x: px + sinY * 5.0, y: Math.max(10.0, py - 9.0), z: pz + cosY * 5.0 };
  } else if (augId === 'overdrive') {
    payload.targetPt = { x: px + sinY * 12.0, y: py + 0.5, z: pz + cosY * 12.0 };
  } else if (augId === 'bungee_web') {
    payload.anchorPt = { x: px + rightX * 32.0 + sinY * 14.0, y: py + 52.0, z: pz + rightZ * 32.0 + cosY * 14.0 };
    payload.targetPt = { x: px + sinY * 11.0, y: Math.max(12.0, py - 4.0), z: pz + cosY * 11.0 };
  } else if (augId === 'lasso_swing') {
    payload.targetPt = { x: px + sinY * 14.0, y: py + 1.0, z: pz + cosY * 14.0 };
    const lPts = [];
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.3;
      lPts.push({
        x: px + sinY * 10.0 + Math.cos(a) * 15.0,
        y: Math.max(10.0, py + Math.sin(a * 2.0) * 7.0),
        z: pz + cosY * 10.0 + Math.sin(a) * 15.0
      });
    }
    payload.lassoPts = lPts;
  } else if (augId === 'chain_pinball') {
    const cPts = [
      { x: px - sinY * 28.0 - rightX * 15.0, y: Math.max(14.0, py - 7.0), z: pz - cosY * 28.0 - rightZ * 15.0 },
      { x: px - sinY * 20.0 + rightX * 16.0, y: Math.max(16.0, py + 8.0), z: pz - cosY * 20.0 + rightZ * 16.0 },
      { x: px - sinY * 11.0 - rightX * 17.0, y: Math.max(14.0, py - 5.0), z: pz - cosY * 11.0 - rightZ * 17.0 },
      { x: px - sinY * 4.0 + rightX * 15.0,  y: Math.max(16.0, py + 9.0), z: pz - cosY * 4.0 + rightZ * 15.0 },
      { x: px + sinY * 4.0 - rightX * 10.0,  y: Math.max(12.0, py - 2.0), z: pz + cosY * 4.0 - rightZ * 10.0 },
      { x: px, y: py, z: pz }
    ];
    payload.chainPts = cPts;
    payload.targetPt = { x: px + sinY * 8.0, y: py + 1.0, z: pz + cosY * 8.0 };
  } else if (augId === 'elastic') {
    payload.wallPt = { x: px - rightX * 16.0 - sinY * 6.0, y: Math.max(12.0, safeY - 2.0), z: pz - rightZ * 16.0 - cosY * 6.0, nx: rightX, nz: rightZ };
    payload.targetPt = { x: px + rightX * 10.0 + sinY * 11.0, y: Math.max(12.0, safeY + 2.0), z: pz + rightZ * 10.0 + cosY * 11.0 };
  }

  tryTriggerApexCut(augId, payload, true);
  if (def) {
    addPopup('[' + (idx + 1) + '/6] ' + def.name, def.col, 3);
  }
}

// Step 4 3-Act 시간 진행 & Act 1(완전 0% 정지) 제어 — true 반환 시 월드 완전 정지
function updateApexCutFreeze(rawDt) {
  if (!apexActive) return false;
  apexTimer += rawDt;
  if (apexFlashTimer > 0.0) apexFlashTimer = Math.max(0.0, apexFlashTimer - rawDt);

  // === Act 1 (0.00~1.05s): 완전 0% 시간정지 + 70°~80° 3D 시점 선회 ===
  if (apexTimer < APEX_ACT1_DUR) {
    const p = Math.max(0.0, Math.min(1.0, apexTimer / APEX_ACT1_DUR));
    const u = 1.0 - Math.pow(1.0 - p, 2.0);
    const curAng = apexStartAng + apexOrbitArc * u;
    const curRad = apexOrbitRadius + (apexOrbitRadiusEnd - apexOrbitRadius) * u;
    const curElev = apexStartElev + (apexEndElev - apexStartElev) * u;

    apexCamX = apexAnchorX + Math.sin(curAng) * curRad;
    apexCamY = Math.max(4.5, apexAnchorY + curElev);
    apexCamZ = apexAnchorZ + Math.cos(curAng) * curRad;
    apexCamBlend = 1.0;
    apexLetterbox = Math.min(1.0, apexTimer / 0.10);

    const dx = apexAnchorX - apexCamX;
    const dy = apexAnchorY - apexCamY;
    const dz = apexAnchorZ - apexCamZ;
    camLagYaw = Math.atan2(dx, dz);
    camPitch = Math.max(-1.05, Math.min(0.85, Math.atan2(dy, Math.hypot(dx, dz) || 1.0)));
    camRoll += (apexTargetRoll - camRoll) * Math.min(1.0, 8.0 * rawDt);
    fovD += (apexFreezeFov - fovD) * Math.min(1.0, 8.0 * rawDt);
    return true;
  }

  // === Act 1 -> Act 2 진입 1회 트리거 (매치 컷 + 3D 물리 이펙트 점화) ===
  if (!apexAct2Started) {
    apexAct2Started = true;
    apexFlashTimer = 0.055; // 매치 컷 2프레임 임팩트 스냅
    if (typeof playSfx === 'function') playSfx('apex_release');
    const def = APEX_CUT_DEFS[apexId];
    const accCol = def ? def.col : PAL.GOLD;
    const tPt = (apexSceneExtras && apexSceneExtras.targetPt) ? apexSceneExtras.targetPt : { x: px, y: py, z: pz };
    shakeMag = Math.max(shakeMag, 4.8);
    spawnSparks(tPt.x, tPt.y, tPt.z, accCol, 16, 46);
    if (apexId === 'heavy_suit') {
      shakeMag = Math.max(shakeMag, 6.4);
      spawnSparks(tPt.x, tPt.y, tPt.z, PAL.GOLD, 20, 62);
      shockwaves.push({ x: tPt.x, y: tPt.y, z: tPt.z, r: 8, maxR: 130, life: 0.90, maxLife: 0.90, col: PAL.ORANGE });
    } else if (apexId === 'overdrive') {
      shakeMag = Math.max(shakeMag, 5.8);
      const mSin = apexSceneExtras ? apexSceneExtras.mSin : Math.sin(camYaw);
      const mCos = apexSceneExtras ? apexSceneExtras.mCos : Math.cos(camYaw);
      const rxO = mCos, rzO = -mSin;
      spawnLightningBolt(px - mSin * 26, py, pz - mCos * 26, tPt.x + mSin * 18, tPt.y, tPt.z + mCos * 18, PAL.NEON_PINK, 0.62);
      spawnLightningBolt(px - mSin * 18 + rxO * 4, py + 3.5, pz - mCos * 18 + rzO * 4, tPt.x + mSin * 14 - rxO * 3, tPt.y - 2.5, tPt.z + mCos * 14 - rzO * 3, '#ffffff', 0.56);
      spawnLightningBolt(px - mSin * 20 - rxO * 4, py - 3.0, pz - mCos * 20 - rzO * 4, tPt.x + mSin * 12 + rxO * 3, tPt.y + 3.0, tPt.z + mCos * 12 + rzO * 3, PAL.NEON_CYAN, 0.54);
      spawnLightningBolt(px - mSin * 12, py + 5.0, pz - mCos * 12, tPt.x + mSin * 16, tPt.y - 4.0, tPt.z + mCos * 16, PAL.GOLD, 0.50);
    } else if (apexId === 'bungee_web') {
      shakeMag = Math.max(shakeMag, 5.4);
      spawnSparks(px, py, pz, PAL.GOLD, 22, 58);
      shockwaves.push({ x: px, y: py, z: pz, r: 8, maxR: 105, life: 0.78, maxLife: 0.78, col: PAL.GOLD });
    } else if (apexId === 'elastic' && apexSceneExtras && apexSceneExtras.wallPt) {
      shakeMag = Math.max(shakeMag, 5.8);
      const wp = apexSceneExtras.wallPt;
      spawnSparks(wp.x, wp.y, wp.z, PAL.EMERALD, 20, 56);
      spawnLightningBolt(wp.x, wp.y, wp.z, px, py, pz, PAL.EMERALD, 0.62);
      spawnLightningBolt(wp.x, wp.y + 3.0, wp.z, px, py - 2.0, pz, '#ffffff', 0.54);
      spawnLightningBolt(px, py, pz, tPt.x, tPt.y, tPt.z, '#ffffff', 0.62);
      spawnLightningBolt(px, py + 2.5, pz, tPt.x, tPt.y - 2.5, tPt.z, PAL.EMERALD, 0.54);
    }
    if (apexAct2Cam) {
      apexCamX = apexAct2Cam.x;
      apexCamY = apexAct2Cam.y;
      apexCamZ = apexAct2Cam.z;
    }
  }

  // === Act 2 -> Act 3 진입 1회 트리거 (100% 원속 재개 + 안전 무적 0.80s + 드라이브바이) ===
  if (apexTimer >= APEX_ACT2_DUR && !apexAct3Started) {
    apexAct3Started = true;
    apexHoldCamX = apexCamX;
    apexHoldCamY = apexCamY;
    apexHoldCamZ = apexCamZ;
    const def = APEX_CUT_DEFS[apexId];
    invulnTimer = Math.max(invulnTimer, 0.80);
    clearProjectilesInRadius(px, py, pz, 28.0, def ? def.col : PAL.GOLD);
    if (py < 12.0 && vy < 10.0) {
      vy = Math.max(vy, 24.0);
    }
    if (apexId === 'bungee_web' || apexId === 'heavy_suit' || apexId === 'lasso_swing') {
      doingFlip = true;
      flipAngle = 0.0;
    }
    if (apexIsTest) {
      const sinY = Math.sin(camYaw), cosY = Math.cos(camYaw);
      if (apexId === 'overdrive') {
        vx = sinY * 148.0; vz = cosY * 148.0; vy = Math.max(vy, 10.0);
      } else if (apexId === 'bungee_web') {
        vx = sinY * 64.0; vz = cosY * 64.0; vy = 88.0;
      } else if (apexId === 'heavy_suit') {
        vx = sinY * 50.0; vz = cosY * 50.0; vy = 56.0;
      } else if (apexId === 'elastic') {
        vx = sinY * 104.0; vz = cosY * 104.0; vy = 34.0;
      } else {
        vx = sinY * 82.0; vz = cosY * 82.0; vy = Math.max(vy, 38.0);
      }
    }
  }
  return false;
}

// Act 2 (1.05~2.05s 매치 컷 카메라) & Act 3 (2.05~3.00s 드라이브바이 지연 추격 -> 3인칭 스냅백)
function applyApexReleaseCamera(rawDt) {
  if (!apexActive || apexTimer < APEX_ACT1_DUR) return;

  // === Act 2 (1.05~2.05s): 매치 컷 앵글 유지 + 미세 드리프트 + 순차 물리 이펙트 점화 ===
  if (apexTimer < APEX_ACT2_DUR) {
    const p2 = Math.max(0.0, Math.min(1.0, (apexTimer - APEX_ACT1_DUR) / (APEX_ACT2_DUR - APEX_ACT1_DUR)));
    if (apexAct2Cam) {
      apexCamX = apexAct2Cam.x + (apexAct2Cam.endX - apexAct2Cam.x) * p2;
      apexCamY = apexAct2Cam.y + (apexAct2Cam.endY - apexAct2Cam.y) * p2;
      apexCamZ = apexAct2Cam.z + (apexAct2Cam.endZ - apexAct2Cam.z) * p2;
      const lx = apexAct2Cam.lookX * 0.65 + px * 0.35;
      const ly = apexAct2Cam.lookY * 0.65 + py * 0.35;
      const lz = apexAct2Cam.lookZ * 0.65 + pz * 0.35;
      const dx = lx - apexCamX, dy = ly - apexCamY, dz = lz - apexCamZ;
      camLagYaw = Math.atan2(dx, dz);
      camPitch = Math.max(-1.05, Math.min(0.85, Math.atan2(dy, Math.hypot(dx, dz) || 1.0)));
      camRoll = apexAct2Cam.roll;
      fovD = apexAct2Cam.fov - p2 * 14.0;
    }
    apexCamBlend = 1.0;
    apexLetterbox = 1.0;

    // 올가미 스윙: 중앙 수축 완료 시점(p2 >= 0.42) 임팩트 스냅 + 3D 폭발 스파크
    if (apexId === 'lasso_swing' && apexSceneExtras && !apexSceneExtras.lassoBurstDone && p2 >= 0.42) {
      apexSceneExtras.lassoBurstDone = true;
      apexFlashTimer = 0.05;
      const tp = apexSceneExtras.targetPt || { x: px, y: py, z: pz };
      shakeMag = Math.max(shakeMag, 5.8);
      spawnSparks(tp.x, tp.y, tp.z, PAL.GOLD, 18, 55);
      shockwaves.push({ x: tp.x, y: tp.y, z: tp.z, r: 8, maxR: 135, life: 0.55, maxLife: 0.55, col: '#d8b4fe' });
    }
    // 연쇄 핀볼: 0.11s 간격으로 6개 꼭짓점 순차 정전기 번개 점화
    if (apexId === 'chain_pinball' && apexSceneExtras && apexSceneExtras.chainPts) {
      const cPts = apexSceneExtras.chainPts;
      const wantIdx = Math.min(cPts.length - 1, Math.floor(p2 / 0.14));
      while (apexSceneExtras.chainSparkIdx < wantIdx) {
        apexSceneExtras.chainSparkIdx++;
        const k = apexSceneExtras.chainSparkIdx;
        const pt = cPts[k];
        spawnSparks(pt.x, pt.y, pt.z, k === cPts.length - 1 ? PAL.GOLD : PAL.NEON_PINK, 10, 34);
        if (k > 0) {
          const prev = cPts[k - 1];
          spawnLightningBolt(prev.x, prev.y, prev.z, pt.x, pt.y, pt.z, k === cPts.length - 1 ? PAL.GOLD : PAL.NEON_PINK, 0.34);
        }
        if (k === cPts.length - 1) {
          shakeMag = Math.max(shakeMag, 5.2);
          shockwaves.push({ x: pt.x, y: pt.y, z: pt.z, r: 6, maxR: 95, life: 0.45, maxLife: 0.45, col: PAL.GOLD });
        }
      }
    }
    return;
  }

  // === Act 3 (2.05~3.00s): 100% 원속 재개 + 드라이브바이 지연 추격 -> 3인칭 스냅백 ===
  const relDur = Math.max(0.05, APEX_TOTAL_DUR - APEX_ACT2_DUR);
  const p = Math.max(0.0, Math.min(1.0, (apexTimer - APEX_ACT2_DUR) / relDur));

  const lagFollow = p < 0.40 ? 1.5 : 7.8;
  const sinY = Math.sin(camYaw), cosY = Math.cos(camYaw);
  const wantBackX = px - sinY * 14.0;
  const wantBackY = Math.max(4.5, py + 3.5);
  const wantBackZ = pz - cosY * 14.0;
  apexHoldCamX += (wantBackX - apexHoldCamX) * Math.min(1.0, lagFollow * rawDt);
  apexHoldCamY += (wantBackY - apexHoldCamY) * Math.min(1.0, lagFollow * rawDt);
  apexHoldCamZ += (wantBackZ - apexHoldCamZ) * Math.min(1.0, lagFollow * rawDt);

  apexCamX = apexHoldCamX;
  apexCamY = apexHoldCamY;
  apexCamZ = apexHoldCamZ;

  const snapT = p < 0.40 ? 0.0 : ((p - 0.40) / 0.60);
  const easeOut = 1.0 - (1.0 - snapT) * (1.0 - snapT);
  apexCamBlend = 1.0 - easeOut;
  apexLetterbox = Math.max(0.0, 1.0 - easeOut);

  const dx = px - apexCamX, dy = (py + 1.0) - apexCamY, dz = pz - apexCamZ;
  const trackYaw = Math.atan2(dx, dz);
  const trackPitch = Math.max(-0.98, Math.min(0.75, Math.atan2(dy, Math.hypot(dx, dz) || 1.0)));
  let yawDiff = (trackYaw - camLagYaw + Math.PI) % (2 * Math.PI) - Math.PI;
  if (yawDiff < -Math.PI) yawDiff += 2 * Math.PI;
  camLagYaw += yawDiff * apexCamBlend * Math.min(1.0, 14.0 * rawDt);
  camPitch = camPitch + (trackPitch - camPitch) * apexCamBlend;
  camRoll = camRoll * (1.0 - apexCamBlend) + (apexTargetRoll * 0.22 * (1.0 - p)) * apexCamBlend;
  fovD = fovD + (apexReleaseFov - fovD) * apexCamBlend * Math.min(1.0, 14.0 * rawDt);

  if (apexTimer >= APEX_TOTAL_DUR) {
    apexActive = false;
    apexCamBlend = 0.0;
    apexLetterbox = 0.0;
    apexAct2Cam = null;
    apexSceneExtras = null;
    apexIsTest = false;
  }
}
