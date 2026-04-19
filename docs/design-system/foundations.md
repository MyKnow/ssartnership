# Foundations

## Color
- `background`: 페이지 기본 배경
- `background-muted`: 페이지 depth를 만드는 보조 배경
- `surface / surface-muted / surface-elevated / surface-overlay`: 카드와 레이어 계층
- `border / border-strong`: 보더 강도 2단계
- `foreground / foreground-soft / muted-foreground`: 텍스트 위계
- `primary / primary-emphasis / primary-soft`: 핵심 액션 색
- `accent`: 브랜드 메타 강조
- `success / warning / danger`: 상태색

## Typography
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
- 다크모드 elevation은 검은 그림자만으로 구분하지 않는다. 전역 `--shadow-*` 토큰은 상단 inset highlight, 약한 gray halo, 적은 수의 drop shadow로 레이어를 드러내되 과한 광택감은 피한다.
- 새 컴포넌트는 `shadow-sm/md/lg/2xl` 대신 `shadow-[var(--shadow-flat)]`, `shadow-[var(--shadow-raised)]`, `shadow-[var(--shadow-floating)]`, `shadow-[var(--shadow-overlay)]` 중 의미에 맞는 토큰을 우선 사용한다.

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
