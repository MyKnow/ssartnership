# Storybook·Visual Baselines 워크플로 운영

작성일: 2026-08-13

## 목적

`Storybook and Visual Baselines`는 PR과 `dev`/`main` push에서 다음 세 가지를 검증한다.

- 정적 Storybook 빌드
- Vitest browser mode 기반 interaction·접근성 테스트
- 추적 중인 Playwright 이미지 기준선과의 비교

Chromatic이나 외부 시각 검증 서비스, 별도 토큰은 사용하지 않는다. 워크플로의 GitHub 토큰 권한은 `contents: read`로 제한한다.

2026-08-13 확인한 공식 최신 릴리즈는 [`actions/checkout` v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1)과 [`actions/setup-node` v7.0.0](https://github.com/actions/setup-node/releases/tag/v7.0.0)이다. 저장소는 패치 업데이트를 받을 수 있도록 두 action의 `v7` major ref를 사용하며, 둘 다 Node 24 action runtime으로 실행된다.

## 현재 상태와 재활성화 전제

2026-08-13 기준 GitHub의 워크플로 상태는 `disabled_manually`다. 저장소 파일에는 자동 trigger가 남아 있지만, GitHub에서 활성화하기 전에는 PR이나 branch push로 실행되지 않는다.

운영 책임자는 저장소 관리자다. 재활성화 판단의 증거는 이 문서의 로컬 명령 결과와 최초 수동 실행 URL을 #311에 남긴다.

재활성화 전에 아래 증거를 모두 확보한다.

1. `npm ci`
2. `npm run build-storybook`
3. `npm run test-storybook`
4. `npx playwright install chromium`
5. `npm run test:visual`
6. `node --import ./tests/alias-register.mjs --test tests/public-readiness.test.mts`

이미지 차이가 발생하면 기능 변경과 무관하게 기준선을 갱신하지 않는다. 의도된 UI 변경인지 먼저 확인하고, 해당 화면의 모바일·태블릿·데스크톱 결과를 PR에서 검토한 뒤에만 새 이미지를 반영한다.

## 재활성화 절차

담당자는 저장소 `Actions` 화면에서 `Storybook and Visual Baselines`를 선택하고 `Enable workflow`를 실행한다. 저장소 변경만으로 수동 비활성 상태는 해제되지 않는다.

활성화 직후에는 다음 순서로 확인한다.

1. `workflow_dispatch`로 `dev`의 최신 SHA를 1회 실행한다.
2. `Build Storybook`, `Storybook interaction and a11y tests`, `Compare core visual baselines`가 모두 성공했는지 확인한다.
3. 로그에 환경변수, 회원정보, 외부 서비스 토큰이 없는지 확인한다.
4. 작은 문서 전용 PR에서 자동 `pull_request` 실행이 생기는지 확인한다.
5. `dev` push에서도 한 번만 실행되고 concurrency 취소 정책이 적용되는지 확인한다.

## 실패 판정과 롤백

다음 중 하나면 자동 게이트 적용을 중단하고 원인을 먼저 고친다.

- 동일 SHA의 재실행에서도 테스트가 반복 실패함
- 기준선 이미지가 운영체제·폰트·시간 등 제품과 무관한 값 때문에 흔들림
- 평균 실행 시간이 `timeout-minutes: 25`에 근접함
- 외부 `UI Tests` pending 또는 예상하지 않은 secret 요구가 다시 생김

롤백은 GitHub `Actions` 화면에서 워크플로를 다시 비활성화하는 것으로 한다. YAML trigger를 제거하거나 테스트를 우회하지 않는다. 비활성화 중에도 `npm run release`의 Storybook 빌드·테스트·visual gate는 유지한다.

## 관련 계약

- 저장소 워크플로: [`.github/workflows/storybook.yml`](../../.github/workflows/storybook.yml)
- 로컬 구성과 기준선 정책: [`docs/testing/storybook.md`](../testing/storybook.md)
- CI 계약 테스트: [`tests/public-readiness.test.mts`](../../tests/public-readiness.test.mts)
- 관련 이슈: [#311](https://github.com/MyKnow/ssartnership/issues/311)
