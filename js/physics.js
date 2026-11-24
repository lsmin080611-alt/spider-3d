'use strict';
// Spider 3D — Inputs, Web Swing Pendulum & Building Collisions

function getInputs() {
  let turn = joyX, fwd = joyY;
  if (keys['KeyA'] || keys['ArrowLeft'])  turn -= 1;
  if (keys['KeyD'] || keys['ArrowRight']) turn += 1;
  if (keys['KeyW'] || keys['ArrowUp'])    fwd += 1;
  if (keys['KeyS'] || keys['ArrowDown'])  fwd -= 1;
  return { turn: Math.max(-1, Math.min(1, turn)), fwd: Math.max(-1, Math.min(1, fwd)) };
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
  const lowAltFactor = py < 55.0 ? Math.min(1.0, (55.0 - py) / 55.0) : 0.0;

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

      const idealZ = (95.0 - 28.0 * lowAltFactor) + horizSpd * (0.45 - 0.17 * lowAltFactor);
      let sc = Math.abs(localZ - idealZ) + Math.abs(Math.abs(localX) - 56.0) * 0.48;
      if (lowAltFactor > 0.0) {
        // 저고도(py < 55m): 각도가 선(수직에 가까운) 앵커 우선 가중치로 고속 바닥 충돌 완화
        const dyAnchor = targetWallY - py;
        const horizDist = Math.hypot(wx - px, wz - pz);
        const steepness = dyAnchor / Math.max(20.0, horizDist);
        sc -= Math.min(55.0, steepness * 36.0) * lowAltFactor;
        if (horizDist > dyAnchor * 1.45) {
          sc += Math.min(60.0, (horizDist - dyAnchor * 1.45) * 0.55) * lowAltFactor;
        }
      }
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
  flipAngle = 0.0;
  strikeTumbleTimer = 0.0;
  justChainElapsed = -1.0;
  justChainLastTarget = null;
  spawnSparks(ax, ay, az, target.isCloud ? '#b8e4ff' : '#ffffff', 7, 22);
  if (typeof playSfx === 'function') playSfx('web_shoot');
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
  if (isApexInputLocked()) {
    return;
  }

  if (py <= 4.0) {
    vy = 58.0;
    const sinY = Math.sin(camYaw), cosY = Math.cos(camYaw);
    const hSpd = Math.hypot(vx, vz);
    if (hSpd < 26.0) { vx = sinY * 26.0; vz = cosY * 26.0; }
    autoCatchAfterJump = true;
    spawnSparks(px, 1.5, pz, '#b8e4ff', 8, 20);
    if (typeof playSfx === 'function') playSfx('jump');
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
    const prevAnchorPt = { x: ax, y: ay, z: az };
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
        const upwardKick = (12.0 + depthRatio * 8.0) * aug.bungeeBounce;
        const targetVy = Math.min(88.0 * aug.bungeeBounce, vy + upwardKick);
        vy = Math.max(vy, targetVy);

        const curSpd = Math.hypot(vx, vy, vz);
        const bungPerfMult = lvBung >= 3 ? 1.35 : 1.0;
        const rawFwd = (10.0 + depthRatio * 6.0) * aug.swingPushMult * bungPerfMult;
        const fwdAdd = curSpd < softBoostCap ? Math.min(rawFwd, softBoostCap - curSpd) : 0.0;
        vx += sinY * fwdAdd;
        vz += cosY * fwdAdd;

        // 릴리즈 직후 3D 총속력이 피크 상한 초과 시 상승(vy)을 보존하고 수평 성분만 정규화
        const relSpd = Math.hypot(vx, vy, vz);
        if (relSpd > softBoostCap) {
          const hRel = Math.hypot(vx, vz);
          const remSq = softBoostCap * softBoostCap - vy * vy;
          if (remSq > 0.0 && hRel > 1.0) {
            const targetH = Math.min(hRel, Math.max(hRel * 0.65, Math.sqrt(remSq)));
            const hSc = targetH / hRel;
            vx *= hSc;
            vz *= hSc;
          }
        }

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
        if (typeof playSfx === 'function') playSfx('perfect_release');

        // [Step 4] 고탄성 번지줄 Lv.3 대아크 PERFECT -> 3.4s 버프 저장 (수동 STRIKE 적중 시에만 컷신 발동!)
        if (lvBung >= 3 && swingDepth >= 68.0 && vy >= 95.0) {
          bungeeApexTimer = 3.4;
          lastBungeeAnchorPt = prevAnchorPt;
        }
      } else {
        const upwardKick = (7.5 + depthRatio * 6.5) * aug.bungeeBounce;
        const targetVy = Math.min(73.0 * aug.bungeeBounce, vy + upwardKick);
        vy = Math.max(vy, targetVy);

        const curHSpd = Math.hypot(vx, vz);
        if (curHSpd < maxCruiseSpd) {
          const fwdAdd = Math.min((3.0 + depthRatio * 4.0) * aug.swingPushMult, maxCruiseSpd - curHSpd);
          vx += sinY * fwdAdd;
          vz += cosY * fwdAdd;
        }

        const normalReleaseCap = (BASE_SWING_MAX_SPD + 6.0) * aug.maxSpeedMult;
        const relSpd = Math.hypot(vx, vy, vz);
        if (relSpd > normalReleaseCap) {
          const hRel = Math.hypot(vx, vz);
          const remSq = normalReleaseCap * normalReleaseCap - vy * vy;
          if (remSq > 0.0 && hRel > 1.0) {
            const targetH = Math.min(hRel, Math.max(hRel * 0.65, Math.sqrt(remSq)));
            const hSc = targetH / hRel;
            vx *= hSc;
            vz *= hSc;
          }
        }

        if (swingDepth > 55) {
          addStylePoints(5, 4.6);
          addPopup('BIG ARC!', PAL.GOLD, 1);
        } else {
          addStylePoints(2, 4.6);
        }
        if (typeof playSfx === 'function') playSfx('web_release');
      }

      doingFlip = true;
      flipAngle = 0.0;
    } else if (swingTimer > 0.10 && vy > 4.0) {
      // 짧은 스윙 이탈 시에도 가벼운 도약 보정
      const microKick = 7.0 * aug.bungeeBounce;
      vy = Math.max(vy, Math.min(52.0 * aug.bungeeBounce, vy + microKick));
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
              if (typeof playSfx === 'function') playSfx('bounce');
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
              strikeTumbleTimer = 0.0;
              doingFlip = false;
              flipAngle = 0.0;
              if (getLv('fric_heat') > 0) frictionCharge = Math.min(1.5, frictionCharge + 0.55);
              if (lvElastic >= 3) elasticCritTimer = 2.5;
              lastElasticWallPt = { x: px, y: py, z: pz, nx: nx, nz: nz };
              shakeMag = Math.max(shakeMag, 2.8);
              const eShock = getElasticShockSpec();
              triggerShockwave(px, py, pz, eShock ? eShock.radius : 44, eShock ? eShock.dmg : 20, PAL.EMERALD);
              spawnSparks(px, py, pz, PAL.EMERALD, 14, 34);
              const maxCharges = getElasticMaxCharges();
              const critTag = lvElastic >= 3 ? ' CRIT!' : '';
              addPopup('ELASTIC ' + bounceMult.toFixed(2) + 'x' + critTag + ' (' + elasticChargesLeft + '/' + maxCharges + ')', lvElastic >= 3 ? PAL.GOLD : PAL.EMERALD, 2);
              continue;
            }

            const absVn = Math.abs(vn);
            const wallRatio = Math.max(0.0, Math.min(1.0, (absVn - 28.0) / 86.0));
            const wallDmg = Math.round(12 + wallRatio * 53);
            vx = (vx - vn * nx) * 0.25 + nx * Math.min(18.0, absVn * 0.28);
            vz = (vz - vn * nz) * 0.25 + nz * Math.min(18.0, absVn * 0.28);
            vy *= 0.45;
            isSwinging = false;
            inPerfectWindow = false;
            perfectGraceTimer = 0;
            isRopeTaut = false;
            swingReattachCooldown = 0.18;
            diveCharge = 0;
            clearStrikeState();
            shakeMag = Math.max(shakeMag, 3.0 + wallRatio * 3.5);
            spawnSparks(px, py, pz, PAL.CRIMSON, 12 + Math.round(wallRatio * 10), 34 + wallRatio * 14);
            const wallLabel = lvElastic > 0 ? 'BOUNCE DEPLETED!' : (wallDmg >= 40 ? 'HEAVY WALL CRASH!' : 'WALL CRASH!');
            takeDamage(wallDmg, wallLabel);
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
