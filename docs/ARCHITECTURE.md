# Spider 3D — 코드 아키텍처 & 컨텍스트 지도

> **목적:** 새 대화 시작 시 이 파일 1개만 읽어 하드웨어 제약·파일 구조·`SPEC.md` 섹션 목차·코드 심볼 위치를 즉시 파악하기 위한 경량 프로젝트 지도. (불변 규칙·협업 프로토콜은 `AGENTS.md` 참조)

---

## 1. 타겟 하드웨어 제약 (LILYGO T-Display-S3)
- **MCU / 메모리:** ESP32-S3 (512KB SRAM + **8MB PSRAM**)
- **디스플레이:** 1.9" ST7789 **320×170** 가로 LCD (RGB565 프레임버퍼 108.8KB, 8-bit 8080 병렬 직결, 60fps 목표)
- **물리 조작계:** 외장 아날로그 조이스틱(`GPIO 1/2`), 택타일 버튼 2개(`GPIO 14` SWING, `GPIO 0` STRIKE)
- **렌더링·투명화:** 알파 블러/실시간 셰이더 배제, 크로마키(`TFT_MAGENTA` `#FF00FF`) + `TFT_eSPI::pushSprite()` 기반, HTML 갱신 시 중첩 템플릿 리터럴 `innerHTML` 대신 `textContent`/`className` 사용

---

## 2. 웹 프로토타입 파일 구조 (`index.html` 순차 `<script>` 로드 · CORS 안전)
- `index.html` — 320×170 Canvas, T-Display-S3 프레임, 아래 순서대로 스크립트 로드
- `style.css` — 기기 베젤, 가상 조이스틱(`#joy-zone`), 2버튼 모바일 반응형
1. `assets.js` (~1,228L) — PC-98 팔레트, 베이어/벽돌 패턴, 2번 구름, 5종 360° 파노라마, 18종 스파이더맨·랭크 스프라이트
2. `augments.js` (~820L) — 13종 증강 데이터, 4슬롯·Lv.1~3 스펙, `augLevels`, `resetAugments()`, `getAugStats()`, 드래프트 UI(`draftLockTimer`)·HUD
3. `js/audio.js` (~250L) — Step 5 ESP32 수동 부저(`ledcWriteTone`) 1:1 단음 칩튠 SFX(22종)·1채널 BGM 시퀀서
4. `js/state.js` (~393L) — 전역 상수·상태 변수, 이펙트 헬퍼, 스타일 랭크, 피격(`takeDamage`)
5. `js/world.js` (~328L) — 맨해튼 도시 생성(`getBlockData`), 웨이브 스폰(`spawnWave`), `resetGame()`
6. `js/boss.js` (~468L) — 6분 보스전 `OMEGA SOVEREIGN` (`onRunTimerZero`, `updateBossSystem`, 기뢰/호위/레이저)
7. `js/cutscene.js` (~988L) — Step 2 옥상 오프닝 5-Cut + Step 4 Lv.3 `APEX CUT` 3-Act 컷씬
8. `js/physics.js` (~382L) — 입력 읽기, 앵커 탐색·웹 스윙 진자, 건물 충돌·월슬라이드·탄성 반발
9. `js/combat.js` (~1,160L) — `applyEnemyDamage`/`triggerShockwave`, 3-Case STRIKE·속도 스케일링, 적 AI·전투 엔진
10. `js/renderer.js` (~1,394L) — 3D 카메라·투영·클리핑, 빌딩/적/보스/스파이더맨 렌더, `renderWorld3D()`
11. `js/hud.js` (~603L) — 레이더, 화면 밖 마커, `renderHUD()` (레터박스·스탯·보스 바·스타일 엠블럼·결과창·스캔라인)
12. `js/main.js` (~1,050L) — 60fps 메인 루프(`tick()`), 멀티터치/키보드 조작(`setupControls`), `initApp()`

---

## 3. `docs/SPEC.md` 섹션 목차 (부분 읽기용 인덱스)
*(전체 읽기 대신 작업 영역의 줄 범위만 부분 읽기 — 줄 번호 변동 시 `rg -n "^##" docs/SPEC.md`로 확인)*

| 영역 | 섹션 | 대략 위치 |
| :--- | :--- | :--- |
| 개요·타겟·조작계 | `§1. 게임 개요 & 핵심 정체성` | `L7~16` |
| 웹 스윙 물리·도시·5-Cut 옥상 오프닝·바닥 방어 | `§2. 웹 스윙 물리 & 도시 이동 규칙` | `L18~50` |
| 수동 3-Case STRIKE·통합 속도 데미지 | `§3-1. 속도·에너지 기반 3가지 STRIKE 분기` | `L54~67` |
| 5단계 스타일 랭크(`D~S`)·배경/화력 연동 | `§3-2. 5단계 스타일 랭크` | `L68~81` |
| 6분 타이머·순수 전투 XP·적 티어/AI·화면 밖 마커 | `§3-3. 적 티어·배치 AI, 6분 타이머 & XP` | `L82~94` |
| 6분 보스전(`OMEGA SOVEREIGN` 회피/그로기 턴) | `§3-4. 6분(00:00) 보스전 루프` | `L95~106` |
| 증강 4슬롯·Lv.1~3·13종 로스터·오입력 방지 | `§4-1 ~ §4-3. 로그라이크 증강 시스템` | `L110~139` |
| Lv.3 `APEX CUT` 6종 3.0초 3-Act 불릿타임 3D 컷씬 | `§4-4. [Step 4] APEX CUT` | `L140~155` |
| PC-98 도트 비주얼·2번 구름·18종 스프라이트·60fps | `§5. PC-98 빈티지 도트 비주얼` | `L158~165` |
| 수동 부저(`ledcWriteTone`) 1:1 단음 칩튠 SFX·BGM | `§6. [Step 5] 초경량 수동 부저 칩튠 사운드 엔진` | `L169~179` |

---

## 4. 모듈별 핵심 심볼 지도 (편집 전 대상 모듈만 부분 읽기 / `rg` 확인)

- **`js/audio.js`:** `SFX_TABLE`, `BGM_SWING_STEPS`, `BGM_BOSS_STEPS`, `unlockAudio`, `cycleAudioMode`, `playSfx`, `resetAudioForNewRun`, `updateAudio`
- **`js/state.js`:** 전역 상태(`GAME_MAX_ALTITUDE`, `BASE_GRAVITY`, `px/py/pz`, `BOSS_*`, `START_ROOF`, `APEX_*`), `spawnSparks`/`spawnExplosion`/`spawnDamageNumber`/`spawnLightningBolt`, `syncStageFromStyleRank`, `addStylePoints`, `dropStyleRanks`, `clearStrikeState`, `releaseLassoTargets`, `takeDamage`
- **`js/world.js`:** `getBlockData`, `getNearbyWorldAt`, `getNearbyWorld`, `pushOutOfBuildings`, `spawnWave`, `resetGame`
- **`js/boss.js`:** `resetBossState`, `spawnBossMines`, `spawnBossEscorts`, `spawnBossSynergyDrones`, `startBossEvadeTurn`, `startBossGroggyTurn`, `onRunTimerZero`, `updateBossSystem`
- **`js/cutscene.js`:** `isOpeningCutscene`, `isOpeningActive`, `handleOpeningAnyInput`, `completeOpeningCatch`, `updateOpeningCutscene`, `resetApexCutState`, `isApexFreezePhase`, `isApexAct2Phase`, `tryTriggerApexCut`, `triggerApexTestCycle`, `updateApexCutFreeze`, `applyApexReleaseCamera`
- **`js/physics.js`:** `getInputs`, `findWallAnchor`, `startWebSwing`, `onSwingDown`, `onSwingUp`, `handleBuildingsCollisionAndProximity`
- **`js/combat.js`:** `applyEnemyDamage`, `triggerShockwave`, `classifyStrikeCase`, `getSpeedDamageMult`, `computeStrikeDamage`, `findCase1Target`, `findBestLockTarget`, `findNextChainTarget`, `hasObstacleBehindTarget`, `onStrikePress`, `updateEnemyMovementAI`, `updateCombat`
- **`js/renderer.js`:** `getCameraPos`, `makeCamBasis`, `projectWorldPt`, `drawClippedPoly3D`, `drawClippedLine3D`, `drawLightning3D`, `drawPC98Building`, `drawEnemy3D`, `drawBossHazards3D`, `drawSpiderManSprite`, `renderWorld3D`
- **`js/hud.js`:** `drawEnemyRadarHUD`, `drawOffscreenEnemyMarkers`, `renderHUD`
- **`js/main.js`:** `tick`, `setupControls`, `initApp`
- **`augments.js`:** `AUGMENTS`, `getLv`, `getOwnedAugmentCount`, `get*Spec()`, `getXpRequirement`, `gainXp`, `resetAugments`, `getAugStats`, `openAugmentDraft`, `confirmAugment`, `drawAugmentDraftUI`, `drawActiveAugmentsHUD`
- **`assets.js`:** `PAL`, `STAGE_THEMES`, `bakeAllStagePatterns`, `bakeCloud2Sprite`, `bakePanoramaStrip`, `bakeAllSpideySprites`, `bakePropSprites`, `bakeStyleRankSprites`

---

## 5. 진행 현황 & 남은 마일스톤
- [x] 웹 프로토타입 코어 완성 (진자 물리·PC-98 비주얼·3-Case STRIKE·4슬롯 Lv.1~3 증강 13종·Step 1~4: 5단계 스타일 랭크/6분 타이머, 5-Cut 옥상 오프닝, 6분 보스전, Lv.3 `APEX CUT` 6종)
- [x] `game.js` 역할별 9개 모듈(`js/*.js`) 분리 리팩토링 (토큰 절감 & C++ 1:1 포팅 대비)
- [x] Step 5: 초경량 수동 부저 칩튠 사운드 엔진 (`js/audio.js` — ESP32 `ledcWriteTone` 1:1 단음 SFX 22종 + 1채널 BGM)
- [ ] 플레이테스트 피드백 4-트랙 개선 (`docs/BACKLOG.md` §1, `1대화 = 1트랙`)
  - [ ] Track 1: 올가미 소프트락 수정 & 트레일·HUD 카운터 가시화 (#1, #2)
  - [ ] Track 2: 스윙 줄당김 상승(+25~30%) · 활강 상승 버그 수정 · 저고도 고속 스윙 (#3, #4, #6)
  - [ ] Track 3: Shift 직전 속도 기준 엄수 · 연타 봉인 · `연속 돌격` 저스트 리듬 리워크 · 4단계 타격 피드백 (#7, #9, #10, #11)
  - [ ] Track 4: 속도 비례 벽/바닥(추락사) · 적/보스 데미지 상향 · 보스 독립 아레나 순항 AI (#5, #8)
- [ ] LILYGO T-Display-S3 (PlatformIO + `TFT_eSPI`) C++ 포팅 및 실기기 60fps 검증
