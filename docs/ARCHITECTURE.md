# Spider 3D — 코드 아키텍처 & 컨텍스트 지도

> **목적:** 새 대화 시작 시 이 파일 1개만 읽어 하드웨어 제약·파일 구조·`SPEC.md` 섹션 목차·코드 심볼 위치를 즉시 파악하기 위한 경량 프로젝트 지도. (불변 규칙·협업 프로토콜은 `AGENTS.md` 참조)

---

## 1. 타겟 하드웨어 제약 (LILYGO T-Display-S3)
- **MCU / 메모리:** ESP32-S3 (512KB SRAM + **8MB PSRAM**)
- **디스플레이:** 1.9" ST7789 **320×170** 가로 LCD (RGB565 프레임버퍼 108.8KB, 8-bit 8080 병렬 직결, 60fps 목표)
- **물리 조작계:** 외장 아날로그 조이스틱(`GPIO 1/2`), 택타일 버튼 2개(`GPIO 14` SWING, `GPIO 0` STRIKE)
- **렌더링·투명화:** 알파 블러/실시간 셰이더 배제, 크로마키(`TFT_MAGENTA` `#FF00FF`) + `TFT_eSPI::pushSprite()` 기반, HTML 갱신 시 중첩 템플릿 리터럴 `innerHTML` 대신 `textContent`/`className` 사용

---

## 2. 웹 프로토타입 파일 구조 (`index.html` 순차 `<script>` 로드)
1. `index.html` — 320×170 Canvas, T-Display-S3 프레임, 순차 스크립트 로드
2. `style.css` — 기기 베젤, 가상 조이스틱(`#joy-zone`), 2버튼 모바일 반응형
3. `assets.js` — PC-98 팔레트, 베이어/벽돌 패턴, 2번 구름, 5종 360° 파노라마, 18종 스파이더맨·랭크 스프라이트
4. `augments.js` — 13종 증강 데이터, 4슬롯·Lv.1~3 스펙, `augLevels`, `resetAugments()`, `getAugStats()`, 드래프트 UI(`draftLockTimer`)·HUD
5. `game.js` — 진자 웹 스윙 물리, 3-Case STRIKE, 5단계 스타일 랭크, 6분 타이머/XP, 보스전, 오프닝·APEX CUT 컷신, 3D 투영 렌더링, 메인 루프

> **향후 리팩토링 목표 (C++ 1:1 이식 & 토큰 절감):** `game.js`를 `config / state / physics / combat / boss / cutscene / renderer / hud / main` 단위로 분리.

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

---

## 4. 심볼 기반 코드 지도 (편집 전 `rg`로 정확한 줄 위치 확인)

### `game.js`
- **상태·이펙트·데미지·스타일 랭크** (`~L1~482`): `applyEnemyDamage`, `triggerShockwave`, `syncStageFromStyleRank`, `addStylePoints`, `dropStyleRanks`
- **보스전 (`OMEGA SOVEREIGN`)** (`~L483~945`): `resetBossState`, `spawnBossMines`, `spawnBossEscorts`, `spawnBossSynergyDrones`, `startBossEvadeTurn`, `startBossGroggyTurn`, `onRunTimerZero`, `updateBossSystem`
- **피격·올가미·도시 생성·웨이브·오프닝 상태** (`~L946~1382`): `clearStrikeState`, `releaseLassoTargets`, `takeDamage`, `getBlockData`, `getNearbyWorld`, `spawnWave`, `handleOpeningAnyInput`, `completeOpeningCatch`, `resetGame`
- **Lv.3 `APEX CUT` 3-Act 3D 컷씬** (`~L1383~2004`): `resetApexCutState`, `isApexFreezePhase`, `isApexAct2Phase`, `tryTriggerApexCut`, `triggerApexTestCycle`, `updateApexCutFreeze`, `applyApexReleaseCamera`
- **STRIKE 판정·웹 스윙·건물 충돌** (`~L2005~2712`): `classifyStrikeCase`, `getSpeedDamageMult`, `computeStrikeDamage`, `onStrikePress`, `findWallAnchor`, `startWebSwing`, `onSwingDown`, `onSwingUp`, `handleBuildingsCollisionAndProximity`
- **적 AI·전투 엔진** (`~L2713~3380`): `updateEnemyMovementAI`, `updateCombat`
- **3D 카메라·투영·렌더러·레이더/마커** (`~L3381~4255`): `getCameraPos`, `projectWorldPt`, `drawPC98Building`, `drawEnemy3D`, `drawBossHazards3D`, `drawEnemyRadarHUD`, `drawOffscreenEnemyMarkers`, `drawSpiderManSprite`
- **오프닝 컷신·메인 루프·프레임 렌더** (`~L4256~6445`): `updateOpeningCutscene`, `tick` (내부 `3. RENDER` 블록 `~L5343~6445`)
- **입력·초기화** (`~L6446~6656`): `setupControls`, `initApp`

### `augments.js`
- **로스터·스펙 헬퍼** (`~L1~354`): `AUGMENTS`, `getLv`, `getOwnedAugmentCount`, `get*Spec()`
- **XP·초기화·중앙 스탯** (`~L355~468`): `getXpRequirement`, `gainXp`, `resetAugments`, `getAugStats`
- **드래프트·UI·HUD** (`~L472~818`): `openAugmentDraft`, `confirmAugment`, `drawAugmentDraftUI`, `drawActiveAugmentsHUD`

### `assets.js`
- **팔레트·베이어/벽돌 패턴** (`~L1~288`): `PAL`, `STAGE_THEMES`, `bakeAllStagePatterns`
- **2번 구름·360° 파노라마** (`~L289~625`): `bakeCloud2Sprite`, `bakePanoramaStrip`
- **캐릭터 18종·프롭·랭크 엠블럼** (`~L626~1228`): `bakeAllSpideySprites`, `bakePropSprites`, `bakeStyleRankSprites`

---

## 5. 진행 현황 & 남은 마일스톤
- [x] 웹 프로토타입 코어 완성 (진자 물리·PC-98 비주얼·3-Case STRIKE·4슬롯 Lv.1~3 증강 13종·Step 1~4: 5단계 스타일 랭크/6분 타이머, 5-Cut 옥상 오프닝, 6분 보스전, Lv.3 `APEX CUT` 6종)
- [ ] `game.js` 역할별 모듈 분리 리팩토링 (토큰 절감 & C++ 1:1 포팅 대비)
- [ ] 초경량 칩튠 효과음 (WebAudio → 추후 ESP32 피에조 부저/스피커)
- [ ] LILYGO T-Display-S3 (PlatformIO + `TFT_eSPI`) C++ 포팅 및 실기기 60fps 검증
