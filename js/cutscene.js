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
// [Step 4] 플레이 방식 변혁 6종 증강 Lv.3(★각성) 5.0초 4-Act 불릿타임 3D 컷씬 엔진
// - Act 1 (0.00~0.90s): [기] 0% 시간정지 · 초근접 망원 포즈 컷인 (#6 탄성 반발은 1차 충돌 직후 즉시 빠른 공중 튕김!)
// - Act 2 (0.90~2.35s): [승] 0% 시간정지 · 매치 컷 줌아웃 95°~115° 3D 시점 선회 (총 2.35s 정지)
// - Act 3 (2.35~3.85s): [전] 0.10x 극저속 슬로우 · 대조 매치 컷 앵글 + 2단계 비마법적 3D 물리 클라이맥스
// - Act 4 (3.85~5.00s): [결] 100% 원속 해방 + 드라이브바이 지연 추격 + 광각 스냅백 (0.90s 무적)
// - 100% 수동 STRIKE(Shift) 적중 트리거 · 순수 연출 중심 (추가 딜 0 / 스킵 불가)
// =========================================================================
function resetApexCutState() {
  apexActive = false;
  apexId = '';
  apexTimer = 0.0;
  apexLetterbox = 0.0;
  apexCamBlend = 0.0;
  apexAct1Cam = null;
  apexAct3Cam = null;
  apexAct2Started = false;
  apexAct3Started = false;
  apexAct4Started = false;
  apexFlashTimer = 0.0;
  apexIsTest = false;
  apexTestLabel = '';
  apexSceneExtras = null;
  apexPlayerDrawOff.x = 0.0;
  apexPlayerDrawOff.y = 0.0;
  apexPlayerDrawOff.z = 0.0;
  lastElasticWallPt = null;
  lastBungeeAnchorPt = null;
  bungeeApexTimer = 0.0;
  chainPathPts = [];
}

function isApexFreezePhase() {
  return apexActive && apexTimer < APEX_ACT2_DUR;
}

function isApexSlowPhase() {
  return apexActive && apexTimer >= APEX_ACT2_DUR && apexTimer < APEX_ACT3_DUR;
}

function isApexInputLocked() {
  return apexActive && apexTimer < APEX_ACT3_DUR;
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
    for (let s = 0; s <= 5; s++) {
      const u = s / 5.0;
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
  if (testArc(rawArc, 0.78, 6.0)) return { arc: rawArc, radScale: 0.78, elevAdd: 6.0 };
  if (testArc(-rawArc, 0.78, 6.0)) return { arc: -rawArc, radScale: 0.78, elevAdd: 6.0 };
  return { arc: rawArc * 0.68, radScale: 0.70, elevAdd: 9.0 };
}

function pickSafeApexCamPos(lookX, lookY, lookZ, ang, dist, elev, bList) {
  const candidates = [
    { a: ang, d: dist, e: elev },
    { a: ang + Math.PI * 0.5, d: dist * 0.92, e: elev + 2.5 },
    { a: ang - Math.PI * 0.5, d: dist * 0.92, e: elev + 2.5 },
    { a: ang + Math.PI, d: dist * 0.88, e: elev + 4.0 },
    { a: ang, d: dist * 0.65, e: elev + 10.0 }
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
    x: lookX + Math.sin(ang) * (dist * 0.58),
    y: Math.max(8.0, lookY + elev + 12.0),
    z: lookZ + Math.cos(ang) * (dist * 0.58),
    a: ang, d: dist * 0.58, e: elev + 12.0
  };
}

// #6 탄성 반발: 시각 전용 공중 반발/수축 오프셋 동기화 (실제 px/py/pz 불변 · 지면 관통 방지)
function syncElasticVisualPositions(stretchVal) {
  if (!apexSceneExtras || !apexSceneExtras.recoilDir) return;
  const rd = apexSceneExtras.recoilDir;
  const maxSep = apexSceneExtras.maxSep || 15.5;
  const d = maxSep * stretchVal;
  let dyP = rd.y * d;
  if (py + dyP < 5.5) dyP = 5.5 - py;
  apexPlayerDrawOff.x = rd.x * d;
  apexPlayerDrawOff.y = dyP;
  apexPlayerDrawOff.z = rd.z * d;

  const mp = apexSceneExtras.midPt;
  let ey = mp.y - rd.y * d;
  if (ey < 5.5) ey = 5.5;
  apexSceneExtras.elasticStretch = stretchVal;
  apexSceneExtras.enemyVisPt = {
    x: mp.x - rd.x * d,
    y: ey,
    z: mp.z - rd.z * d
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
  apexAct4Started = false;
  apexFlashTimer = 0.055; // Act 1 진입 2~3프레임 임팩트 스냅
  apexIsTest = !!forceTest;
  apexTestLabel = data.testLabel || '';
  apexLetterbox = 0.45;
  apexCamBlend = 1.0;
  apexPlayerDrawOff.x = 0.0;
  apexPlayerDrawOff.y = 0.0;
  apexPlayerDrawOff.z = 0.0;

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

  // Act 1 초근접 망원 포즈 컷인 기본값 (#6 탄성 반발은 전용 중거리 반발 앵글 사용)
  let act1Look = { x: px, y: py + 0.5, z: pz };
  let act1Ang = camYaw + 0.45;
  let act1Dist0 = 8.2, act1Dist1 = 6.8;
  let act1Elev = -1.2;
  let act1Drift = 0.12;
  let act1Roll = 0.24;
  let act1Fov0 = 214.0, act1Fov1 = 228.0;

  // Act 2 95°~115° 3D 불릿타임 오빗 기본값
  let rawArc = 1.82; // ~104°
  let r0 = 20.5, r1 = 15.2, e0 = 1.8, e1 = 0.6;
  let startAng = camYaw + Math.PI + 0.35;
  let roll = 0.16;
  let freezeFov = 192.0;
  let releaseFov = 108.0;

  // Act 3 대조 매치 컷 클라이맥스 기본값
  let act3Look = { x: targetPt.x, y: targetPt.y, z: targetPt.z };
  let act3Ang = camYaw + Math.PI * 0.25;
  let act3Dist = 36.0;
  let act3Elev = 4.0;
  let act3DriftAng = 0.24;
  let act3Roll = -0.12;
  let act3Fov = 150.0;

  const hSpd = Math.hypot(vx, vz);
  const moveYaw = hSpd > 6.0 ? Math.atan2(vx, vz) : camYaw;
  const mSin = Math.sin(moveYaw), mCos = Math.cos(moveYaw);
  const extras = { targetPt: targetPt, isDummy: !!data.isDummy, moveYaw: moveYaw, mSin: mSin, mCos: mCos };

  if (augId === 'heavy_suit') {
    // #1 초중력 슈트: Act 1 초근접 로우 컷인 -> Act 2 105° 수직축 오빗 -> Act 3 48m 원경 와이드 2단계 대기 압착 기둥
    act1Look = { x: px, y: py - 0.5, z: pz };
    act1Ang = camYaw + 0.52;
    act1Dist0 = 8.4; act1Dist1 = 6.8; act1Elev = -2.4; act1Drift = 0.14; act1Roll = 0.24;
    act1Fov0 = 216.0; act1Fov1 = 232.0;

    apexAnchorX = px * 0.48 + targetPt.x * 0.52;
    apexAnchorY = Math.max(6.0, py * 0.45 + targetPt.y * 0.55);
    apexAnchorZ = pz * 0.48 + targetPt.z * 0.52;
    startAng = camYaw + Math.PI * 0.58;
    rawArc = 1.84; // ~105°
    r0 = 21.0; r1 = 15.5; e0 = -6.0; e1 = -2.0;
    roll = 0.17;
    freezeFov = 196.0; releaseFov = 108.0;
    extras.dropTopY = py + 42.0;
    extras.heavyBlastDone = false;

    act3Look = { x: targetPt.x, y: Math.max(10.0, targetPt.y + 9.0), z: targetPt.z };
    act3Ang = startAng + rawArc + 0.72;
    act3Dist = 48.0;
    act3Elev = -4.5;
    act3DriftAng = 0.20;
    act3Roll = -0.07;
    act3Fov = 142.0;
  } else if (augId === 'overdrive') {
    // #2 오버드라이브: Act 1 전방 초근접 컷인 -> Act 2 110° 7중 잔상 오빗 -> Act 3 정면 저각 2단계 X-일섬 + 6다발 번개
    act1Look = { x: px, y: py + 0.2, z: pz };
    act1Ang = moveYaw + 0.42;
    act1Dist0 = 8.0; act1Dist1 = 6.6; act1Elev = -1.2; act1Drift = -0.15; act1Roll = -0.24;
    act1Fov0 = 216.0; act1Fov1 = 230.0;

    apexAnchorX = px * 0.52 + targetPt.x * 0.48;
    apexAnchorY = py * 0.52 + targetPt.y * 0.48;
    apexAnchorZ = pz * 0.52 + targetPt.z * 0.48;
    startAng = moveYaw + Math.PI * 0.58;
    rawArc = -1.92; // ~110°
    r0 = 20.5; r1 = 15.0; e0 = 2.0; e1 = -0.6;
    roll = -0.18;
    freezeFov = 188.0; releaseFov = 104.0;
    extras.overdriveSlash2Done = false;

    for (let gi = 1; gi <= 7; gi++) {
      afterimages.push({
        x: px - mSin * (gi * 3.2),
        y: py - Math.max(-1.4, Math.min(1.4, vy * 0.014)) * gi,
        z: pz - mCos * (gi * 3.2),
        poseKey: 'APEX_MACH',
        rot: 0,
        tone: (gi & 1),
        life: 3.45 - gi * 0.07
      });
    }

    act3Look = { x: px + mSin * 6.0, y: py + 0.5, z: pz + mCos * 6.0 };
    act3Ang = moveYaw + 0.24;
    act3Dist = 28.0;
    act3Elev = -4.8;
    act3DriftAng = -0.26;
    act3Roll = 0.16;
    act3Fov = 142.0;
  } else if (augId === 'bungee_web') {
    // #3 고탄성 번지줄: Act 1 발아래 초근접 앙각 컷인 -> Act 2 100° 앙각 오빗 -> Act 3 스냅 절단 + 12개 2번 구름 돌파
    const ancPt = data.anchorPt || lastBungeeAnchorPt || { x: px + rightX * 28.0, y: py + 48.0, z: pz + sinY * 22.0 };
    act1Look = { x: px, y: py + 0.6, z: pz };
    act1Ang = camYaw + 0.62;
    act1Dist0 = 8.0; act1Dist1 = 6.7; act1Elev = -3.2; act1Drift = 0.14; act1Roll = -0.22;
    act1Fov0 = 212.0; act1Fov1 = 226.0;

    apexAnchorX = px * 0.62 + targetPt.x * 0.38;
    apexAnchorY = Math.max(10.0, py * 0.62 + targetPt.y * 0.38);
    apexAnchorZ = pz * 0.62 + targetPt.z * 0.38;
    startAng = camYaw + Math.PI * 0.72;
    rawArc = 1.75; // ~100°
    r0 = 19.0; r1 = 14.5; e0 = -8.5; e1 = -11.5;
    roll = -0.17;
    freezeFov = 192.0; releaseFov = 106.0;
    extras.anchorPt = ancPt;
    extras.bungeeBurstDone = false;

    act3Look = { x: px, y: py + 6.5, z: pz };
    act3Ang = startAng + rawArc + 0.85;
    act3Dist = 32.0;
    act3Elev = -12.0;
    act3DriftAng = 0.24;
    act3Roll = 0.11;
    act3Fov = 146.0;
  } else if (augId === 'lasso_swing') {
    // #4 올가미 스윙: Act 1 양손 결박 초근접 컷인 -> Act 2 115° 3D 거미줄 구체망 오빗 -> Act 3 0.60s 압착 + 0.90s 대파열
    const lPts = (data.lassoPts && data.lassoPts.length > 0) ? data.lassoPts : [];
    act1Look = { x: px, y: py + 0.4, z: pz };
    act1Ang = camYaw + 0.48;
    act1Dist0 = 8.2; act1Dist1 = 6.8; act1Elev = -1.0; act1Drift = 0.14; act1Roll = 0.23;
    act1Fov0 = 214.0; act1Fov1 = 228.0;

    let sx = px, sy = py, sz = pz;
    for (let i = 0; i < lPts.length; i++) {
      sx += lPts[i].x; sy += lPts[i].y; sz += lPts[i].z;
    }
    const cnt = 1 + lPts.length;
    apexAnchorX = (sx / cnt) * 0.55 + targetPt.x * 0.45;
    apexAnchorY = Math.max(8.0, (sy / cnt) * 0.55 + targetPt.y * 0.45);
    apexAnchorZ = (sz / cnt) * 0.55 + targetPt.z * 0.45;
    startAng = camYaw + Math.PI * 0.64;
    rawArc = 2.00; // ~115°
    r0 = 25.0; r1 = 19.0; e0 = 7.0; e1 = 3.0;
    roll = 0.14;
    freezeFov = 182.0; releaseFov = 110.0;
    extras.lassoPts = lPts;
    extras.lassoBurstDone = false;

    act3Look = { x: targetPt.x, y: targetPt.y, z: targetPt.z };
    act3Ang = startAng + rawArc + 0.65;
    act3Dist = 40.0;
    act3Elev = 10.0;
    act3DriftAng = 0.22;
    act3Roll = -0.10;
    act3Fov = 148.0;
  } else if (augId === 'chain_pinball') {
    // #5 연쇄 핀볼: Act 1 6타 지점 초근접 컷인 -> Act 2 105° 30m 상공 부감 오빗 -> Act 3 1->6 순차 번개 릴레이 + 피날레
    const cPts = (data.chainPts && data.chainPts.length >= 2) ? data.chainPts : [
      { x: px - sinY * 18, y: py + 4, z: pz - cosY * 18 },
      { x: px, y: py, z: pz }
    ];
    act1Look = { x: px, y: py + 0.3, z: pz };
    act1Ang = camYaw + 0.50;
    act1Dist0 = 8.2; act1Dist1 = 6.8; act1Elev = 1.4; act1Drift = -0.14; act1Roll = -0.23;
    act1Fov0 = 212.0; act1Fov1 = 226.0;

    let sx = 0, sy = 0, sz = 0;
    for (let i = 0; i < cPts.length; i++) {
      sx += cPts[i].x; sy += cPts[i].y; sz += cPts[i].z;
    }
    apexAnchorX = (sx / cPts.length) * 0.55 + px * 0.45;
    apexAnchorY = Math.max(10.0, (sy / cPts.length) * 0.55 + py * 0.45);
    apexAnchorZ = (sz / cPts.length) * 0.55 + pz * 0.45;
    startAng = camYaw + Math.PI * 0.62;
    rawArc = 1.84; // ~105°
    r0 = 30.0; r1 = 23.0; e0 = 16.0; e1 = 11.0;
    roll = -0.15;
    freezeFov = 174.0; releaseFov = 110.0;
    extras.chainPts = cPts;
    extras.chainSparkIdx = -1;
    // 6개 타격 지점 중 앞 5개 지점에 3D 분신 잔상 박제 (5초 컷신 유지)
    for (let ci = 0; ci < cPts.length - 1; ci++) {
      afterimages.push({
        x: cPts[ci].x,
        y: cPts[ci].y,
        z: cPts[ci].z,
        poseKey: 'STRIKE_SPIN',
        rot: ci * 0.9,
        tone: (ci & 1),
        life: 3.65 - ci * 0.08
      });
    }

    act3Look = { x: apexAnchorX, y: apexAnchorY, z: apexAnchorZ };
    act3Ang = startAng + rawArc + 0.80;
    act3Dist = 40.0;
    act3Elev = 5.5;
    act3DriftAng = -0.24;
    act3Roll = 0.12;
    act3Fov = 146.0;
  } else if (augId === 'elastic') {
    // #6 탄성 반발 (벽 0%, 줄 붙이는 근접 컷신 0%):
    // Act 1 1차 공중 충돌 직후 즉시 양방향 빠른 튕김 -> Act 2 105° 오빗 + 탄성 한계 "쪼기" -> Act 3 "팡!" 릴리즈 초고속 수축 + 2차 공중 정면 대충돌!
    const midPt = { x: px, y: Math.max(12.0, py), z: pz };
    let rdx = px - targetPt.x;
    let rdy = (py - targetPt.y) * 0.25;
    let rdz = pz - targetPt.z;
    const rLen = Math.hypot(rdx, rdy, rdz);
    if (rLen > 1.5) {
      rdx /= rLen; rdy = Math.max(-0.18, Math.min(0.18, rdy / rLen)); rdz /= rLen;
    } else {
      rdx = rightX * 0.82 - sinY * 0.56;
      rdy = 0.12;
      rdz = rightZ * 0.82 - cosY * 0.56;
    }
    const rn = Math.hypot(rdx, rdy, rdz) || 1.0;
    rdx /= rn; rdy /= rn; rdz /= rn;

    // 반발 축에 수직인 측면 방향 (양쪽 튕겨나가는 스파이더맨과 적 + 늘어나는 탄성줄이 화면 가로로 시원하게 펼쳐짐)
    const axisAng = Math.atan2(rdx, rdz);
    const sideAng = axisAng + Math.PI * 0.5;

    // Act 1: 근접 컷신 없이 바로 중거리 측면에서 살짝 줌아웃하며 1차 충돌 직후 빠른 튕김 전체를 포착!
    act1Look = { x: midPt.x, y: midPt.y, z: midPt.z };
    act1Ang = sideAng - 0.18;
    act1Dist0 = 19.5; act1Dist1 = 25.5; act1Elev = 2.2; act1Drift = 0.18; act1Roll = 0.16;
    act1Fov0 = 186.0; act1Fov1 = 172.0;

    apexAnchorX = midPt.x;
    apexAnchorY = midPt.y;
    apexAnchorZ = midPt.z;
    startAng = sideAng + 0.05;
    rawArc = 1.84; // ~105° 한계 쪼기 오빗
    r0 = 26.5; r1 = 21.5; e0 = 2.8; e1 = 1.2;
    roll = 0.14;
    freezeFov = 178.0; releaseFov = 106.0;

    extras.midPt = midPt;
    extras.recoilDir = { x: rdx, y: rdy, z: rdz };
    extras.maxSep = 15.5; // 양측 합계 31m까지 팽팽하게 늘어남
    extras.elasticStretch = 0.0;
    extras.enemyVisPt = { x: midPt.x, y: midPt.y, z: midPt.z };
    extras.recoilGhostCount = 0;
    extras.snapGhostCount = 0;
    extras.clash2Done = false;
    extras.clash2Time = 0.38; // Act 3 시작 후 0.38s에 2차 공중 정면 대충돌
    extras.nextTensionSparkT = 0.0;

    // 1차 충돌 즉시 스파크 분출
    spawnSparks(midPt.x, midPt.y, midPt.z, PAL.EMERALD, 16, 48);
    shakeMag = Math.max(shakeMag, 4.4);

    // Act 3: 대조 측면 매치 컷에서 수축 → 2차 공중 정면 대충돌 포착
    act3Look = { x: midPt.x, y: midPt.y, z: midPt.z };
    act3Ang = sideAng - 0.25;
    act3Dist = 28.5;
    act3Elev = 3.2;
    act3DriftAng = -0.22;
    act3Roll = -0.15;
    act3Fov = 158.0;
  }

  // Act 1 안전 카메라 사전 계산
  const safe1 = pickSafeApexCamPos(act1Look.x, act1Look.y, act1Look.z, act1Ang, act1Dist0, act1Elev, bList);
  const endAng1 = safe1.a + act1Drift;
  const distRatio1 = act1Dist0 > 0.1 ? (act1Dist1 / act1Dist0) : 0.85;
  apexAct1Cam = {
    x: safe1.x, y: safe1.y, z: safe1.z,
    endX: act1Look.x + Math.sin(endAng1) * (safe1.d * distRatio1),
    endY: Math.max(4.5, act1Look.y + safe1.e),
    endZ: act1Look.z + Math.cos(endAng1) * (safe1.d * distRatio1),
    lookX: act1Look.x, lookY: act1Look.y, lookZ: act1Look.z,
    roll: act1Roll, fov0: act1Fov0, fov1: act1Fov1
  };

  // Act 2 건물 관통 0% 안전 95°~115° 오빗 방향 자동 선택
  const safe2 = pickSafeApexOrbitArc(apexAnchorX, apexAnchorY, apexAnchorZ, startAng, rawArc, r0, r1, e0, e1, bList);
  apexStartAng = startAng;
  apexOrbitArc = safe2.arc;
  apexOrbitRadius = r0 * safe2.radScale;
  apexOrbitRadiusEnd = r1 * safe2.radScale;
  apexStartElev = e0 + safe2.elevAdd;
  apexEndElev = e1 + safe2.elevAdd;
  apexTargetRoll = (safe2.arc >= 0 ? Math.abs(roll) : -Math.abs(roll));
  apexFreezeFov = freezeFov;
  apexReleaseFov = releaseFov;
  apexSceneExtras = extras;

  // Act 3 대조 매치 컷 안전 카메라 위치 사전 계산
  const safe3 = pickSafeApexCamPos(act3Look.x, act3Look.y, act3Look.z, act3Ang, act3Dist, act3Elev, bList);
  const endAng3 = safe3.a + act3DriftAng;
  apexAct3Cam = {
    x: safe3.x, y: safe3.y, z: safe3.z,
    endX: act3Look.x + Math.sin(endAng3) * (safe3.d * 0.94),
    endY: Math.max(5.0, act3Look.y + safe3.e + 1.5),
    endZ: act3Look.z + Math.cos(endAng3) * (safe3.d * 0.94),
    lookX: act3Look.x, lookY: act3Look.y, lookZ: act3Look.z,
    roll: act3Roll, fov: act3Fov
  };

  // 시작 프레임 Act 1 카메라 위치 즉시 동기화 (첫 프레임 튐 방지)
  apexCamX = apexAct1Cam.x;
  apexCamY = apexAct1Cam.y;
  apexCamZ = apexAct1Cam.z;
  const dx0 = apexAct1Cam.lookX - apexCamX, dy0 = apexAct1Cam.lookY - apexCamY, dz0 = apexAct1Cam.lookZ - apexCamZ;
  camLagYaw = Math.atan2(dx0, dz0);
  camPitch = Math.max(-1.05, Math.min(0.85, Math.atan2(dy0, Math.hypot(dx0, dz0) || 1.0)));
  camRoll = apexAct1Cam.roll;
  fovD = apexAct1Cam.fov0;
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
    // 벽 없음: 공중 1차 충돌 직후 적과 반대 방향으로 튕겨 나갈 방향 설정용 targetPt
    payload.targetPt = { x: px - rightX * 10.0 + sinY * 6.0, y: Math.max(14.0, safeY - 1.5), z: pz - rightZ * 10.0 + cosY * 6.0 };
  }

  tryTriggerApexCut(augId, payload, true);
  if (def) {
    addPopup('[' + (idx + 1) + '/6] ' + def.name, def.col, 3);
  }
}

// Step 4 4-Act 시간 진행 & Act 1~2(완전 0% 정지, 총 2.35s) 제어 — true 반환 시 월드 완전 정지
function updateApexCutFreeze(rawDt) {
  if (!apexActive) return false;
  apexTimer += rawDt;
  if (apexFlashTimer > 0.0) apexFlashTimer = Math.max(0.0, apexFlashTimer - rawDt);

  // === Act 1 (0.00~0.90s): [기] 0% 정지 · 초근접 망원 포즈 컷인 (#6 탄성 반발은 즉시 빠른 공중 튕김) ===
  if (apexTimer < APEX_ACT1_DUR) {
    const p1 = Math.max(0.0, Math.min(1.0, apexTimer / APEX_ACT1_DUR));
    const u1 = 1.0 - Math.pow(1.0 - p1, 2.2);

    // #6 탄성 반발: 근접 컷신 없이 1차 충돌 직후 즉시 양방향 빠른 튕김 (0 -> 0.78 fast cubic ease-out)
    if (apexId === 'elastic' && apexSceneExtras) {
      const rProg = Math.max(0.0, Math.min(1.0, (apexTimer - 0.04) / (APEX_ACT1_DUR - 0.04)));
      const stretch = 0.78 * (1.0 - Math.pow(1.0 - rProg, 3.0));
      syncElasticVisualPositions(stretch);
      if (apexSceneExtras.recoilGhostCount === 0 && rProg >= 0.14) {
        apexSceneExtras.recoilGhostCount = 1;
        afterimages.push({
          x: px + apexPlayerDrawOff.x, y: py + apexPlayerDrawOff.y, z: pz + apexPlayerDrawOff.z,
          poseKey: 'APEX_RICOCHET', rot: 0, tone: 0, life: 1.6
        });
      } else if (apexSceneExtras.recoilGhostCount === 1 && rProg >= 0.36) {
        apexSceneExtras.recoilGhostCount = 2;
        afterimages.push({
          x: px + apexPlayerDrawOff.x, y: py + apexPlayerDrawOff.y, z: pz + apexPlayerDrawOff.z,
          poseKey: 'APEX_RICOCHET', rot: 0, tone: 1, life: 1.6
        });
      }
    }

    if (apexAct1Cam) {
      apexCamX = apexAct1Cam.x + (apexAct1Cam.endX - apexAct1Cam.x) * u1;
      apexCamY = apexAct1Cam.y + (apexAct1Cam.endY - apexAct1Cam.y) * u1;
      apexCamZ = apexAct1Cam.z + (apexAct1Cam.endZ - apexAct1Cam.z) * u1;
      const dx = apexAct1Cam.lookX - apexCamX;
      const dy = apexAct1Cam.lookY - apexCamY;
      const dz = apexAct1Cam.lookZ - apexCamZ;
      camLagYaw = Math.atan2(dx, dz);
      camPitch = Math.max(-1.05, Math.min(0.85, Math.atan2(dy, Math.hypot(dx, dz) || 1.0)));
      camRoll = apexAct1Cam.roll;
      fovD = apexAct1Cam.fov0 + (apexAct1Cam.fov1 - apexAct1Cam.fov0) * u1;
    }
    apexCamBlend = 1.0;
    apexLetterbox = Math.min(1.0, apexTimer / 0.09);
    return true;
  }

  // === Act 1 -> Act 2 진입 1회 트리거 (매치 컷 줌아웃 오빗 전환) ===
  if (!apexAct2Started) {
    apexAct2Started = true;
    apexFlashTimer = (apexId === 'elastic') ? 0.025 : 0.04; // 경쾌한 매치 컷 스냅
    shakeMag = Math.max(shakeMag, 2.4);
  }

  // === Act 2 (0.90~2.35s): [승] 0% 정지 · 95°~115° 3D 불릿타임 오빗 (총 2.35s 정지) ===
  if (apexTimer < APEX_ACT2_DUR) {
    const act2Dur = Math.max(0.05, APEX_ACT2_DUR - APEX_ACT1_DUR);
    const p2 = Math.max(0.0, Math.min(1.0, (apexTimer - APEX_ACT1_DUR) / act2Dur));
    const u2 = 1.0 - Math.pow(1.0 - p2, 1.85);
    const curAng = apexStartAng + apexOrbitArc * u2;
    let curRad = apexOrbitRadius + (apexOrbitRadiusEnd - apexOrbitRadius) * u2;
    const curElev = apexStartElev + (apexEndElev - apexStartElev) * u2;

    // #6 탄성 반발: Act 2 앞 1.20s 동안 0.78 -> 1.00 한계까지 팽팽하게 쥐어짜고, 마지막 0.25s는 한계 정지 홀드("쪼기"!)
    let extraFov = 0.0;
    if (apexId === 'elastic' && apexSceneExtras) {
      const elapsed2 = apexTimer - APEX_ACT1_DUR;
      const stretchProg = Math.max(0.0, Math.min(1.0, elapsed2 / 1.20));
      const stretch = 0.78 + 0.22 * (1.0 - Math.pow(1.0 - stretchProg, 2.0));
      syncElasticVisualPositions(stretch);

      // 한계 임박(stretch >= 0.94) 시 줌 압박 + 고주파 쉐이크 + 중앙 텐션 스파크 분출
      if (stretch >= 0.94) {
        const pressure = Math.min(1.0, (stretch - 0.94) / 0.06);
        extraFov = pressure * 18.0;
        curRad -= pressure * 2.2;
        shakeMag = Math.max(shakeMag, 1.4 + pressure * 1.4);
      }
      if (apexTimer >= apexSceneExtras.nextTensionSparkT && apexSceneExtras.midPt) {
        apexSceneExtras.nextTensionSparkT = apexTimer + (stretch >= 0.96 ? 0.11 : 0.20);
        const mp = apexSceneExtras.midPt;
        const tCol = stretch >= 0.96 ? PAL.CRIMSON : (stretch >= 0.88 ? PAL.GOLD : PAL.EMERALD);
        spawnSparks(mp.x, mp.y, mp.z, tCol, 4, 24);
      }
    }

    apexCamX = apexAnchorX + Math.sin(curAng) * curRad;
    apexCamY = Math.max(4.5, apexAnchorY + curElev);
    apexCamZ = apexAnchorZ + Math.cos(curAng) * curRad;
    apexCamBlend = 1.0;
    apexLetterbox = 1.0;

    const dx = apexAnchorX - apexCamX;
    const dy = apexAnchorY - apexCamY;
    const dz = apexAnchorZ - apexCamZ;
    camLagYaw = Math.atan2(dx, dz);
    camPitch = Math.max(-1.05, Math.min(0.85, Math.atan2(dy, Math.hypot(dx, dz) || 1.0)));
    camRoll += (apexTargetRoll - camRoll) * Math.min(1.0, 9.0 * rawDt);
    fovD += ((apexFreezeFov + extraFov) - fovD) * Math.min(1.0, 9.0 * rawDt);
    return true;
  }

  // === Act 2 -> Act 3 진입 1회 트리거 (대조 매치 컷 + 0.10x 극저속 슬로우 2단계 클라이맥스 점화) ===
  if (!apexAct3Started) {
    apexAct3Started = true;
    apexFlashTimer = 0.055; // 매치 컷 2프레임 임팩트 스냅
    if (typeof playSfx === 'function') {
      if (apexId === 'lasso_swing') {
        playSfx('apex_lasso_pull');
      } else if (apexId === 'elastic') {
        playSfx('apex_release');
      } else if (apexId !== 'chain_pinball') {
        // chain_pinball fires 6 individual hit/finish SFX synced 1:1 in applyApexReleaseCamera
        const apexSfxId = (typeof SFX_TABLE !== 'undefined' && SFX_TABLE['apex_' + apexId]) ? ('apex_' + apexId) : 'apex_release';
        playSfx(apexSfxId);
      }
    }
    const def = APEX_CUT_DEFS[apexId];
    const accCol = def ? def.col : PAL.GOLD;
    const tPt = (apexSceneExtras && apexSceneExtras.targetPt) ? apexSceneExtras.targetPt : { x: px, y: py, z: pz };
    shakeMag = Math.max(shakeMag, 4.6);
    if (apexId === 'heavy_suit') {
      // 1단계 대기 압착 시작 (2단계 폭발은 Act 3 0.28s 시점 점화)
      spawnSparks(tPt.x, tPt.y, tPt.z, PAL.ORANGE, 12, 34);
    } else if (apexId === 'overdrive') {
      // 1단계 대각선 일섬 + 3다발 번개
      shakeMag = Math.max(shakeMag, 5.8);
      spawnSparks(tPt.x, tPt.y, tPt.z, PAL.NEON_PINK, 16, 48);
      const mSin = apexSceneExtras ? apexSceneExtras.mSin : Math.sin(camYaw);
      const mCos = apexSceneExtras ? apexSceneExtras.mCos : Math.cos(camYaw);
      const rxO = mCos, rzO = -mSin;
      spawnLightningBolt(px - mSin * 28, py, pz - mCos * 28, tPt.x + mSin * 20, tPt.y, tPt.z + mCos * 20, PAL.NEON_PINK, 0.72);
      spawnLightningBolt(px - mSin * 20 + rxO * 4, py + 3.5, pz - mCos * 20 + rzO * 4, tPt.x + mSin * 15 - rxO * 3, tPt.y - 2.5, tPt.z + mCos * 15 - rzO * 3, '#ffffff', 0.64);
      spawnLightningBolt(px - mSin * 22 - rxO * 4, py - 3.0, pz - mCos * 22 - rzO * 4, tPt.x + mSin * 13 + rxO * 3, tPt.y + 3.0, tPt.z + mCos * 13 + rzO * 3, PAL.NEON_CYAN, 0.62);
    } else if (apexId === 'bungee_web') {
      // 1단계 거미줄 스냅 절단
      spawnSparks(px, py, pz, PAL.GOLD, 16, 44);
    } else if (apexId === 'elastic' && apexSceneExtras) {
      // 1단계 "팡!" 탄성 릴리즈 스냅! (스파이더맨과 적이 중앙을 향해 초고속 수축 개시)
      shakeMag = Math.max(shakeMag, 5.0);
      const mp = apexSceneExtras.midPt || { x: px, y: py, z: pz };
      spawnSparks(px + apexPlayerDrawOff.x, py + apexPlayerDrawOff.y, pz + apexPlayerDrawOff.z, PAL.GOLD, 12, 42);
      if (apexSceneExtras.enemyVisPt) {
        spawnSparks(apexSceneExtras.enemyVisPt.x, apexSceneExtras.enemyVisPt.y, apexSceneExtras.enemyVisPt.z, PAL.EMERALD, 12, 42);
      }
      spawnSparks(mp.x, mp.y, mp.z, '#ffffff', 10, 36);
    } else {
      spawnSparks(tPt.x, tPt.y, tPt.z, accCol, 14, 42);
    }
    if (apexAct3Cam) {
      apexCamX = apexAct3Cam.x;
      apexCamY = apexAct3Cam.y;
      apexCamZ = apexAct3Cam.z;
    }
  }

  // === Act 3 -> Act 4 진입 1회 트리거 (100% 원속 해방 + 안전 무적 0.90s + 드라이브바이) ===
  if (apexTimer >= APEX_ACT3_DUR && !apexAct4Started) {
    apexAct4Started = true;
    apexPlayerDrawOff.x = 0.0;
    apexPlayerDrawOff.y = 0.0;
    apexPlayerDrawOff.z = 0.0;
    apexHoldCamX = apexCamX;
    apexHoldCamY = apexCamY;
    apexHoldCamZ = apexCamZ;
    const def = APEX_CUT_DEFS[apexId];
    invulnTimer = Math.max(invulnTimer, 0.90);
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
        vx = sinY * 108.0; vz = cosY * 108.0; vy = 36.0;
      } else {
        vx = sinY * 82.0; vz = cosY * 82.0; vy = Math.max(vy, 38.0);
      }
    }
  }
  return false;
}

// Act 3 (2.35~3.85s 대조 매치 컷 2단계 클라이맥스) & Act 4 (3.85~5.00s 드라이브바이 -> 3인칭 스냅백)
function applyApexReleaseCamera(rawDt) {
  if (!apexActive || apexTimer < APEX_ACT2_DUR) return;

  // === Act 3 (2.35~3.85s): 대조 매치 컷 앵글 + 미세 드리프트 + 2단계 물리 클라이맥스 점화 ===
  if (apexTimer < APEX_ACT3_DUR) {
    const act3Dur = Math.max(0.05, APEX_ACT3_DUR - APEX_ACT2_DUR);
    const act3Elapsed = apexTimer - APEX_ACT2_DUR;
    const p3 = Math.max(0.0, Math.min(1.0, act3Elapsed / act3Dur));

    if (apexAct3Cam) {
      apexCamX = apexAct3Cam.x + (apexAct3Cam.endX - apexAct3Cam.x) * p3;
      apexCamY = apexAct3Cam.y + (apexAct3Cam.endY - apexAct3Cam.y) * p3;
      apexCamZ = apexAct3Cam.z + (apexAct3Cam.endZ - apexAct3Cam.z) * p3;
      const lx = apexAct3Cam.lookX * 0.68 + px * 0.32;
      const ly = apexAct3Cam.lookY * 0.68 + py * 0.32;
      const lz = apexAct3Cam.lookZ * 0.68 + pz * 0.32;
      const dx = lx - apexCamX, dy = ly - apexCamY, dz = lz - apexCamZ;
      camLagYaw = Math.atan2(dx, dz);
      camPitch = Math.max(-1.05, Math.min(0.85, Math.atan2(dy, Math.hypot(dx, dz) || 1.0)));
      camRoll = apexAct3Cam.roll;
      fovD = apexAct3Cam.fov - p3 * 16.0;
    }
    apexCamBlend = 1.0;
    apexLetterbox = 1.0;

    // #1 초중력 슈트: 0.28s 압착 완료 후 거대 수직 대기 압착 기둥 폭발!
    if (apexId === 'heavy_suit' && apexSceneExtras && !apexSceneExtras.heavyBlastDone && p3 >= 0.19) {
      apexSceneExtras.heavyBlastDone = true;
      apexFlashTimer = 0.065;
      const tp = apexSceneExtras.targetPt || { x: px, y: py, z: pz };
      shakeMag = Math.max(shakeMag, 6.8);
      spawnSparks(tp.x, tp.y, tp.z, PAL.GOLD, 24, 68);
      shockwaves.push({ x: tp.x, y: tp.y, z: tp.z, r: 8, maxR: 140, life: 0.95, maxLife: 0.95, col: PAL.ORANGE });
    }
    // #2 오버드라이브: 2단계 교차 X-일섬 + 추가 3다발 고압 번개!
    if (apexId === 'overdrive' && apexSceneExtras && !apexSceneExtras.overdriveSlash2Done && p3 >= 0.40) {
      apexSceneExtras.overdriveSlash2Done = true;
      apexFlashTimer = 0.06;
      const tp = apexSceneExtras.targetPt || { x: px, y: py, z: pz };
      const mSin = apexSceneExtras.mSin !== undefined ? apexSceneExtras.mSin : Math.sin(camYaw);
      const mCos = apexSceneExtras.mCos !== undefined ? apexSceneExtras.mCos : Math.cos(camYaw);
      const rxO = mCos, rzO = -mSin;
      shakeMag = Math.max(shakeMag, 6.4);
      spawnSparks(tp.x, tp.y, tp.z, PAL.NEON_CYAN, 20, 62);
      spawnLightningBolt(px - mSin * 22 - rxO * 5, py + 4.5, pz - mCos * 22 - rzO * 5, tp.x + mSin * 18 + rxO * 5, tp.y - 4.0, tp.z + mCos * 18 + rzO * 5, PAL.GOLD, 0.58);
      spawnLightningBolt(px - mSin * 16 + rxO * 5, py - 4.0, pz - mCos * 16 + rzO * 5, tp.x + mSin * 16 - rxO * 5, tp.y + 4.5, tp.z + mCos * 16 - rzO * 5, '#ffffff', 0.54);
      spawnLightningBolt(px - mSin * 14, py + 6.0, pz - mCos * 14, tp.x + mSin * 20, tp.y - 5.0, tp.z + mCos * 20, PAL.NEON_PINK, 0.52);
    }
    // #3 고탄성 번지줄: 스냅 절단 직후 성층권 돌파 스파크 + 충격파
    if (apexId === 'bungee_web' && apexSceneExtras && !apexSceneExtras.bungeeBurstDone && p3 >= 0.23) {
      apexSceneExtras.bungeeBurstDone = true;
      apexFlashTimer = 0.055;
      shakeMag = Math.max(shakeMag, 5.8);
      spawnSparks(px, py, pz, PAL.GOLD, 24, 62);
      shockwaves.push({ x: px, y: py, z: pz, r: 8, maxR: 112, life: 0.85, maxLife: 0.85, col: PAL.GOLD });
    }
    // #4 올가미 스윙: 0.60s 중앙 압착 완료(p3 >= 0.40) -> 2프레임 스냅 + 대파열
    if (apexId === 'lasso_swing' && apexSceneExtras && !apexSceneExtras.lassoBurstDone && p3 >= 0.40) {
      apexSceneExtras.lassoBurstDone = true;
      apexFlashTimer = 0.06;
      if (typeof playSfx === 'function') playSfx('apex_lasso_burst');
      const tp = apexSceneExtras.targetPt || { x: px, y: py, z: pz };
      shakeMag = Math.max(shakeMag, 6.4);
      spawnSparks(tp.x, tp.y, tp.z, PAL.GOLD, 22, 62);
      shockwaves.push({ x: tp.x, y: tp.y, z: tp.z, r: 8, maxR: 142, life: 0.65, maxLife: 0.65, col: '#d8b4fe' });
    }
    // #5 연쇄 핀볼: 0.18s 간격으로 1->6 꼭짓점 순차 번개 릴레이 + 6연타 사운드 + 최종점 피날레
    if (apexId === 'chain_pinball' && apexSceneExtras && apexSceneExtras.chainPts) {
      const cPts = apexSceneExtras.chainPts;
      const wantIdx = Math.min(cPts.length - 1, Math.floor(act3Elapsed / 0.18));
      while (apexSceneExtras.chainSparkIdx < wantIdx) {
        apexSceneExtras.chainSparkIdx++;
        const k = apexSceneExtras.chainSparkIdx;
        const pt = cPts[k];
        spawnSparks(pt.x, pt.y, pt.z, k === cPts.length - 1 ? PAL.GOLD : PAL.NEON_PINK, 12, 38);
        if (k > 0) {
          const prev = cPts[k - 1];
          spawnLightningBolt(prev.x, prev.y, prev.z, pt.x, pt.y, pt.z, k === cPts.length - 1 ? PAL.GOLD : PAL.NEON_PINK, 0.46);
        }
        if (k === cPts.length - 1) {
          apexFlashTimer = 0.06;
          shakeMag = Math.max(shakeMag, 6.2);
          shockwaves.push({ x: pt.x, y: pt.y, z: pt.z, r: 6, maxR: 108, life: 0.55, maxLife: 0.55, col: PAL.GOLD });
          if (typeof playSfx === 'function') playSfx('apex_pinball_finish');
        } else {
          if (typeof playSfx === 'function') playSfx('apex_pinball_hit', 0.92 + k * 0.13);
        }
      }
    }
    // #6 탄성 반발: 0.00~0.38s 초고속 가속 수축 -> 0.38s 2차 공중 정면 대충돌!
    if (apexId === 'elastic' && apexSceneExtras) {
      const clashT = apexSceneExtras.clash2Time || 0.38;
      if (act3Elapsed < clashT) {
        const uSnap = Math.max(0.0, Math.min(1.0, act3Elapsed / clashT));
        const stretch = Math.max(0.0, 1.0 - Math.pow(uSnap, 2.5));
        syncElasticVisualPositions(stretch);
        if (apexSceneExtras.snapGhostCount === 0 && uSnap >= 0.34) {
          apexSceneExtras.snapGhostCount = 1;
          afterimages.push({
            x: px + apexPlayerDrawOff.x, y: py + apexPlayerDrawOff.y, z: pz + apexPlayerDrawOff.z,
            poseKey: 'STRIKE_DROPKICK', rot: 0, tone: 1, life: 1.4
          });
        } else if (apexSceneExtras.snapGhostCount === 1 && uSnap >= 0.66) {
          apexSceneExtras.snapGhostCount = 2;
          afterimages.push({
            x: px + apexPlayerDrawOff.x, y: py + apexPlayerDrawOff.y, z: pz + apexPlayerDrawOff.z,
            poseKey: 'STRIKE_DROPKICK', rot: 0, tone: 0, life: 1.4
          });
        }
      } else if (!apexSceneExtras.clash2Done) {
        apexSceneExtras.clash2Done = true;
        syncElasticVisualPositions(0.0);
        apexPlayerDrawOff.x = 0.0;
        apexPlayerDrawOff.y = 0.0;
        apexPlayerDrawOff.z = 0.0;
        apexFlashTimer = 0.068; // 2차 공중 대충돌 2~3프레임 임팩트 스냅!
        if (typeof playSfx === 'function') playSfx('apex_elastic');
        shakeMag = Math.max(shakeMag, 6.8);
        const mp = apexSceneExtras.midPt || { x: px, y: py, z: pz };
        const rd = apexSceneExtras.recoilDir || { x: 1, y: 0, z: 0 };
        spawnSparks(mp.x, mp.y, mp.z, PAL.EMERALD, 24, 68);
        spawnSparks(mp.x, mp.y, mp.z, PAL.GOLD, 18, 56);
        shockwaves.push({ x: mp.x, y: mp.y, z: mp.z, r: 8, maxR: 138, life: 0.90, maxLife: 0.90, col: PAL.EMERALD });
        // 반발 축을 관통하는 4다발 충격 번개 폭발
        spawnLightningBolt(mp.x - rd.x * 26, mp.y - rd.y * 26, mp.z - rd.z * 26, mp.x + rd.x * 26, mp.y + rd.y * 26, mp.z + rd.z * 26, PAL.EMERALD, 0.72);
        spawnLightningBolt(mp.x - rd.x * 22, mp.y + 4.5, mp.z - rd.z * 22, mp.x + rd.x * 22, mp.y - 4.0, mp.z + rd.z * 22, '#ffffff', 0.64);
        spawnLightningBolt(mp.x - rd.z * 18, mp.y + 5.5, mp.z + rd.x * 18, mp.x + rd.z * 18, mp.y - 5.5, mp.z - rd.x * 18, PAL.GOLD, 0.60);
        spawnLightningBolt(mp.x + rd.z * 16, mp.y + 6.5, mp.z - rd.x * 16, mp.x - rd.z * 16, mp.y - 6.0, mp.z + rd.x * 16, PAL.EMERALD, 0.56);
      }
    }
    return;
  }

  // === Act 4 (3.85~5.00s): [결] 100% 원속 해방 + 드라이브바이 지연 추격 -> 3인칭 스냅백 ===
  const relDur = Math.max(0.05, APEX_TOTAL_DUR - APEX_ACT3_DUR);
  const p = Math.max(0.0, Math.min(1.0, (apexTimer - APEX_ACT3_DUR) / relDur));

  const lagFollow = p < 0.38 ? 1.5 : 7.8;
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

  const snapT = p < 0.38 ? 0.0 : ((p - 0.38) / 0.62);
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
    apexAct1Cam = null;
    apexAct3Cam = null;
    apexSceneExtras = null;
    apexPlayerDrawOff.x = 0.0;
    apexPlayerDrawOff.y = 0.0;
    apexPlayerDrawOff.z = 0.0;
    apexIsTest = false;
  }
}
