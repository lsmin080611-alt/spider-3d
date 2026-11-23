'use strict';
// Spider 3D — 60fps Main Simulation Loop, Controls & Safe Initialization

// =========================================================================
// 11. MAIN 60FPS ANIMATION LOOP
// =========================================================================
let lastTime = 0;
let fpsFrames = 0, fpsAcc = 0;
let afterimageSampleAcc = 0;

// Step 2: 건물 관통 0% 5-Cut 영화적 오프닝 컷신 (510m 첨탑 마천루 조망 -> 측면 허공 보행 & 숨고르기 -> 허공 측면 도약 -> 구름 돌파 급추격 -> 역방향 공중 포즈 -> 다이브 스냅)

function tick(now) {
  if (!lastTime) lastTime = now;
  let dt = (now - lastTime) / 1000.0;
  lastTime = now;
  if (dt > 0.05) dt = 0.05;
  if (dt < 0.001) dt = 0.016;
  const rawDt = dt;
  if (typeof updateAudio === 'function') updateAudio(rawDt);

  fpsFrames++;
  fpsAcc += rawDt;
  if (fpsAcc >= 0.45) {
    if (fpsBadge) fpsBadge.textContent = Math.round(fpsFrames / fpsAcc) + ' FPS';
    fpsFrames = 0;
    fpsAcc = 0;
  }

  if (augmentDraftOpen) {
    if (draftLockTimer > 0) {
      draftLockTimer = Math.max(0, draftLockTimer - rawDt);
    }
    if (Math.abs(joyX) < 0.25) {
      draftJoyLock = false;
    } else if (!draftJoyLock) {
      moveDraftCursor(joyX > 0 ? 1 : -1);
      draftJoyLock = true;
    }
  } else if (pendingLevelUps > 0 && hitStopTimer <= 0 && !gameOver && !apexActive) {
    swingHeld = false;
    autoCatchAfterJump = false;
    if (btnSwing) btnSwing.classList.remove('pressed', 'ready', 'perfect');
    openAugmentDraft();
  }

  const isFrozen = hitStopTimer > 0 || gameOver || augmentDraftOpen;
  if (hitStopTimer > 0) hitStopTimer = Math.max(0, hitStopTimer - rawDt);

  const { turn: turnInput, fwd: forwardInput } = getInputs();
  const { blocks: nearbyBlocks, buildings: nearbyBuildings, clouds: nearbyClouds, parks: nearbyParks } = getNearbyWorld();

  if (!isFrozen && updateOpeningCutscene(rawDt)) {
    // 컷신(ROOF_WAIT / ROOF_WALK / DROP_INTRO) 중에는 본 게임 물리·전투·타이머 스킵
  } else if (!isFrozen && updateApexCutFreeze(rawDt)) {
    // Step 4 Act 1 (0.00~1.05s): 완전 0% 시간정지 + 70°~80° 3D 시점 선회 (물리·적·타이머 완전 정지)
  } else if (!isFrozen) {
    // Step 4 Act 2 (1.05~2.05s): 매치 컷 0.14x 초슬로우 물리, Act 3 (2.05~3.00s): 100% 원속 재개
    if (isApexAct2Phase()) {
      dt = rawDt * APEX_ACT2_SCALE;
    }
    const aug = getAugStats();
    simTime += dt;
    if (openingPhase === 'DROP_CATCH') {
      openingTimer += dt;
    }

    if (openingPhase === 'ACTIVE' && !apexActive) {
      if (apexGlobalCd > 0.0) apexGlobalCd = Math.max(0.0, apexGlobalCd - dt);
      for (let i = 0; i < APEX_CUT_IDS.length; i++) {
        const aid = APEX_CUT_IDS[i];
        if (apexAugCds[aid] > 0.0) apexAugCds[aid] = Math.max(0.0, apexAugCds[aid] - dt);
      }
    }

    if (openingPhase === 'ACTIVE' && !apexActive && runTimeRemaining > 0) {
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
    if (shakeMag > 0) shakeMag = Math.max(0, shakeMag - 12.0 * rawDt);
    if (stylePopTimer > 0) stylePopTimer = Math.max(0, stylePopTimer - dt);
    if (stylePulseTimer > 0) stylePulseTimer = Math.max(0, stylePulseTimer - dt);
    if (!apexActive && perfectBuffTimer > 0) perfectBuffTimer = Math.max(0, perfectBuffTimer - dt);
    if (!apexActive && elasticCritTimer > 0) elasticCritTimer = Math.max(0, elasticCritTimer - dt);
    if (!apexActive && bungeeApexTimer > 0) bungeeApexTimer = Math.max(0, bungeeApexTimer - dt);
    if (!apexActive && strikeRushTimer > 0) {
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

    if (openingPhase === 'ACTIVE' && !apexActive) {
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
      const isRisingArc = passedBottom && vy > -6.0;
      if (forwardInput > 0.15) {
        // 접선(진행) 방향 추진 펌핑 (상승 아크에서는 3D 진행 벡터로 상승 에너지 직접 전달)
        const curSpd3D = Math.hypot(vx, vy, vz);
        if (curSpd3D < maxSwingSpd) {
          const pushAcc = forwardInput * (22.0 * aug.swingPushMult) * dt;
          if ((isRisingArc || vy > 0.0) && curSpd3D > 8.0) {
            vx += (vx / curSpd3D) * pushAcc;
            vy += (vy / curSpd3D) * pushAcc;
            vz += (vz / curSpd3D) * pushAcc;
          } else {
            vx += sinY * pushAcc;
            vz += cosY * pushAcc;
          }
        }
        // 정면 풀 푸시(>0.65) & 좌우 꺾기 적음(|turn|<0.35)일 때만 연속 비례 줄 당기기 (최소 46m 하한으로 벽 빨림 차단)
        if (forwardInput > 0.65 && Math.abs(turnInput) < 0.35 && ropeLen > 46.0) {
          const reelIntensity = Math.min(1.0, (forwardInput - 0.65) / 0.35);
          const reelRate = (isRisingArc && isRopeTaut) ? 26.0 : 20.0;
          const prevRopeLen = ropeLen;
          ropeLen = Math.max(46.0, ropeLen - reelRate * reelIntensity * dt);
          const reeledDist = prevRopeLen - ropeLen;
          // 최저점 통과 후 상승 구간 줄당김 펌프 (총속력 상한 내에서 수평 에너지를 상승 고도로 전환, py <= 10m 비활성)
          if (reeledDist > 0.0 && isRisingArc && py > 10.0) {
            const spdNow = Math.hypot(vx, vy, vz);
            const pumpCap = maxSwingSpd + 4.0;
            if (spdNow > 6.0 && spdNow < pumpCap) {
              const tanAdd = Math.min(reeledDist * 0.85 * aug.swingPushMult, pumpCap - spdNow);
              vx += (vx / spdNow) * tanAdd;
              vy += (vy / spdNow) * tanAdd;
              vz += (vz / spdNow) * tanAdd;
            }
            vy += reeledDist * 0.65 * aug.bungeeBounce;
            const postSpd = Math.hypot(vx, vy, vz);
            if (postSpd > pumpCap) {
              const hNow = Math.hypot(vx, vz);
              const allowedH = Math.sqrt(Math.max(0.0, pumpCap * pumpCap - vy * vy));
              if (hNow > 1.0 && allowedH < hNow) {
                const targetH = Math.max(Math.min(hNow, pumpCap * 0.45), allowedH);
                const hSc = targetH / hNow;
                vx *= hSc;
                vz *= hSc;
              }
            }
          }
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
        const curSpd = Math.hypot(vx, vy, vz);
        const dynamicBase = Math.max(55.0, curSpd * 1.2);
        const urgency = py < 22.0 ? 11.0 : (py < 40.0 ? 6.5 : 3.4);
        const maxReelPerSec = py < 22.0 ? Math.max(dynamicBase * 1.25, 78.0) : dynamicBase;
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
          // 기본 순항 상한(maxSwingSpd) 초과 고속 구간은 공력 감쇠로 자연 수렴 (상승 아크에서는 0.95/s, 진공 활공 Lv.1 50%/Lv.2~3 0%)
          if (targetSpd > maxSwingSpd && vacDrag > 0) {
            const dragRate = (passedBottom && vy > 0.0) ? 0.95 : 1.35;
            targetSpd -= (targetSpd - maxSwingSpd) * Math.min(1.0, dragRate * vacDrag * dt);
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
      } else if (py > 6.5 && vy <= 0.0 && forwardInput < -0.25) {
        // 활강 양력(0.16x 중력)은 하강 중(vy <= 0)에만 적용 — 상승 중 S 입력 시 정상 정점 도달 후 활강 전환
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

      // 공중 3D 공력 종단 속도 (고공 낙하/다이브 시 노증강 SPD 폭주 방지 · 오버드라이브/번지/초중력/진공 활공 연동)
      if (vacDrag > 0 && openingPhase !== 'DROP_CATCH') {
        const airSpd = Math.hypot(curHSpd, vy);
        const vertScale = vy > 0.0 ? aug.bungeeBounce : Math.sqrt(aug.gravityMult);
        const maxAirSpd = (BASE_SWING_MAX_SPD + (isDiving ? 18.0 : 8.0)) * aug.maxSpeedMult * vertScale;
        if (airSpd > maxAirSpd) {
          const targetAirSpd = airSpd - (airSpd - maxAirSpd) * Math.min(1.0, 1.45 * vacDrag * dt);
          const airSc = targetAirSpd / airSpd;
          curHSpd *= airSc;
          vy *= airSc;
        }
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

    // Step 4 Act 2 (1.05~2.05s 매치 컷) & Act 3 (2.05~3.00s 드라이브바이 지연 추격 -> 3인칭 스냅백)
    applyApexReleaseCamera(rawDt);
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
    const canLassoSelfSnap = (typeof getLassoSpec === 'function' && !!getLassoSpec() && lassoTargets.length > 0);
    const hasLock = (!!homingTarget || previewCase === 1 || canLassoSelfSnap) && !gameOver && !augmentDraftOpen && openingPhase === 'ACTIVE';
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
      else if (isInstantNow || (!homingTarget && canLassoSelfSnap)) btnStrike.classList.add('locked');
      else btnStrike.classList.add('case3');
      if (strikeMode !== 0) {
        strikeBtnLabel.textContent = strikePhase === 'HANG_SHOOT' ? 'SNAP!!' : (isChainRush ? 'CHAIN!!' : 'STRIKE!');
        strikeBtnSub.textContent = strikeMode === 1 ? 'C1 SLAM' : (isChainRush ? 'PINBALL' : 'C3 YANK');
      } else if (!homingTarget && canLassoSelfSnap && (previewCase !== 1 || lassoTargets.length >= enemies.length)) {
        strikeBtnLabel.textContent = 'LASSO!';
        strikeBtnSub.textContent = 'SNAP BOOM';
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

  const frame = renderWorld3D(isFrozen, nearbyBlocks, nearbyBuildings, nearbyClouds, nearbyParks, turnInput, forwardInput);
  renderHUD(frame.cb, frame.totalSpeed);

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
  const toggleSound = () => {
    if (typeof cycleAudioMode !== 'function') return;
    const mode = cycleAudioMode();
    if (btnSound) {
      btnSound.textContent = getAudioButtonLabel();
      btnSound.classList.toggle('active', mode !== 'OFF');
    }
  };

  btnCam.addEventListener('click', toggleCam);
  btnShadow.addEventListener('click', toggleShadows);
  btnScanline.addEventListener('click', toggleScanline);
  if (btnSound) btnSound.addEventListener('click', toggleSound);
  if (btnApexTest) btnApexTest.addEventListener('click', triggerApexTestCycle);
  btnReset.addEventListener('click', resetGame);

  const unlockOnce = () => {
    if (typeof unlockAudio === 'function') unlockAudio();
  };
  window.addEventListener('pointerdown', unlockOnce, { passive: true });
  window.addEventListener('keydown', unlockOnce, { passive: true });

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
      else if (e.code === 'KeyM') toggleSound();
      else if (e.code === 'KeyR') resetGame();
      else if (e.code === 'KeyB' && openingPhase === 'ACTIVE' && !bossActive && !gameOver) {
        runTimeRemaining = 3.0;
        addPopup('DEBUG: BOSS IN 3s!', PAL.GOLD, 2);
      }
      else if (e.code === 'KeyX') {
        triggerApexTestCycle();
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
    btnSound       = document.getElementById('btn-sound');
    btnApexTest    = document.getElementById('btn-apex-test');
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
