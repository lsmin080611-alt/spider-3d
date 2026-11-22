# Spider 3D — 코드 아키텍처, 하드웨어 사양 & 개발 워크플로우

> **목적:** 새 대화나 기능 수정 시 AI가 매번 긴 과거 채팅을 뒤지지 않고, 파일 구조·하드웨어 제약·협업 규칙을 즉시 파악하도록 유지하는 프로젝트 지도(`ARCHITECTURE.md`)입니다.

---

## 1. 타겟 하드웨어 사양 (LILYGO T-Display-S3)
- **MCU / 메모리:** ESP32-S3 (512KB SRAM + **8MB PSRAM**)
- **디스플레이:** 1.9인치 ST7789 컬러 LCD, 가로 해상도 **320×170** (총 54,400px, 16-bit RGB565 프레임버퍼 108.8KB)
- **통신 인터페이스:** **8-bit 8080 병렬 인터페이스** 직결 (일반 SPI 대비 고속 전송, 60~100fps 구동 가능)
- **물리 조작계:**
  - 외장 아날로그 조이스틱: `GPIO 1`, `GPIO 2`
  - 내장 택타일 버튼 2개: `GPIO 14` (SWING), `GPIO 0` (STRIKE / 보조)
- **투명화 규칙 (ESP32 이식 시):** 알파 채널 PNG 대신 크로마키(`TFT_MAGENTA` `#FF00FF` 또는 단색 키) + `TFT_eSPI`의 `pushSprite(x, y, transparentColor)` 활용.

---

## 2. 웹 프로토타입 파일 구조
현재 HTML5 Canvas(320×170 `image-rendering: pixelated`) 기반으로 PC/모바일 브라우저에서 프로토타이핑 중.

### 현재 5파일 분리 구조 (로컬 더블클릭 실행용)
> CORS 에러 방지를 위해 `type="module"` 대신 일반 `<script src="...">` 순서 로드를 사용.
1. `index.html` — 화면 뼈대, T-Display-S3 프레임, 스크립트 순차 로드
2. `style.css` — 기기 베젤, 가상 조이스틱, 2버튼 택타일 레이아웃, 모바일 반응형
3. `assets.js` — PC-98 팔레트, **2번 구름** 픽셀 배열, 360° 파노라마, 건물 타일, 스파이더맨 스프라이트
4. `augments.js` — 증강 데이터, `augLevels`, `getAugStats()`(if문 기반 중앙 스탯 계산), `openAugmentDraft()`, `draftLockTimer`, 320×170 카드 선택 UI
5. `game.js` — 웹 스윙 진자 물리, 3-Case STRIKE 전투, XP/티어 스폰, 3D 투영 렌더링, 메인 루프 (`initApp()`)

### 향후 리팩토링 목표 구조 (파일당 200~300줄 제한 / C++ 포팅 대비)
`game.js`가 비대해질 경우 아래 단위로 분리하여 PlatformIO(`.h`/`.cpp`) 1:1 이식 준비:
- `config.js` (밸런스 상수) / `state.js` (공유 상태) / `physics.js` (스윙·충돌) / `combat.js` (STRIKE·적·XP) / `augments.js` / `renderer.js` (3D 투영·PC-98 HUD) / `main.js` (입력·루프)

---

## 3. 코드 수정 시 절대 깨지면 안 되는 규칙 (Invariants)
1. **생략(`// ... existing code ...`) 금지:** 함수나 파일을 교체할 때 핵심 변수(`augLevels`, `shockwaves`, `augmentDraftOpen`, `resetAugments()`, `getAugStats()`)가 누락되어 초기화 검은 화면 오류가 나지 않도록 주의.
2. **HTML 문자열 인젝션 주의:** 프리뷰 파싱 오류(`SyntaxError`) 방지를 위해 `innerHTML` 내 중첩 템플릿 리터럴 대신 `textContent`/`className` 갱신 사용.
3. **바닥 충돌 방어 유지:** `py <= 4.0~5.0` 구간에서 스윙 강제 해제 및 `vy` 상한 유지 (로켓 사출 버그 재발 방지).
4. **증강 오입력 방지 유지:** 증강 선택 화면에서 `SWING(SPACE)` 확정 금지 + `0.65초` 잠금 타이머 유지.

---

## 4. 폰·웹 채팅 협업 규칙
- **1대화 = 1기능:** 한 번에 1가지 기능/밸런스만 수정 후 즉시 테스트.
- **부분 패치 원칙:** 전체 HTML 출력 대신 **"수정할 함수 1개 통째로"** 또는 **"기존 코드 A → 바꿀 코드 B (Diff)"** 형식으로 요청.
- **세이브 포인트 관리:** 정상 작동이 확인된 최신 코드 버전은 이 노트북에 `[코드세이브] vX.X_기능명` 형태의 마크다운 소스로 별도 보관.

---

## 5. 현재 진행 현황 & 다음 마일스톤 (Roadmap)
- [x] 3D 진자 웹 스윙 물리 (U-Swing, Apex Float, 바닥 로켓 버그 수정, 650m 고도)
- [x] PC-98 빈티지 디더링 리마스터 & 2번 구름 통일 & 360° 파노라마
- [x] 2버튼(SWING/STRIKE) 3-Case 전투 & 후방 공간 판정
- [x] 실력 기반 XP 레벨업 & 초반 2단계 몹 가속 원샷 밸런스
- [x] 유기적 증강 + 기믹 증강 구조 & 0.65초 오입력 방지
- [ ] 최신 정상 작동 코드 전문을 노트북 `[코드세이브]` 소스로 백업
- [ ] 스윙 궤적 주변 적 유도/뭉침 보정 및 점수 연동 시간대 변화(낮→노을→야경 팔레트 스왑) 검토
- [ ] 초경량 칩튠 효과음(WebAudio → 추후 ESP32 피에조 부저/스피커) 추가
- [ ] LILYGO T-Display-S3 (PlatformIO + `TFT_eSPI`) C++ 포팅 및 실기기 60fps 검증
