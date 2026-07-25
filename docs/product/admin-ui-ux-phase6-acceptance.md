# 관리자 UI/UX Phase 6 수용 기준

이 문서는 관리자 UI/UX 변경을 리뷰할 때 사용하는 시각 회귀·상태·반응형 수용 기준이다. Phase 1~5의 화면 구조와 공용 컴포넌트를 기준으로 하며, 새 도메인 기능이나 권한 모델을 정의하지 않는다.

## 검증 대상

Phase 5 운영 workspace의 대표 Storybook story를 baseline으로 관리한다.

| 화면 | 대표 행동 | 필수 상태 |
|---|---|---|
| `AdminOperationFlow` | 다음 운영 단계로 이동 | current / complete / upcoming |
| `AdminPushManager` | 대상 확인 후 발송 검토 | center / send / preview failure / logs |
| `AdminNotificationsView` | 알림 확인·이동·수신 설정 | unread / empty / settings pending |
| `AdminAdvertisementView` | 홈 노출 카드 구성 | ready / save pending / status feedback |
| `AdminEventListView` | 이벤트 상태별 다음 행동 선택 | upcoming / active / ended / empty |
| `AdminEventDetailView` | 기간·대상·공개 링크 검토 | registered / unregistered / save feedback |
| `AdminCycleView` | 기수 기준과 운영 그룹 확인 | automatic / override / generation selected |
| `AdminAccountsView` | 관리자 권한 범위·위험 액션 관리 | active / super-admin guard / feedback |

## Viewport 기준

시각 baseline은 CI Chromium, `ko-KR`, light color scheme, `document.fonts.ready`, reduced motion에서 캡처한다.

- 필수 screenshot: 360px mobile, 820px tablet, 1366px desktop
- 필수 overflow: 320·360·390·768·820·1024·1366·1440·1536px
- `document.documentElement.scrollWidth === clientWidth`를 만족해야 한다.
- 모바일에서 단계 흐름·버튼·표면이 숨겨진 가로 스크롤에 의존하지 않아야 한다.

## 상태 수용 기준

- ready: 화면의 단일 주요 행동과 현재 상태가 첫 viewport에서 구분된다.
- empty: 왜 비어 있는지와 다음 복구 행동을 함께 제공한다.
- error: 안전한 안내와 재시도/대체 행동을 제공하며 서버 내부 오류·raw `Error.message`를 렌더링하지 않는다.
- forbidden: 필요한 권한과 이동 가능한 대체 목적지를 안내한다.
- pending: 요청 중인 항목만 비활성화하고 중복 실행을 막는다.
- partial failure: 성공·실패·재시도 범위를 구분하고 전체 화면을 막지 않는다.

## 접근성·콘텐츠 체크

- 모든 주요 행동과 icon action에 visible focus가 있다.
- 키보드만으로 탭, drawer, modal, form, confirmation 흐름을 완료할 수 있다.
- 터치 목표는 최소 44px이며, 긴 한국어 문장은 `keep-all`을 무리하게 강제하지 않고 줄바꿈·containment를 보장한다.
- flex/grid 자식에는 필요 시 `min-w-0`를 적용하고 table은 panel 내부 scroll 또는 card 전환을 사용한다.
- reduced motion에서 정보 전달이 사라지지 않는다.
- 색상만으로 상태를 구분하지 않고 표면·테두리·텍스트·아이콘을 함께 사용한다.

## URL·권한 회귀 체크

- 새 목적지 이동은 `push`, canonical·완료·탭 상태 교체는 `replace`, 서버 접근 제어는 서버 redirect, 재검증은 `refresh`를 사용한다.
- 기존 `href`, `returnTo`, 목록 query, 권한별 메뉴 필터링을 보존한다.
- 서버 action/API/RLS의 권한과 도메인 판정 로직을 UI baseline 변경에서 바꾸지 않는다.

## Baseline 변경 절차

1. 변경 화면·상태·viewport를 PR 본문에 적는다.
2. 의도한 UI 변경인지 먼저 Storybook에서 확인한다.
3. `npm run test:visual -- tests/visual/admin-operations.visual.spec.ts`를 실행한다.
4. 의도하지 않은 픽셀 차이, overflow, 폰트 안정화 실패를 먼저 해결한다.
5. 승인된 경우에만 snapshot을 갱신하고, 변경 이유·상태·viewport를 PR에 남긴다.

## 실행 명령

```bash
npm run build-storybook
npm run test-storybook
npm run test:visual -- tests/visual/admin-operations.visual.spec.ts
```

Visual screenshot은 `tests/visual/__snapshots__/`의 추적 자산이며, 일회성 브라우저 캡처는 `.tmp/ui-qa/`에 둔다.
