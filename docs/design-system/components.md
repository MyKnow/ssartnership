# Components

## Card / Surface
- `Card tone="default"`는 독립 섹션/패널, `muted`는 내부 inset, `elevated`는 주요 카드/CTA, `hero`는 강한 강조 표면으로 사용한다.
- 카드 내부의 보조 행, 입력 그룹, 세부 정보 박스는 `Surface level="inset"`을 우선 사용한다.
- modal, drawer, toast처럼 화면 위에 뜨는 레이어는 `Surface level="overlay"` 또는 `bg-surface-overlay`를 사용한다.

## ShellHeader
- 페이지 진입부의 제목, 설명, 우측 액션을 통일한다.

## FilterBar
- 검색/정렬/상태 필터를 같은 surface 안에서 다룬다.
- 작은 화면에서는 세로, 큰 화면에서는 가로 정렬한다.

## DataPanel / StatsRow
- 수치, 짧은 메타, 설명을 통일된 density로 표현한다.

## FormSection
- 폼은 의미 단위별로 section을 나누고, 각 section은 제목과 짧은 설명을 가진다.

## ResponsiveGrid
- 카드 목록, 요약 패널, 문서 샘플을 auto-fit grid로 배치한다.

## MotionReveal
- 목록/섹션 등장 애니메이션은 이 컴포넌트로 통일한다.
