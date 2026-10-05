---
title: Layout And Motion
type: design-system
status: current
authority: normative
---

# Layout And Motion

## Grid
- 기본 콘텐츠는 centered shell 안에 배치한다.
- `Container size=page`가 기본이다.
- wide 화면도 콘텐츠는 `grid-max`를 넘기지 않는다.
- full bleed는 배경 decorate에만 허용한다.

## Responsive Rules
- 모바일 우선 1열
- 충분한 폭이 확보될 때만 2열/3열로 확장
- 컨트롤 바와 필터는 작은 화면에서 세로 스택, 큰 화면에서 행 정렬
- 작은 화면에서 과도한 chip 군집과 좌우 padding으로 줄바꿈을 유발하지 않는다
- 기준 검증 폭은 320/360/390, 768/820/1024, 1366/1440/1536px다.
- 핵심 시각 기준선은 360/820/1366px actual View Story로 관리한다.
- 긴 한국어 제목은 의미 단위 줄바꿈을 허용하되 액션·상태를 밀어내지 않고, URL·식별자는 `min-width: 0`과 안전한 word break로 containment한다.
- 모바일 sticky action은 콘텐츠 마지막 action과 같은 primary를 중복 강조하지 않는다.

## Decorate
- hero는 navy gradient + subtle accent glow
- 일반 페이지는 연한 radial highlight와 grid pattern 정도만 사용
- decorative layer는 정보 위계를 방해하지 않아야 한다

## Motion
- 모션 라이브러리는 쓰지 않는다. `framer-motion`은 관리자 번들 축소를 위해 제거했다([관리자 콘솔 성능 기준선](../performance/baselines/admin-console.md)).
- 모션은 Tailwind transition 유틸리티와 `src/app/globals.css`의 keyframes로만 구현한다.
- 목록·섹션의 등장 reveal 애니메이션은 기본으로 두지 않는다. 콘텐츠는 정적으로 렌더한다.
- modal/toast/메뉴 패널: 짧은 ease-out transition(200ms 내외)
- 자동 재생·반복 애니메이션(캐러셀, 인증 카드 장식)은 사용자가 멈출 수 있거나 정보 전달에 필수적이지 않아야 한다.
- `prefers-reduced-motion: reduce`에서는 `globals.css`의 전역 규칙이 animation·transition 시간을 사실상 0으로 줄인다. 개별 컴포넌트는 필요하면 `motion-reduce:` 변형을 추가한다.
