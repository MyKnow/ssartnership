# Elements

## Buttons
- 기본 액션은 `primary`
- 보조 이동은 `ghost` 또는 `secondary`
- 위험 액션은 `danger`
- 정보 강조용 정적 액션은 `soft`

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

## Feedback
- 짧은 폼 메시지는 `FormMessage`
- 문맥 안내/주의는 `InlineMessage`
- Toast는 일시적 확인용
