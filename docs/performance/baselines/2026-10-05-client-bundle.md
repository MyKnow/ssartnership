---
title: 클라이언트 번들 기준선 (2026-10-05)
type: baseline
status: active
authority: descriptive
---

# 클라이언트 번들 기준선 (2026-10-05)

공개 첫 방문의 고정 비용(첫 로드 JS·CSS)을 레이아웃·페이지 단위로 처음 기록하고, 이후 번들 판단(지연 로드·의존성 교체)의 근거를 같은 절차로 남긴다. 관련 작업은 Issue #548, 상위 프로그램은 #530이다.

측정값을 채우기 전까지 이 문서는 `active/descriptive`다. 첫 기준선을 기록하면 `completed/evidence`로 바꾸고, 다음 측정은 새 날짜 파일로 남긴다.

## 측정 대상

- 루트 레이아웃(`app/layout`)과 `(site)` 레이아웃 청크
- `/`(홈)와 `/partners/[id]`(제휴처 상세)의 익명 첫 방문 first-load JS·CSS
- 로그인 상태 비교는 같은 서버에 세션 쿠키를 붙인 브라우저 Network 패널 합계로 별도 기록한다(스크립트는 쿠키를 보내지 않는다).

## 측정 절차

1. 측정할 커밋을 체크아웃하고 production build를 새로 만든다: `npm run build`. 이전 `.next` 산출물은 다른 커밋의 결과일 수 있으므로 재사용하지 않는다. 빌드 ID(`.next/BUILD_ID`)와 커밋 SHA를 기록한다.
2. 같은 환경 프로필로 서버를 띄운다: `npm run start -- -p 3333`.
3. 다른 터미널에서 집계한다: `npm run measure:client-bundle -- --base-url http://127.0.0.1:3333 --route / --route /partners/<공개 제휴처 ID>`.
   - 스크립트(`scripts/measure-client-bundle.mjs`)는 쿠키 없이 HTML을 받아 `<script src>`·`<link rel=stylesheet|preload>`의 `/_next/static` 자산을 모으고, 로컬 `.next/static` 파일(없으면 서버 응답)을 gzip level 9로 압축해 범주별 KB 표를 출력한다. `nomodule` 폴리필은 제외한다.
   - 범주: runtime(webpack·main-app), root layout, (site) layout, 기타 layout, page, loading·error 경계, shared(번호 청크), CSS.
   - 원시 자산 목록이 필요하면 `--json`을 붙인다.
4. 출력 표를 아래 기준선 표에 붙이고 커밋 SHA·빌드 ID·데이터 소스(mock/supabase)·측정일을 함께 적는다.
5. 모듈 단위 원인 분석이 필요하면 별도 Issue로 다룬다. 이 저장소는 webpack 빌드(`scripts/next.mjs build --webpack`)라 Turbopack 전용 `next experimental-analyze`는 쓰지 않고, `@next/bundle-analyzer` 도입은 `next.config.ts` 변경과 의존성 추가를 수반한다.

CI 게이트나 Lighthouse 상한은 두지 않는다. Lighthouse는 로컬 `npm run perf:lighthouse` 수동 측정이다.

## 기준선

| 항목 | 값 |
| --- | --- |
| 커밋 | 측정 대기 |
| 빌드 ID | 측정 대기 |
| 데이터 소스 | 측정 대기 |
| 측정일 | 측정 대기 |

| 경로 | JS 파일 수 | first-load JS gz | runtime | root layout | (site) layout | 기타 layout | page | loading·error | shared | CSS gz |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `/` | 측정 대기 | | | | | | | | | |
| `/partners/[id]` | 측정 대기 | | | | | | | | | |

## 같은 변경에서 바뀐 첫 페인트 요소

- 글꼴: 루트 레이아웃의 외부 CDN 비버전 Pretendard static CSS(`<link rel=stylesheet>`, 굵기별 약 0.77MB 전체 한글 woff2)를 `pretendard` 패키지의 variable dynamic-subset CSS 번들 import로 바꿨다. CSS에 `@font-face` 92개(원본 55,760B)가 더해지고, woff2는 `unicode-range`로 화면에 나온 글자의 subset만 `/_next/static/media`에서 받는다. 표의 CSS 열에 이 증가분이 포함된다.

## 판단 기록: 헤더 메뉴 지연 로드 회귀

- 사실: 2026-09-12 커밋 `6b7e2ff4`에서 `SiteHeader`의 `next/dynamic` 지연 로드(`TabletMenu`, `UserMenu`)가 정적 import로 바뀌었다.
- 측정 근거(정적 추정, 이 기준선 측정 전):
  - 지연 로드 시절의 2026-09-05 로컬 빌드에서 비동기 청크는 `TabletMenu` 13,308B(gzip 4,706B), `UserMenu` 6,165B(gzip 2,833B)였다.
  - 현재 소스의 `TabletMenu` 전용 코드를 esbuild minify로 묶고 React·Next·heroicons·헤더 공용 모듈을 외부화하면 gzip 5,867B, 사이트 상수·제품 이벤트 모듈까지 포함하면 gzip 8,179B다.
- 판단: 되돌리지 않는다.
  - 절감 상한이 약 6~8KB gz로, 클라이언트 핫스팟 정리 기준(패널 본문 재분리는 15KB gz 이상 절감이 보일 때만)에 못 미친다.
  - 헤더는 메뉴 트리거를 서버에서 바로 렌더한다. `next/dynamic` 기본값(SSR 포함)으로 감싸도 hydration에 그 청크가 필요해 첫 로드에서 빠지지 않는다. 실제 절감은 열릴 때만 렌더되는 패널 본문을 분리할 때만 생긴다.
  - 트리거를 지연 로드하면 첫 화면에서 메뉴 버튼 자리가 늦게 채워질 위험이 있다.
- 재검토 조건: 위 절차의 기준선에서 패널 본문 분리 시 15KB gz 이상 줄어드는 것이 확인될 때.
