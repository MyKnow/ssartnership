---
title: 2026-10 리팩터링 개발 도구 평가
type: audit
status: completed
authority: evidence
---

# 2026-10 리팩터링 개발 도구 평가

이 기록은 로컬 통합 후보에서 얻은 평가이며 원격 CI·Preview·Production 완료를 주장하지 않는다. 관련 이슈: [RF-22 #553](https://github.com/MyKnow/ssartnership/issues/553), [통합 #530](https://github.com/MyKnow/ssartnership/issues/530).

## 실행 위치와 비용

- 스킬 Markdown은 standard 등급, 코드/워크플로/시크릿 경계는 기존 위험 분류다. `verify:change`에는 typegen을 추가하지 않는다.
- release 후속 검증은 `typegen:release`, 배포용 build, `test:e2e:prod` 순서다. production E2E는 기존 synthetic fixture 환경을 재사용하고 `.next-e2e`에 deployable=false 마커를 붙인다. smoke 경로는 기존처럼 유지하고 Public Readiness full 경로에서만 production E2E를 실행한다.
- Storybook workflow에는 이미 수동 interaction/a11y job이 있고 addon-a11y·Vitest·RSC 설정이 있다. 모든 PR에서 전체 Storybook을 추가 실행하면 Public Readiness와 브라우저·install 비용이 중복된다. 현행 수동 경로를 유지하고 변경된 hotspot 스토리/접근성 검사를 집중 실행한다.
- Self-host Images의 `App.Dockerfile`은 검증한 standalone 산출물을 복사한다. 의존성 설치나 별도 build를 반복하지 않는다. 고정 base·사용자 생성 층은 BuildKit cache를 보존하면 재사용할 수 있다. 이 평가에서 원격 러너 cache hit·비용 실측은 하지 않았다. 원격 cache 없이 고정층이 항상 재사용된다고 보고하지 않는다.
- lib만 대상으로 한 `noUncheckedIndexedAccess` 임시 설정은 75개 오류/29개 파일을 보고했다(이동 과정의 1개 타입 누락 포함). 인덱스·tuple·배열 읽기와 경계 파일이 연쇄적으로 좁혀지므로 이번 통합에서 전역 적용하지 않는다. 실제 채택은 개별 도메인별 실패 동작을 정한 별도 작업으로 한다.

## 데이터 타입 파일럿

`gen:database-types`는 운영자가 준비한 local Supabase DB에서 public schema 타입을 생성하는 수동 명령이다. Production 연결·migration 적용을 수행하지 않고 생성 실패 시 기존 파일을 보존한다. CLI 버전과 적용 migration 목록을 실행 영수증에 기록한다.

`database.generated.ts`의 초기 categories 부분은 `supabase/schema.sql`에서 만든 명시적인 bootstrap slice다. 실제 DB에서 생성한 파일로 가장하지 않는다. categories accessor 1곳에서만 이 타입을 적용해 읽기 결과 cast를 제거했다. 로컬 DB를 마련한 뒤 전체 생성 출력과 해당 snapshot의 차이를 검토하고 타입 파일을 교체해야 한다. 전면 repository 타입 적용은 범위 밖이다.

## 감사·라이선스·저장소

[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)은 braces 3.0.3 이하의 재귀 stack 고갈을 보고하며 2026-10-05 확인 시 공식 수정 버전이 없었다. Next.js downgrade나 감사 예외 대신 upstream 3.0.3의 MIT source를 보존한 `vendor/braces-depth-guard`에서 parse/compile/expand/stringify 중첩을 64로 제한한다. tarball과 각 source의 digest, lockfile identity/SRI를 trusted-install 정책이 검사한다. 입력 문자열과 직접 만든 AST의 중첩 차단 및 정상 glob 확장을 테스트한다. 공식 수정본이 나오면 호환성과 감사 결과를 검증해 이 보완 사본을 제거한다. 만료된 image-size 예외는 삭제했다.

`npm pack --dry-run --ignore-scripts` 결과는 2987개 파일, 압축 30848030 bytes, 원본 43592003 bytes였다. 상위 파일은 mock 제휴처 이미지와 설치 안내/광고 이미지다. 서비스는 npm library 배포 계약이 없으므로 pack 크기만 줄이려고 런타임 자산을 삭제하지 않는다. 전체 reformat과 생성물 staging을 피하고 JSON/lockfile·xlsx 변경을 분리해 리뷰한다.

LICENSE·package.json·README는 기존 CC BY-NC 4.0을 유지한다. Pretendard의 별도 SIL OFL 1.1 고지는 패키지 원문을 `public/fonts/OFL.txt`에 보존한다. `.claude/`·로그는 ignore, xlsx는 binary로 표시한다. 취약점 신고는 기존 [SECURITY 정책](../../SECURITY.md)을 정본으로 유지한다.
