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
- 크기는 `sm / md / lg / icon`이 모두 44px 최소 터치 영역을 가진다. 밀집 툴바(알림함 일괄 처리 등)는 `size="compact"`로 시각 32px + 투명 의사요소 44px 히트 영역을 쓰고, `!h-8 !min-h-0` 같은 `!` 오버라이드로 줄이지 않는다.
- 아이콘 전용 보조 액션은 `IconActionButton`(시각 32px, 히트 영역 44px)을 `IconActionGroup` 안에서 쓴다. 그룹 기본 간격 12px은 인접 히트 영역이 겹치지 않게 하는 값이다.
- `primary-soft text-primary`는 badge, info message, soft CTA처럼 선택 상태가 아닌 낮은 강조에만 사용한다.

## Inputs
- control radius 통일
- background는 surface 계층을 따른다
- focus는 border 강조와 공용 포커스 링(Foundations > Focus)으로 표현한다
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
- 다이얼로그는 `ui/Modal`을 우선 쓴다. 전체 화면 라이트박스·바닥 시트처럼 Modal 레이아웃이 맞지 않을 때만 직접 구현하고, 그때도 `useDialogFocus`(초기 포커스·Tab 순환·Escape·opener 복원)와 `useBodyScrollLock`(겹침 안전 ref-count 잠금)을 쓴다. 컨테이너에는 `role="dialog" aria-modal="true"`, 제목 연결(`aria-labelledby` 또는 `aria-label`), `tabIndex={-1}`을 둔다.
- 오버레이 안의 스크롤 영역에는 `overscroll-contain`을 붙여 배경 페이지로 스크롤이 이어지지 않게 한다.
- 삭제·로그아웃처럼 되돌릴 수 없거나 세션을 끊는 작업의 확인은 네이티브 `window.confirm` 대신 `ConfirmDialog`(제목 질문형, 결과 설명, 취소·확인 순서, 파괴적 작업은 `danger`)를 쓴다. 다시 켤 수 있는 설정 변경에는 확인 단계를 두지 않는다.
- 네이티브 `<dialog>` 메뉴 안에서 연 `Modal`은 그 dialog의 top layer에 붙는다. 메뉴는 `hasOpenManagedDialog()`로 겹친 모달이 열려 있을 때 자체 Escape·Tab 처리를 건너뛴다.
- 문맥 안내/주의는 `InlineMessage`
- Toast는 일시적 확인용이며 자동 소멸과 함께 우측 닫기 버튼으로 즉시 제거할 수 있어야 한다. 표면은 semantic toast glass token, blur, 얇은 highlight로 구성하고 라이트·다크 모드에서 문구 대비를 유지한다.
