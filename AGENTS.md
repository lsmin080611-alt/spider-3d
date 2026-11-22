# Spider 3D — Agent Operating Rules

## 1. 프로젝트 기준 문서
- 작업 전 `docs/SPEC.md`, `docs/ARCHITECTURE.md`, `docs/BACKLOG.md`를 우선 참조한다.
- 모든 설계와 최적화는 **LILYGO T-Display-S3 (ESP32-S3, 320×170, 60fps)** C++(PlatformIO + TFT_eSPI) 이식을 전제로 한다.

## 2. 절대 깨지면 안 되는 규칙 (Invariants)
1. **생략 금지:** 코드 수정 시 핵심 상태 변수(`augLevels`, `shockwaves`, `augmentDraftOpen`, `resetAugments()`, `getAugStats()`)가 누락되지 않도록 주의한다.
2. **CORS 대응 구조 유지:** 별도 번들러 도입 전까지 `type="module"` 대신 `index.html`의 순차 `<script src="...">` 로드 방식을 유지한다.
3. **바닥 로켓 사출 버그 방어:** 스윙 중 지면(`py <= 4.0~5.0`) 접촉 시 즉시 거미줄 강제 해제 및 수직 속도 상한 처리를 유지한다.
4. **증강 오입력 방지:** 증강 선택 UI에서 `SWING(SPACE/IO14)` 버튼 확정 금지 및 `0.65초` 입력 잠금(`draftLockTimer`)을 유지한다.
5. **렌더링 경량화:** 실시간 셰이더/알파 블러 배제, 사전 베이크 패턴·크로마키 스프라이트·벡터 선분/원형 이펙트 위주로 구현한다.

## 3. 작업 방식
- 한 번에 1가지 기능/밸런스만 수정하고 브라우저 프리뷰로 즉시 검증한다.
- 기능 구현 완료 시 `docs/BACKLOG.md`에서 완료 항목을 정리하고 `docs/SPEC.md`에 반영한다.
