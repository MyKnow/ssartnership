---
title: Foundations
type: design-system
status: current
authority: normative
---

# Foundations

## Color
- `background`: 페이지 기본 배경
- `background-muted`: 페이지 depth를 만드는 보조 배경
- `surface`: 일반 패널과 카드
- `surface-muted`: 낮은 강조의 보조 영역
- `surface-inset`: 카드 내부 행, 요약 박스, 세부 정보처럼 부모 카드보다 낮은 영역
- `surface-control`: input/select/textarea/button 같은 조작 요소
- `surface-elevated`: 핵심 카드, CTA, 주요 섹션
- `surface-overlay`: modal, drawer, toast
- `toast-glass / toast-glass-border / toast-glass-highlight`: 일시적 overlay 피드백의 반투명 tint, 외곽선, 상단 highlight
- `border / border-strong`: 보더 강도 2단계
- `foreground / foreground-soft / muted-foreground`: 텍스트 위계
- `primary / primary-emphasis / primary-soft`: 핵심 액션 색
- `accent`: 브랜드 메타 강조
- `success / warning / danger`: 상태색
- `focus-ring`(`ring-ring`): 키보드 포커스 링 전용 솔리드 색. 라이트는 primary 네이비(`#213b68`), 다크는 `#d7e4ff` 계열로 배경 대비 3:1 이상을 유지한다.

## Focus
- 조작 요소의 키보드 포커스는 `src/components/ui/focus-ring.ts`의 공용 클래스(`focus-visible:ring-2 ring-ring ring-offset-2` + 표면별 오프셋 색)로 표현한다. Button, Input, Select, Textarea, PasswordInput, Modal 닫기 버튼이 이 계약을 쓴다.
- 포커스 링에 `ring-primary/NN` 같은 반투명 색을 새로 쓰지 않는다. 라이트 모드에서 경계 대비가 약 1.3~1.7:1로 떨어져 사실상 보이지 않는다.
- `outline-none` 대신 `outline-hidden`을 쓴다. 강제 색상 모드(Windows 고대비)에서 시스템 포커스 표시를 남긴다.
- 링 오프셋 색은 컨트롤이 놓인 표면(`ring-offset-background`, `ring-offset-surface-overlay`)에 맞춘다. 칩·테이블 행처럼 밀집한 표면은 `ring-inset`을 쓴다.

## Typography
- 글꼴: `pretendard` 패키지의 Pretendard Variable dynamic-subset CSS를 루트 레이아웃과 Storybook에서 같은 경로로 import해 `/_next/static/media`에서 자체 서빙한다. 외부 CDN `<link>`를 추가하지 않고, OFL 고지는 `globals.css` 상단의 보존 주석으로 유지한다.
- `ui-display`: 메인 히어로/강한 페이지 메시지. 36px~60px 범위와 매우 타이트한 line-height를 사용한다.
- `ui-page-title`: 페이지 제목. 32px~48px 범위와 tight line-height를 사용한다.
- `ui-section-title`: 섹션 제목. 22px~32px 범위와 tight line-height를 사용한다.
- `ui-body`: 본문/설명. 모바일은 14px, `sm` 이상은 16px, line-height는 24px을 사용한다.
- `ui-caption`: 메타 정보. 모바일은 12px, `sm` 이상은 13px, line-height는 20px을 사용한다.
- `ui-kicker`: 작은 upper meta label. 모바일은 11px, `sm` 이상은 12px, line-height는 20px을 사용한다.

## Elevation
- `flat`: 정보 밀도가 높은 기본 카드
- `raised`: 주요 카드, CTA 섹션
- `floating`: hero, 큰 CTA, 강조 surface
- `overlay`: modal, drawer, toast
- elevation은 shadow만이 아니라 surface 톤도 분리한다. `flat`은 기본 surface, `raised`는 약간 더 선명한 surface, `floating`과 `overlay`는 더 진한 또는 더 밀도 높은 surface를 사용해 레이어가 색으로도 읽히게 한다.
- 다크모드 elevation은 검은 그림자만으로 구분하지 않는다. surface 명도 차이와 border 강도를 먼저 읽히게 하고, 전역 `--shadow-*` 토큰은 상단 inset highlight와 적은 수의 drop shadow만 보조로 사용한다.
- 새 컴포넌트는 `shadow-sm/md/lg/2xl` 대신 `shadow-flat`, `shadow-raised`, `shadow-floating`, `shadow-overlay` 중 의미에 맞는 토큰을 우선 사용한다.
- 카드 내부의 단순 정보 박스는 `Surface level="inset"` 또는 `bg-surface-inset`을 사용한다. 독립 의미 단위가 아닌데 `Card`를 중첩하지 않는다.

## Radius
- control: 1rem
- card: 1.5rem
- panel: 1.875rem
- overlay: 2.25rem
- pill: full rounded

## Spacing
- 수직 리듬은 `gap-4 / 6 / 8 / 10 / 12` 위주로 제한한다.
- 작은 화면에서 불필요한 그룹 padding 증가를 피한다.
- 카드 내부 padding은 `md` 이상에서만 커진다.
