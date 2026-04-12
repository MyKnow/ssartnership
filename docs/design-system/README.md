# UI System Reset

SSARTNERSHIP 웹 UI의 공용 기준 문서다. 실제 구현은 이 문서를 기준으로 유지한다.

## Design Direction
- 차분한 네이비/슬레이트 기반
- 시스템색 중심, 상태색은 제한적으로만 사용
- 연속형 radius와 부드러운 surface 계층
- 넓은 화면에서도 centered shell 유지
- 모바일 우선 반응형
- 모션은 조용하지만 분명하게

## Document Map
- `foundations.md`: color, typography, elevation, radius, spacing
- `layout-and-motion.md`: grid, shell, breakpoints, motion
- `elements.md`: button, input, badge, tabs, feedback
- `components.md`: shell, filter bar, stats, form section, data panel

## Operational Rule
- 새 UI는 먼저 문서와 인앱 style guide에 반영한다.
- 페이지 로컬 Tailwind 조합보다 공용 컴포넌트를 우선 사용한다.
- 카테고리별 색은 구조적 chrome을 결정하지 않는다. 상태/메타 표현 수준에서만 제한적으로 사용한다.
