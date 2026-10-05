# SSARTNERSHIP

SSARTNERSHIP는 SSAFY 구성원을 위한 제휴 혜택 플랫폼입니다.  
서울 지역 제휴 업체 정보를 빠르게 확인하고, Mattermost 직접 연동으로 교육생/운영진 신원을 확인할 수 있습니다.

핵심 목표는 다음 두 가지입니다.

- 제휴 정보를 공개 페이지에서 빠르게 탐색할 수 있게 하기
- SSAFY 구성원만 접근해야 하는 기능은 Mattermost DM 인증과 관리자 도구로 안전하게 운영하기

## 핵심 기능

- 공개: 카테고리·캠퍼스별 제휴처 탐색과 검색, 제휴처 상세(혜택·이용 조건·지도·예약/문의), 공개/대외비/비공개 노출 정책, 이벤트, PWA 설치, RSS·sitemap·SEO
- 회원: Mattermost DM 코드 기반 가입·비밀번호 재설정, 이메일 로그인, 약관 동의 버전 관리, 교육생·수료생·운영진 인증 카드와 QR 검증, 쿠폰함, 리뷰·즐겨찾기, Web Push 알림
- 협력사: 파트너 포털(회사·브랜드 정보 변경 요청, 플랜·결제, 지표, 리뷰 응대, 알림)
- 관리자: 제휴처·카테고리·회사·회원·수료생 인증·리뷰·광고·쿠폰·이벤트·푸시·로그 관리와 기수 설정

화면과 흐름의 계약은 [제품 지식](./docs/product/index.md)에 있습니다.

## 문서

프로젝트 지식은 [Repository Knowledge Map](./docs/index.md)에서 시작합니다. 이 README는 진입 안내만 담고, 같은 내용을 복제하지 않습니다.

- 시스템 구조: [시스템 개요](./docs/architecture/system-overview.md), [데이터 모델](./docs/architecture/data-model.md), [API와 외부 연동](./docs/architecture/api-and-integrations.md)
- 운영 절차: [운영 문서](./docs/operations/index.md)
- 테스트: [위험에 따른 테스트 전략](./docs/testing/strategy.md)
- 디자인: [디자인 시스템](./docs/design-system/index.md)
- 진행 중인 작업과 부채: [실행 계획](./docs/plans/index.md), [기술 부채 원장](./docs/plans/tech-debt.md)
- 작업 규칙: [AGENTS.md](./AGENTS.md)

문서 상태·메타데이터·이동 규칙은 [문서 수명주기](./docs/operations/documentation-lifecycle.md)를 따릅니다.

## 기술 스택과 운영 환경

- Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4
- 데이터: 자체 호스팅 Supabase(PostgreSQL, PostgREST, Storage). 스키마의 정본은 `supabase/migrations`이고 `supabase/schema.sql`은 파생 스냅샷입니다.
- 연동: Mattermost API(서버 전용 Sender), SMTP(Nodemailer), Web Push(VAPID), 국세청 사업자 상태조회
- 운영: PVE 자체 호스팅 VM 위의 Docker Compose와 Caddy edge. Vercel과 클라우드 Supabase는 사용하지 않습니다.

```text
src/app/              App Router routes, layouts, route handlers, server actions
src/components/       UI primitives(ui/)와 기능 컴포넌트
src/lib/              도메인 로직, 저장소, 외부 연동 adapter
supabase/migrations/  forward-only 마이그레이션
tests/                node:test(*.test.mts)와 Vitest(tests/unit)
deploy/               자체 호스팅 Compose·edge·수신기·운영 자산
docs/                 Repository Knowledge
```

## 로컬 개발

새 PC에서는 Windows와 macOS 모두 같은 명령을 사용합니다.

```text
npm run bootstrap
npm run doctor
npm run dev
```

이미 구성된 PC에서는 다음 흐름만 사용합니다.

```text
git pull --rebase
npm run doctor
npm run dev
```

- 공식 개발 환경: Windows x64, macOS arm64
- 고정 runtime: Node.js 24.18.1, npm 11.16.0
- `bootstrap`: 검증된 `install:trusted` 경계의 lockfile 설치, 외부 연결 없는 mock `.env.preview` 생성, 환경 진단
- `doctor`: 환경을 바꾸지 않고 OS·runtime·환경 파일·포트·파일시스템·native dependency 상태를 `PASS`/`WARN`/`FAIL`로 진단
- 개발 서버: `http://localhost:3000`

환경 파일은 `.env.preview`와 `.env.production` 두 개만 씁니다. `npm run dev`는 항상 `.env.preview`를, 로컬 `build`/`start`는 `main`에서만 `.env.production`을 읽습니다. `.env`, `.env.local`, `.env.development` 같은 파일은 `doctor`와 `bootstrap`이 거부합니다. 상세 계약과 이름을 유지하는 이유는 [교차 플랫폼 개발환경](./docs/operations/runbooks/cross-platform-development.md#6-환경변수와-로컬-profile)에 있습니다.

## 검증

```bash
npm run check:lockfile   # Node 24.18.1·npm 11.16.0 기준 lockfile 재계산
npm run verify:change    # 실제 diff 위험 등급에 맞춘 로컬 게이트(CI와 같은 분류기), push 전 필수
npm run verify:release   # dev → main 승격 전 Production build와 전체 E2E
npm run check:docs       # 문서 메타데이터·링크 검증
```

집중 검사는 `npx tsc --noEmit --pretty false`, `npx eslint <파일>`, `node --import ./tests/alias-register.mjs --test tests/<파일>.test.mts`를 씁니다. Storybook과 visual 비교는 UI 변경 때 실행하는 수동 검사이며 절차는 [Storybook 문서](./docs/testing/storybook.md)에 있습니다.

## 릴리스와 배포

`npm run release`가 기본 커밋·push 경로입니다. 구현은 [scripts/release.mjs](./scripts/release.mjs)입니다.

- `main` 외 브랜치: 선택적으로 Lighthouse를 실행하고, `prepush`(= `verify:change`)를 통과한 뒤 선택한 버전 업데이트를 적용해 **이미 stage한 변경**을 한국어 conventional 메시지로 커밋하고 push합니다. 태그는 만들지 않습니다.
- `main`: 작업 트리가 깨끗해야 하며, `prepush` 뒤 현재 `package.json` 버전의 annotated tag를 만들고 branch와 tag를 push합니다.

```text
npm run release
npm run release -- --version=none --lighthouse=skip --message="docs: 예시 메시지" --yes
```

여러 줄 메시지는 UTF-8 파일을 만든 뒤 `--message-file=경로`로 전달합니다.

배포는 branch가 결정합니다.

- `dev` push → `Self-host Preview Images` workflow가 exact-SHA 이미지를 게시 → Preview 서버 수신기가 앱만 교체
- `main` push → `Self-host Production Images` workflow → Production 서버 수신기가 앱만 교체
- 수신기는 DB DDL을 적용하지 않습니다. 마이그레이션은 운영자가 백업을 확인하고 적용한 뒤 환경별 스키마 승인을 갱신해야 배포됩니다.

절차와 복구는 [격리 CI·배포·유지보수](./docs/operations/runbooks/self-host-ci-maintenance.md), [자체 호스팅 앱 실행](./docs/operations/runbooks/self-hosting.md), [Production/Preview 격리와 데이터 사본](./docs/operations/runbooks/self-host-environments.md)을 따릅니다. Production 데이터를 Preview로 옮기는 작업은 운영자 절차이며, `npm run sync:preview`(클라우드 시대 도구)는 사용하지 않습니다.

## 환경 변수

- 로컬 profile 예시: [.env.example](./.env.example)
- 운영 runtime 예시: [deploy/self-host/runtime.env.example](./deploy/self-host/runtime.env.example)
- 필수 값·형식·오류 코드의 정본: [deploy/self-host/runtime-env.mjs](./deploy/self-host/runtime-env.mjs)
- 그룹별 설명: [API와 외부 연동](./docs/architecture/api-and-integrations.md#environment-variable-groups)

서비스 롤 키, 세션·HMAC 비밀, SMTP 계정, VAPID private key, Mattermost Sender 키, 입금 계좌와 사업자 상태조회 키는 서버 전용입니다. `NEXT_PUBLIC_` 접두사를 붙이지 않습니다. 운영 값은 해당 환경의 runtime env 파일을 바꾸고 앱을 다시 시작해 반영하며, `NEXT_PUBLIC_*` 공개 빌드 값이 바뀌면 이미지를 다시 빌드합니다. 협력사 결제용 값의 등록 절차는 [협력사 결제 운영 설정](./docs/product/guides/partner-billing-setup.md)에 있습니다.

## 라이선스

CC BY-NC 4.0  
비상업적 목적에 한해 사용 가능합니다.

환경 변수 목록과 분류의 정본은 [env 매니페스트](scripts/lib/env-manifest.mjs)이며 `npm run check:env`로 두 예시 파일과 코드의 drift를 확인합니다.

## License

이 프로젝트는 [CC BY-NC 4.0](./LICENSE)을 따릅니다. Pretendard 폰트의 별도 OFL 고지는 [폰트 라이선스](./public/fonts/OFL.txt)를 참고하세요.
