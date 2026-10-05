---
title: Storybook·Visual Baselines 워크플로 운영
type: runbook
status: current
authority: normative
---

# Storybook·Visual Baselines 워크플로 운영

작성일: 2026-08-13. 2026-10-05에 현재 workflow trigger와 release 동작 기준으로 갱신했다.

## 목적과 현재 상태

`Storybook and Visual Baselines`(`.github/workflows/storybook.yml`)는 **수동 실행 전용**(`workflow_dispatch`) workflow다. PR이나 branch push로는 실행되지 않고, `npm run release`도 Storybook을 실행하지 않는다. Storybook과 visual 비교는 UI 변경을 검토할 때 운영자가 선택해서 돌리는 검사다.

실행 입력은 두 가지다.

- `interaction`(기본 켜짐): 정적 Storybook 빌드와 Vitest browser mode 기반 interaction·접근성 테스트
- `visual`(기본 꺼짐): 추적 중인 Playwright 이미지 기준선과의 비교

Chromatic이나 외부 시각 검증 서비스, 별도 토큰은 사용하지 않는다. 워크플로의 GitHub 토큰 권한은 `contents: read`이고, 동시 실행은 하나로 제한하되 진행 중인 실행을 취소하지 않는다.

## 로컬 확인

UI 변경을 검토하기 전에 아래 명령을 로컬에서 먼저 통과시킨다.

1. `npm run install:trusted`
2. `npm run build-storybook`
3. `npm run test-storybook`
4. `npx playwright install chromium`
5. `npm run test:visual`
6. `node --import ./tests/alias-register.mjs --test tests/public-readiness.test.mts`

이미지 차이가 발생하면 기능 변경과 무관하게 기준선을 갱신하지 않는다. 의도된 UI 변경인지 먼저 확인하고, 해당 화면의 모바일·태블릿·데스크톱 결과를 PR에서 검토한 뒤에만 새 이미지를 반영한다.

## 수동 실행

GitHub Actions 운영 규칙(`github-actions-operations` 스킬)의 사전 점검을 거친 뒤 실행한다.

1. 저장소 `Actions` 화면에서 `Storybook and Visual Baselines`를 선택하고 대상 branch의 최신 SHA로 `Run workflow`를 실행한다. 필요하면 `visual`을 켠다.
2. 선택한 job의 빌드·interaction·a11y·visual 단계가 모두 성공했는지 확인한다. 성공한 job에 retry나 browser `console.error`가 있으면 비정상 실행으로 본다.
3. 로그에 환경변수, 회원정보, 외부 서비스 토큰이 없는지 확인한다.

## 실패 판정

다음 중 하나면 기준선 갱신이나 재실행으로 덮지 않고 원인을 먼저 고친다.

- 동일 SHA의 재실행에서도 테스트가 반복 실패함
- 기준선 이미지가 운영체제·폰트·시간 등 제품과 무관한 값 때문에 흔들림
- 평균 실행 시간이 `timeout-minutes: 25`에 근접함
- 예상하지 않은 secret 요구가 생김

자동 trigger를 다시 붙이는 것은 별도 결정이다. CI 비용과 실행 시간을 측정한 뒤 Issue에서 정하고, 그 전에는 [기술 부채 원장](../../plans/tech-debt.md#성능ux운영)의 제외 결정을 따른다.

## 관련 계약

- 저장소 워크플로: [`.github/workflows/storybook.yml`](../../../.github/workflows/storybook.yml)
- 로컬 구성과 기준선 정책: [`docs/testing/storybook.md`](../../testing/storybook.md)
- CI 계약 테스트: [`tests/public-readiness.test.mts`](../../../tests/public-readiness.test.mts)
- 관련 이슈: [#311](https://github.com/MyKnow/ssartnership/issues/311)
