# Components

## Card / Surface
- `Card tone="default"`는 독립 섹션/패널, `muted`는 내부 inset, `elevated`는 주요 카드/CTA, `hero`는 강한 강조 표면으로 사용한다.
- 카드 내부의 보조 행, 입력 그룹, 세부 정보 박스는 `Surface level="inset"`을 우선 사용한다.
- modal, drawer, toast처럼 화면 위에 뜨는 레이어는 `Surface level="overlay"` 또는 `bg-surface-overlay`를 사용한다.
- Toast는 일시적 피드백이라는 제한된 범위에서 `ui-toast-glass` overlay를 사용하며, 일반 카드나 본문 패널로 glass 표현을 확장하지 않는다.

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

## MobileNav
- `768px` 미만의 공개·회원 화면은 상단 헤더에 브랜드·테마 전환과 알림을 남기고, 핵심 이동은 화면 하단의 공용 탐색으로 제공한다. 하단 탐색이 보이는 동안 Footer의 테마 전환과 알림센터는 숨겨 같은 동작을 중복하지 않는다.
- 홈·쿠폰함·내 정보는 좌측의 하나로 묶인 glass surface 안에 두고, 검색은 혜택 탐색의 시작점이므로 우측의 독립된 원형 glass surface로 분리한다.
- glass는 콘텐츠를 가리는 불투명 카드가 아니라 semantic surface token, blur, 얇은 highlight와 restrained shadow로 만든다. 라이트·다크 모드에서 텍스트 대비를 별도로 확인한다.
- footer까지 스크롤한 경우 하단 탐색 안전 여백은 body 바깥 띠가 아니라 footer surface 내부에서 확보해 라이트·다크 모드 배경이 끊기지 않게 한다.
- 현재 위치는 `aria-current`, 채워진 아이콘, active surface를 함께 사용하고 색상만으로 구분하지 않는다. 모든 조작 영역은 최소 44px을 유지한다.
- 인증이 필요한 쿠폰함·내 정보는 비로그인 상태에서도 같은 위치를 유지한다. 선택하면 목적별 인증 안내에서 로그인·회원가입을 제공하고, 인증 후 원래 목적지로 복귀한다. 인증·복구·검증처럼 집중이 필요한 흐름에서는 하단 탐색을 숨긴다.
- 하단 탐색은 페이지별 `loading.tsx`보다 바깥의 공용 site layout에 두어 본문이 스켈레톤으로 전환되는 동안에도 위치와 조작 가능 상태를 유지한다.

## CertificationSettingsList
- 회원 설정의 계정 정보는 연결 정보·보안·계정 그룹으로 나눈 설정형 리스트를 사용한다.
- 각 행은 아이콘, 제목·보조 설명, 상태 badge, 우측 이동 또는 실행 피드백 순으로 구성하고 행 전체를 최소 44px의 조작 영역으로 제공한다.
- 즉시 실행 행은 동작 라벨과 pending 상태를, 별도 화면 이동 행은 chevron을 사용한다. 회원 탈퇴는 일반 설정과 분리한 danger 그룹으로 표시한다.
