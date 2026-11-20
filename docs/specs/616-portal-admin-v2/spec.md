---
title: 파트너 포털·어드민 v2 화면 이관 명세
type: feature-spec
status: active
authority: normative
---

# 파트너 포털·어드민 v2 화면 이관 명세

[Issue #616](https://github.com/MyKnow/ssartnership/issues/616)은 Figma에서 검수를 마친 파트너 포털·어드민 v2 디자인을 실제 Next.js 앱에 옮기고, dev·Preview 검증을 거쳐 main으로 승격하는 작업이다. 구현 순서와 기술 경계는 [구현 계획](./plan.md), 재개 가능한 체크리스트는 [작업 기록](./tasks.md)에 있다.

## 왜

- 파트너 포털과 어드민은 공개 사용자 화면과 같은 큰 radius·glass 표면을 써서 정보 밀도가 낮고, 운영자가 표·상태를 한눈에 비교하기 어렵다.
- Figma v2(파일 `NX6dwapOy7FSyejB0eLXj1`)는 네이비 사이드바, 밝은 데이터 영역, 12px 패널, 40/44px 컨트롤로 두 운영 화면을 하나의 시스템으로 묶었다. 47경로·156화면과 상태·대화상자·메뉴 294개의 시각 검수는 2026-10-23에 끝났다.

## 범위

- 파트너 12개, 어드민 35개 제품 경로와 각 경로의 반응형·빈 상태·로딩·오류·권한 없음·완료 상태. 경로와 Figma 노드의 대응은 [작업 기록](./tasks.md)의 표가 기준이다.
- 공용 v2 토큰, 셸(사이드바·상단 바·모바일 메뉴·하단 탭), 버튼·배지·패널·지표·표·필터·폼·확인 대화상자.
- Figma 대응표에 없는 경로는 v2 셸만 적용하고 본문은 기존 컴포넌트를 유지한다. 대상: `/admin/mcp`, `/admin/mcp/authorize`, `/admin/mcp/reviews/[reviewId]`, `/admin/cycle/mock`, `/partner/setup`(mock 전용). 리다이렉트 전용 페이지(`/admin/promotions`, `/admin/login`, `/admin/setup/[token]`, `/admin/members/mock`, `/partner/plans`, `/partner/services/**`, `/partner/companies/[companyId]/{account,notifications,support}`)는 바꾸지 않는다.

## 범위 밖

- 공개 사용자 화면(`src/app/(site)/**`)과 회원 인증 흐름.
- 새 운영 지표 수집. Figma의 "확인된 이용·이용자·직원 확인"은 수집 기능 도입 제안이라 실제 기능으로 출시하지 않는다. 지금 데이터가 있는 조회·저장 지표만 보여 준다.
- DB 스키마·migration·Repository 계약 변경. 화면에 필요한 데이터가 없으면 그 블록을 빼고 Issue에 기록한다.
- 다크 테마. v2는 라이트 전용이다(결정 D1).

## 불변조건

- 인증·권한·검증은 그대로 둔다. 서버 인가(`requireAdminPageAccess`, 관리자 권한 필터, 파트너 세션·회사 범위 확인)와 server action·route 검증은 옮기기만 하고 약화하지 않는다. 화면 숨김을 인가로 쓰지 않는다.
- 폼은 FE 사전 검증과 BE 검증이 같은 schema·helper를 쓰는 현재 구조를 유지하고, 첫 오류 필드 focus와 필드 오류 표시를 v2 폼에서도 지킨다.
- 데이터 접근은 기존 service·Repository 인터페이스로만 한다. 페이지에서 Supabase를 직접 조회하지 않는다.
- mock/Supabase 전환, `isPartnerPortalMock`, Storybook mock 시나리오(`src/lib/mock/scenarios/`)가 계속 동작한다.
- URL·query 계약(필터·페이지·`returnTo`)과 기존 링크 목적지를 바꾸지 않는다.
- 모든 조작 요소는 44×44px 이상 터치 영역, 보이는 포커스 링, 본문 4.5:1·경계 3:1 대비를 지킨다.

## 결정

- D1 테마: v2 영역은 라이트 전용이다. `.portal-v2` 루트가 `color-scheme: light`와 v2 토큰을 강제하고, 파트너·어드민 셸에서 테마 전환 버튼을 뺀다. 공개 화면의 다크 모드는 그대로다.
- D2 글꼴: Figma의 Noto Sans KR은 MCP 편집 제약 때문에 쓴 대체 글꼴이다. 앱은 기존 Pretendard를 쓰고 크기·행간·굵기만 Figma Text Style을 따른다.
- D3 토큰 이름: CSS 변수는 Figma codeSyntax(`--partner-v2-*`)를 따르고, Tailwind 별칭은 `pv2-*`(`bg-pv2-surface`, `rounded-pv2-panel`)로 쓴다. 어드민도 같은 토큰을 공유한다.
- D4 포커스: v2는 Figma의 "white 2 + blue 2" 이중 링을 `ring-pv2-blue` + 표면색 offset으로 구현한다. 공용 `ring-ring` 규칙의 v2 영역 예외이며 [디자인 시스템 문서](../../design-system/components.md)에 기록한다.
- D5 지표: 대시보드는 "관심 지표"임을 밝히는 측정 안내 패널을 유지하고, 매출·순이익·신규 고객 효과로 해석되는 문구를 쓰지 않는다.

## 수용 기준

1. 47개 대상 경로가 v2 셸·토큰·컴포넌트로 렌더되고, 360·820·1440px에서 Figma 대응 프레임과 정보 구조·위계·상태가 일치한다. 가로 overflow와 콘텐츠 가림이 없다.
2. 각 경로의 빈 상태·로딩·오류·권한 없음·완료 상태가 v2 `PortalStatePanel` 또는 동등한 v2 표현으로 보인다.
3. 기존 단위·계약·E2E 테스트가 통과한다. 의도한 시각 변경으로 바뀐 visual snapshot은 검토 후 갱신한다.
4. 키보드만으로 사이드바·모바일 메뉴·하단 탭·표·폼·확인 대화상자를 조작할 수 있고, 모바일 메뉴는 Escape·닫기 버튼으로 닫히며 열었던 버튼으로 포커스가 돌아온다.
5. `npm run verify:change`(작업 PR), `npm run verify:release`(승격 전)가 통과하고, Preview에서 파트너·어드민 주요 흐름을 실제 계정으로 확인한 뒤 main으로 승격한다.
