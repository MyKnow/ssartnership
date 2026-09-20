---
title: Components
type: design-system
status: current
authority: normative
---

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

## CarouselSlideIndicators
- 이미지 위에 겹치는 캐러셀 위치 표시는 `CarouselSlideIndicators`를 공유한다. 현재 항목은 긴 흰색 pill, 나머지는 낮은 대비의 원형 점으로 표시하고 `aria-pressed`를 함께 제공한다.
- 프로모션은 자동 재생 제어와 현재 번호를 바깥 control surface에 더할 수 있다. 제휴처 모바일 갤러리는 같은 위치 표시만 사용하고, 태블릿 이상의 미리보기·화살표·썸네일 탐색은 해당 갤러리 컴포넌트가 계속 담당한다.

## MobileNav
- 전체 메뉴와 앱 설정 패널은 화면 크기와 관계없이 같은 기능 그룹을 사용한다. 패널이 열린 동안 배경의 스크롤·포커스를 막고 Escape·닫기·외부 영역으로 닫을 수 있게 하며 실행 버튼으로 포커스를 복귀시킨다. 링크 이동 시 닫고 로그인/회원가입의 `returnTo`를 보존한다. 설치 버튼은 패널을 열기 전에도 설치 가능 이벤트를 수신한다.
- 전체 메뉴는 `탐색`(홈·혜택 검색), `계정`(쿠폰함·내 정보·계정 설정·인증 액션), `앱·서비스`(화면 모드·제휴 제안·설치) 순으로 묶는다. `surface-inset` 본문 위에 동일한 제목과 `Surface` 그룹을 사용하고, 내부 행은 44px 높이와 같은 아이콘 정렬을 유지한다. 현재 목적지는 `aria-current`와 `primary-soft` 표면으로 표시한다. 로그아웃은 계정 그룹 내 구분선 아래의 평평한 행으로, 화면 모드는 짧은 라벨을 항상 보여 주는 낮은 강조의 선택 컨트롤로 제공한다. 작은 높이에서는 본문만 스크롤하고 닫기 버튼은 고정한다.
- `768px` 미만이라도 화면 하단의 공용 탐색은 홈 화면에서 실행한 standalone PWA에서만 제공한다. Safari·Chrome 같은 일반 모바일 브라우저에서는 브라우저 자체 toolbar와 겹쳐 콘텐츠를 줄이지 않도록 숨기고, 헤더 전체 메뉴에서 홈·검색·쿠폰함·내 정보를 제공한다. 로그인 웹 헤더에는 `내 인증·알림·메뉴`, 비로그인 웹에는 집중 흐름을 제외한 `검색·메뉴`를 남긴다. `내 인증`은 브랜드 톤으로 강조한다. 알림·검색은 `surface-control` 배경과 테두리·얕은 그림자로 조작 영역을 드러내고, 메뉴·설정은 `surface-muted` 배경으로 한 단계 낮게 구분한다. 모든 헤더 버튼은 44px 이상의 터치 영역을 확보한다. 쿠폰함과 계정 설정은 계정 그룹, 테마·제휴 제안·앱 설치는 앱·서비스 그룹에서 제공한다.
- 하단 탐색이 실제로 보이는 standalone PWA의 상단 헤더에는 브랜드·회원 알림·설정을 남긴다. 설정은 계정 설정·테마·로그인/로그아웃을 모은 패널을 연다. 하단 탐색이 없는 상세·집중 화면이나 태블릿 이상에서는 일반 웹 메뉴를 사용한다. 하단 탐색이 보이는 동안 Footer의 테마 전환과 알림센터를 숨겨 같은 동작을 중복하지 않는다.
- 홈·쿠폰함·내 정보는 좌측의 하나로 묶인 glass surface 안에 두고, 검색은 혜택 탐색의 시작점이므로 우측의 독립된 원형 glass surface로 분리한다.
- glass는 콘텐츠를 가리는 불투명 카드가 아니라 semantic surface token, blur, 얇은 highlight와 restrained shadow로 만든다. 라이트·다크 모드에서 텍스트 대비를 별도로 확인한다.
- footer까지 스크롤한 경우 하단 탐색 안전 여백은 body 바깥 띠가 아니라 footer surface 내부에서 확보해 라이트·다크 모드 배경이 끊기지 않게 한다.
- 현재 위치는 `aria-current`, 채워진 아이콘, active surface를 함께 사용하고 색상만으로 구분하지 않는다. 모든 조작 영역은 최소 44px을 유지한다.
- 인증이 필요한 쿠폰함·내 정보는 비로그인 상태에서도 같은 위치를 유지한다. 선택하면 목적별 인증 안내에서 로그인·회원가입을 제공하고, 인증 후 원래 목적지로 복귀한다. 인증·복구·검증처럼 집중이 필요한 흐름에서는 하단 탐색을 숨긴다.
- 하단 탐색은 페이지별 `loading.tsx`보다 바깥의 공용 site layout에 두어 본문이 스켈레톤으로 전환되는 동안에도 위치와 조작 가능 상태를 유지한다.

## PwaVisitRecommendation
- Android·iOS·iPadOS 일반 브라우저의 새 문서 방문마다 한 번, 화면 하단의 compact overlay로 앱 설치를 권장한다. visual viewport와 safe area를 반영해 브라우저 하단 도구 막대 위에 배치하고, 작은 높이에서는 안내 내부를 스크롤할 수 있게 한다. 입력에 포커스가 있거나 standalone 하단 탐색이 보이면 숨긴다. `나중에`로 닫은 상태는 현재 문서 방문에서만 유지하며 브라우저 저장소에 영구 기록하지 않는다.
- 설치를 강제하거나 서비스 이용을 막지 않는다. primary는 기기에 맞는 `설치 방법 보기`, secondary는 `나중에`이며 우측 닫기 버튼도 제공한다.
- 인증·복구·설치 안내와 파트너 상세처럼 집중 액션이 있는 경로에서는 노출하지 않는다. 안내를 닫을 수 있어야 하며 브라우저 toolbar와 공용 하단 탐색을 가리지 않는다.

## CertificationSettingsList
- 회원 설정의 계정 정보는 연결 정보·보안·계정 그룹으로 나눈 설정형 리스트를 사용한다.
- 각 행은 아이콘, 제목·보조 설명, 상태 badge, 우측 이동 또는 실행 피드백 순으로 구성하고 행 전체를 최소 44px의 조작 영역으로 제공한다.
- 즉시 실행 행은 동작 라벨과 pending 상태를, 별도 화면 이동 행은 chevron을 사용한다. 회원 탈퇴는 일반 설정과 분리한 danger 그룹으로 표시한다.
