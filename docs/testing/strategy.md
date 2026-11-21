---
title: 위험에 따른 테스트 전략
type: test-guide
status: current
authority: normative
---

# 위험에 따른 테스트 전략

## 검사 선택

| 변경 위험 | 필요한 검사 | 증명하지 않는 범위 |
| --- | --- | --- |
| 권한·인증·토큰·민감 정보 | 도메인/route 테스트, 중요 인증·접근 E2E, 보안 검사 | Mock 통과만으로 실제 DB 권한을 증명하지 않음 |
| 데이터·쿠폰·결제·업로드 | 검증·원자성·중복·실패 복구 테스트, 관련 SQL 계약 | SQL 문자열 검사만으로 운영 migration 적용을 증명하지 않음 |
| 탐색·제출·복귀 | 행동 E2E 및 상태 helper 테스트 | 문구 존재만으로 과업 완료를 증명하지 않음 |
| 시각·배치·반응형 | 해당 UI 변경 시 수동 렌더 확인, 필요 시 Storybook/Visual | CSS 클래스 존재는 화면 품질 증거가 아님 |
| 키보드·스크린리더 기본기 | `tests/e2e/a11y-smoke.spec.ts`(axe, 360px 라이트·다크, critical·serious 실패), 포커스·스크롤 잠금 helper 테스트 | 자동 규칙 통과만으로 스크린리더 과업 완료나 대비 품질 전체를 증명하지 않음 |
| 운영·배포·백업 | manifest/권한/rollback/inventory 검증과 실제 환경 절차 | health 응답만으로 인증·복구·전달 성공을 증명하지 않음 |
| 문서 | check:docs 및 내용·출처 리뷰 | 링크 존재만으로 의미나 승인 상태를 증명하지 않음 |

## 기본 게이트

명령 정본은 [package.json](../../package.json), 위험 분류 정본은 [change-policy](../../scripts/lib/change-policy.mjs)다. `verify:change`를 평소 실행하고 `verify:release`는 승격과 검사 정책·E2E 변경에 실행한다. Storybook·Visual은 수동 워크플로다. 재시도·skip으로 필수 검사를 통과 처리하지 않는다.

## 러너 선택

| 러너 | 위치·명령 | 쓰는 경우 |
| --- | --- | --- |
| `node:test` | `tests/*.test.mts`, `tests/push/*.test.mts` · `npm run test:node` | 순수 helper·selector·parser·지표 계산, repository mock, 마이그레이션·설정 파일 같은 소스 계약 |
| Vitest unit | `tests/unit/*.test.ts` · `npm run test:unit` | `vi.mock`으로 `next/headers`·`next/cache`·Supabase client·세션 모듈을 바꿔야 하는 route handler·server action |
| Vitest Storybook | `npm run test-storybook` | 컴포넌트 상호작용·a11y(수동 실행) |
| Playwright | `npm run test:e2e` | 여러 화면에 걸친 사용자 과업, 인증·권한 흐름 |

새 테스트는 대상 모듈을 import해 동작을 확인하는 방식을 우선한다. 파일을 텍스트로 읽어 정규식으로 검사하는 소스 계약은 서버 없이 동작을 실행할 수 없는 경우(마이그레이션 SQL, workflow, 배포 설정 등)에만 좁게 쓴다.

## 리팩토링과 소스 계약 테스트

2026-10-05 기준 Node 테스트 파일 475개 중 285개가 `readFileSync`/`readFile`로 저장소 파일을 읽는다. 이 테스트는 경로나 문자열이 바뀌면 동작과 무관하게 실패하거나, 더 나쁘게는 다른 파일을 읽으며 조용히 의미를 잃는다.

- 파일을 옮기거나 이름·문자열을 바꾸기 전에 `grep -rl "<경로|식별자|문자열>" tests`로 참조 테스트를 찾고, 같은 커밋에서 새 경로·문자열로 갱신한다.
- 큰 모듈을 분해하는 PR은 첫 커밋에서 분해 대상 순수 함수의 현재 동작을 import 기반 특성화 테스트로 고정한다.
- 공용 읽기 헬퍼 `tests/support/read-source.mts`가 생기면 새 소스 계약 테스트는 그 헬퍼를 사용한다.

## 접근성 스모크

`a11y-smoke.spec.ts`는 홈·로그인·인증 카드·iOS 설치 안내를 360px 라이트·다크로 axe(WCAG 2.0~2.2 A/AA) 검사한다. 판정 규칙은 `tests/e2e/a11y-policy.ts`가 정본이며 critical·serious 위반만 실패로 본다. 기존 위반은 경로·규칙·색 모드 단위 allowlist에만 사유와 담당을 남겨 허용하고, 규칙 전역 비활성화나 요소 제외로 통과시키지 않는다. 해소된 항목은 실행 annotation(`a11y-allowlist-stale`)으로 드러나며 바로 삭제한다.

## 유지·삭제 판단

보호하는 과업·실패 영향·대체 검증·실행 빈도·비용을 함께 판단한다. 접근 차단, 소유 범위, 개인정보, 금전·쿠폰 원자성, 발송 중복, 운영 복구는 유지한다. CSS 클래스·컴포넌트 배치 문자열, 이미 다른 행동 검사에서 확인하는 렌더 스모크, 일회성 QA 스크린샷 반복은 삭제·통합 후보이다. 파일 이름에 UI가 있다는 이유로 권한·중복 제출 검사를 함께 삭제하지 않는다.

비핵심 시각 검사를 삭제하면 해당 자동 감지는 사라진다. 제품 계약 자체와 UI 변경 시 360/820/1366 등 필요한 viewport의 수동 검증 의무는 유지한다. 실행 시간을 줄이기 위해 assertion을 약화하거나 오류를 무시하지 않는다.

## 실행 증거

계약 문서에는 요구·검증 방법을, 기능 tasks 또는 감사 문서에는 SHA·환경·명령·결과·한계를 기록한다. 실패와 이후 수정 성공을 별도 기록한다. [이번 전체 파일 분류와 삭제 근거](./audits/2026-09-20-test-rationalization.md)를 참고한다.
