# Components

## Card / Surface
- `Card tone="default"`는 독립 섹션/패널, `muted`는 내부 inset, `elevated`는 주요 카드/CTA, `hero`는 강한 강조 표면으로 사용한다.
- 카드 내부의 보조 행, 입력 그룹, 세부 정보 박스는 `Surface level="inset"`을 우선 사용한다.
- modal, drawer, toast처럼 화면 위에 뜨는 레이어는 `Surface level="overlay"` 또는 `bg-surface-overlay`를 사용한다.

## ShellHeader
- 페이지 진입부의 제목, 설명, 우측 액션을 통일한다.
- 기존 화면 호환용이다. 구조를 새로 만드는 화면은 semantic `PageHeader`를 우선하고 점진적으로 교체한다.

## PageHeader / PageSection
- `PageHeader`는 breadcrumb/eyebrow, 유일한 `h1`, 짧은 설명, 유일한 primary CTA를 정의한다.
- `PageSection`은 `section`의 접근 가능한 제목과 선택 설명·보조 액션을 묶는다.
- shell 제목을 page `h1`으로 다시 반복하지 않는다.

## AdvancedFilterDisclosure
- 목록의 기본 필터 3~4개 바깥 조건을 접어 두되 적용 개수와 초기화 액션을 항상 보여준다.
- 펼침 상태와 무관하게 필터 값은 URL query가 단일 기준이다.

## CompactEntityRow / CollapsedList
- 운영 목록의 핵심 식별자, 상태, 한두 개 메타, 상세 이동만 한 행에 둔다.
- 혜택·태그·지점처럼 반복되는 값은 최대 노출 개수를 정하고 나머지는 `+N`으로 축약한다.

## CompactStepper
- 모바일 다단계 form은 `현재/전체 + 단계명`만 우선 표시하고 전체 단계 설명은 disclosure로 제공한다.
- 이전/다음/제출 중 현재 primary CTA는 하나만 존재한다.

## FilterBar
- 검색/정렬/상태 필터를 같은 surface 안에서 다룬다.
- 작은 화면에서는 세로, 큰 화면에서는 가로 정렬한다.
- 기본 필터가 4개를 넘으면 나머지는 `AdvancedFilterDisclosure`로 이동한다.

## DataPanel / StatsRow
- 수치, 짧은 메타, 설명을 통일된 density로 표현한다.

## FormSection
- 폼은 의미 단위별로 section을 나누고, 각 section은 제목과 짧은 설명을 가진다.

## ResponsiveGrid
- 카드 목록, 요약 패널, 문서 샘플을 auto-fit grid로 배치한다.

## MotionReveal
- 목록/섹션 등장 애니메이션은 이 컴포넌트로 통일한다.
