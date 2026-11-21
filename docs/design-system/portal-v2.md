---
title: Portal v2 디자인 시스템
type: design-system
status: active
authority: normative
---

# Portal v2

파트너 포털과 어드민(`/partner/**`, `/admin/**`)에 적용하는 운영용 디자인 시스템이다. 공개 사용자 화면의 [Foundations](./foundations.md)·[Components](./components.md)와 별개이며, 이관은 [Issue #616 명세](../specs/616-portal-admin-v2/spec.md)가 관리한다. 이관이 끝나기 전에는 v2를 적용한 화면만 이 문서를 따른다. 원본은 Figma `NX6dwapOy7FSyejB0eLXj1`의 `05 · 파트너 v2 디자인 시스템`이다.

## 토큰

- 색·radius는 `src/app/globals.css`의 `--partner-v2-*` 변수이고 Tailwind 별칭은 `pv2-*`다(`bg-pv2-surface`, `text-pv2-muted`, `rounded-pv2-panel`). 변수 이름은 Figma의 codeSyntax와 같다. 새 hex나 임의 radius(`rounded-[…]`)를 쓰지 않는다.
- v2는 라이트 전용이다. `.portal-v2` 루트가 `color-scheme: light`를 강제하고 `html.dark`가 v2 토큰을 덮어쓰지 않는다. v2 셸에는 테마 전환 버튼을 두지 않는다.
- 글꼴은 앱의 Pretendard를 쓴다. Figma의 Noto Sans KR은 편집 도구 제약으로 쓴 대체 글꼴이다.
- 타입 스케일: `pv2-title`(26/38, 모바일 22/32·700), `pv2-heading`(18/28·700), `pv2-body`(14/22·400), `pv2-label`(14/22·500), `pv2-caption`(12/18·400), `pv2-metric`(28/40·700, 숫자 폭 고정). 사용자 정의 유틸리티에는 `md:` 같은 variant가 붙지 않으므로 반응형이 필요하면 기본 유틸리티를 쓴다.
- 간격은 4px 배수다. 형제 간격은 부모의 `gap`, 컨테이너 여백은 `padding`이 소유한다. 페이지 좌우 패딩은 모바일 16·태블릿 이상 24, 패널 padding은 모바일 16·`md` 이상 24다.
- 반경: 배지 6, 컨트롤 8, 패널 12. 패널에는 그림자를 쓰지 않고 1px `pv2-border`로 구분한다.
- 브레이크포인트: 모바일 `<768px`(헤더 56, 사이드바 대신 메뉴 대화상자와 하단 탭), 태블릿 `768–1199px`(72px 아이콘 레일, 헤더 64), 데스크톱 `1200px 이상`(240px 사이드바, 헤더 64)이다. 데스크톱 시작점은 이름 있는 브레이크포인트 `pv2-desktop:`(75rem)로 쓴다. `min-[1200px]:`는 `md:`와 단위가 달라 CSS 순서가 뒤집혀 적용되지 않는다.

## 대비와 포커스

- 본문 4.5:1, 컨트롤 경계·핵심 그래픽 3:1 이상. `muted`(#5c6c82)는 본문 보조 글자용이고 `subtle`·`disabled-text`는 정보 전달용 본문에 쓰지 않는다. 상태 배지는 색과 함께 상태 이름을 글자로 표시한다.
- 포커스는 Figma의 이중 링이다. `portal-v2-classes.ts`의 `PV2_FOCUS_RING_CLASS_NAME`(표면 위)과 `PV2_FOCUS_RING_ON_SIDEBAR_CLASS_NAME`(네이비 사이드바 위)를 쓴다. 공용 `ring-ring` 규칙([Foundations](./foundations.md#focus))의 v2 영역 예외이며, 반투명 링과 `outline-none`은 쓰지 않는다.
- 모든 조작 요소는 44×44px 이상의 터치 영역을 갖는다. 데스크톱 40px 컨트롤은 `TOUCH_TARGET_HIT_AREA_CLASS_NAME`으로 히트 영역을 넓힌다. hover/focus 전환은 120ms ease-out이며 `prefers-reduced-motion`에서는 전역 규칙이 끈다.

## 컴포넌트

모두 `src/components/portal-v2/`에 있고 스토리는 `Domains/PortalV2/*`다.

- `PortalShell`: 사이드바·헤더·모바일 메뉴 대화상자·하단 탭을 가진 공용 셸. 경로 판단과 권한은 모르고 호출부가 `navGroups`(`active` 표시)와 `mobileNavItems`(최대 3개 + 더보기)를 넘긴다. 서버 인가를 화면 숨김으로 대신하지 않는다. 모바일 메뉴는 `useDialogFocus`·`useBodyScrollLock`을 써 Escape·닫기 버튼으로 닫히고 열었던 버튼으로 포커스가 돌아온다.
- `PortalButton`·`PortalButtonLink`(primary·secondary·danger): 모바일 44 / `md` 이상 40, 좌우 16, Label 14. 화면당 primary는 하나다.
- `PortalBadge`(neutral·info·success·warning·danger): 높이 28, 좌우 8.
- `PortalPanel`: 제목을 접근 가능한 이름으로 연결한 `section`. `PortalPageHeader`: 페이지의 유일한 `h1`과 주요 행동 1개. `PortalMetricGrid`: 모바일 2열·`md` 이상 4열.
- `PortalStatePanel`(empty·loading·error·forbidden): 빈 상태는 미수집·권한 없음과 구분하고 다음 행동을 안내한다. 오류는 원인 대신 복구 경로를 안내하고 입력·필터는 유지한다. 서버 인가를 대신하지 않는다.
- `PortalField`·`PortalInput`·`PortalSelect`·`PortalTextarea`·`portalFieldProps`: 라벨·도움말·오류를 `aria-describedby`로 연결한다. 오류는 border 2px과 `role="alert"` 문구로 색 외에도 구분한다. FE 사전 검증과 서버 검증은 기존 공용 schema·helper를 그대로 쓰고 첫 오류 필드 focus를 유지한다.
- `PortalDataTable`·`PortalTablePanel`: `md` 이상은 헤더와 본문이 같은 `colgroup`을 쓰는 `table`, 모바일은 같은 열 정의에서 만든 `dl` 카드 목록이다. 한 열에 `primary`를 주면 카드 제목이 된다. 행 전체를 링크로 만들지 않고 조작은 `actions` 열에 둔다.
- `PortalTabs`: 같은 화면의 보기 전환(ARIA tabs, 방향키·Home·End). 다른 URL로 이동하는 메뉴는 링크 목록으로 만든다.
- `PortalPagination`: 안내 + 이전/다음 링크. URL query가 단일 기준이다.
- `PortalFilterBar`·`PortalSearchField`: 검색·정렬·상태 필터를 한 줄(모바일 세로)로 둔다. 기본은 GET 폼이고 기본 필터가 4개를 넘으면 `AdvancedFilterDisclosure`로 접는다.
- `PortalConfirmDialog`: 공용 `Modal`의 포커스·Escape 계약을 쓰는 확인 단계. 처리 중에는 닫히지 않는다.

## 토큰 브리지 (아직 옮기지 않은 화면)

`.portal-v2` 루트(파트너 셸·어드민 셸·인증 프레임)는 기존 의미 토큰(`--background`, `--surface*`, `--border*`, `--foreground`, `--muted-foreground`, `--primary*`, `--success/--warning/--danger`, `--shape-radius-*`, `--shadow-*`)을 v2 값으로 다시 매핑하고, `ui-kicker`·`ui-page-title`·`ui-section-title`·`ui-body`·`ui-caption`을 v2 타입 스케일로 바꾼다. 그래서 `Card`·`Surface`·`ui/Button` 등 기존 컴포넌트를 쓰는 파트너·어드민 화면도 v2 색·12px radius·그림자 없음·타입 스케일을 따른다. 규칙:

- 매핑은 포털 안에서만 적용된다. 공개 사이트와 다크 모드 토큰은 그대로다. body로 포털되는 공용 `Modal`은 `.portal-v2` 안에서 열렸을 때 `data-portal-v2-scope` 속성을 붙여 같은 매핑을 받는다.
- 브리지는 색·형태만 맞춘다. 레이아웃·정보 구조는 Figma와 같은 화면 단위 이관(`PortalPanel`·`PortalDataTable` 등)이 필요하며, 화면을 옮길 때 브리지 의존을 줄인다.
- 새 화면은 브리지가 아니라 `portal-v2` 컴포넌트를 직접 쓴다.
