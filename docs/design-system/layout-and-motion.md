# Layout And Motion

## Grid
- 기본 콘텐츠는 centered shell 안에 배치한다.
- `Container size=page`가 기본이다.
- wide 화면도 콘텐츠는 `grid-max`를 넘기지 않는다.
- full bleed는 배경 decorate에만 허용한다.

## Responsive Rules
- 모바일 우선 1열
- 충분한 폭이 확보될 때만 2열/3열로 확장
- 컨트롤 바와 필터는 작은 화면에서 세로 스택, 큰 화면에서 행 정렬
- 작은 화면에서 과도한 chip 군집과 좌우 padding으로 줄바꿈을 유발하지 않는다

## Decorate
- hero는 navy gradient + subtle accent glow
- 일반 페이지는 연한 radial highlight와 grid pattern 정도만 사용
- decorative layer는 정보 위계를 방해하지 않아야 한다

## Motion
- `framer-motion`을 공용 모션 레이어로 사용한다
- 기본 reveal: opacity + y 16px 내외
- tab 전환: layout animation
- modal/toast: short ease-out
- reduced motion 사용 시 위치 변화와 duration을 축소하거나 제거한다
