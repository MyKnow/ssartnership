---
title: Elements
type: design-system
status: current
authority: normative
---

# Elements

## Buttons
- 기본 액션은 `primary`
- 보조 이동은 `ghost` 또는 `secondary`
- 위험 액션은 `danger`
- 정보 강조용 정적 액션은 `soft`
- 선택된 조작 요소(active tab/filter/nav)는 `primary-soft`가 아니라 `bg-primary text-primary-foreground border-primary` 계열로 표시한다.
- `primary-soft text-primary`는 badge, info message, soft CTA처럼 선택 상태가 아닌 낮은 강조에만 사용한다.

## Inputs
- control radius 통일
- background는 surface 계층을 따른다
- focus는 border + ring으로 표현한다
- disabled는 opacity가 아니라 contrast 감소로 표현한다

## Badges And Chips
- badge는 상태/라벨
- chip은 메타 태그
- 카테고리 색은 badge/chip 수준의 accent 표현에만 사용 가능

## Tabs
- 탭은 콘텐츠 정책이나 뷰 모드를 분리할 때만 사용한다
- 모바일에서도 두 줄 난잡함이 생기지 않도록 label 길이를 제한한다
- 선택 상태는 색상 대비, border, 가능하면 `aria-pressed`/`aria-current`와 아이콘/indicator를 함께 사용해 다크모드에서도 구분되게 한다.

## Feedback
- 짧은 폼 메시지는 `FormMessage`
- 문맥 안내/주의는 `InlineMessage`
- Toast는 일시적 확인용이며 자동 소멸과 함께 우측 닫기 버튼으로 즉시 제거할 수 있어야 한다. 표면은 semantic toast glass token, blur, 얇은 highlight로 구성하고 라이트·다크 모드에서 문구 대비를 유지한다. `notify(message, { tone, durationMs })`의 기본 톤은 안내(`role="status"`, 2.5초)이고, 실패를 알리는 호출은 `tone: "error"`를 명시해 `role="alert"`, danger 테두리·아이콘, 6초 노출로 성공 피드백과 구분한다. 노출 시간은 1~15초로 제한한다.
- Toast 뷰포트는 safe area 위 1rem(`bottom-safe-toast`)에 뜬다. 공개 하단 탐색, 관리자 모바일 하단 탐색(`data-admin-mobile-navigation`), 제휴처 상세 액션바, 플로팅 제출 버튼(`data-floating-submit-button="base"|"raised"`)이 있으면 `globals.css`의 `body:has(...) [data-toast-viewport]` 규칙으로 그 위에 띄운다. 새 하단 고정 요소를 추가할 때는 data 속성과 토스트 규칙을 함께 추가하고, `@layer utilities`의 safe area 클래스에는 Tailwind 반응형 variant가 생성되지 않으므로 `md:bottom-safe-*`처럼 쓰지 않는다.
