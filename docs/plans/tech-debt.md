---
title: 기술 부채 원장
type: tech-debt
status: active
authority: descriptive
last_verified: 2026-10-06
---

# 기술 부채 원장

이 문서는 **아직 실행 승인을 받지 않은** 후속 후보와, 의도적으로 보류·제외한 작업의 재개 조건만 기록한다. 승인된 작업은 GitHub Issue와 [active plan](./index.md#active)에서 추적한다. 항목을 실행하기로 하면 Issue를 만들고 아래 표의 Issue 칸을 채운 뒤, 완료되면 이 원장에서 지운다.

기준 시점은 2026-10-05 `dev`(`b2a212f4`)이다. 2026-10 리팩토링 프로그램의 기본 결정은 [실행 계획](./active/refactor-program-2026-10.md#기본-결정)에 있고, 여기서는 그 결정 때문에 하지 않기로 한 일과 다시 꺼낼 조건을 남긴다.

## 증가 금지 기준

수치가 늘어나는 변경은 리뷰에서 거절하고, 줄어들면 같은 PR에서 기준값을 낮춘다.

| 기준 | 기준값 | 규칙 | Issue |
| --- | --- | --- | --- |
| `src/lib/repositories` 밖에서 테이블에 직접 `.from("<table>")`을 호출하는 파일 | 124개(`src/app/api` 21, `src/app/admin` 19) | 새 파일 추가 금지. 0건 목표는 두지 않는다([결정 D5](./active/refactor-program-2026-10.md#기본-결정)). | #530 |

측정 명령:

```bash
grep -rlE "\.from\([\"'][a-z_]+[\"']\)" src | grep -v "^src/lib/repositories/" | wc -l
grep -rlE "\.from\([\"'][a-z_]+[\"']\)" src | grep -v "^src/lib/repositories/" | grep -c "^src/app/api/"
grep -rlE "\.from\([\"'][a-z_]+[\"']\)" src | grep -v "^src/lib/repositories/" | grep -c "^src/app/admin/"
```

## 핫스팟 후보

크기만으로 분해하지 않는다. 기능 변경이 예정될 때 첫 커밋에 특성화 테스트를 두고 분해한다.

| 대상 | 현재 근거 | 재개 조건 | Issue |
| --- | --- | --- | --- |
| `src/components/admin/push-manager/PushComposerSection.tsx` | 970줄 단일 컴포넌트에 대상 선택·미리보기·발송 상태가 모여 있다. | 관리자 푸시 작성 기능 변경이 예정될 때 | — |
| `src/components/admin/promotion-carousel-editor/PromotionCarouselEditor.tsx` | 1,204줄이며 default 컴포넌트 하나가 대부분을 차지한다. | 프로모션 편집기 기능 변경이 예정될 때 | — |
| `src/lib/project-showcase/repository.supabase.ts`·`repository.mock.ts` | 1,079줄·989줄, 공개·소유자·관리자 지표·추첨·정산·파기가 한 인터페이스에 있다. | 다음 쇼케이스 운영을 위한 기능 변경 때(한시 기능이라 그 전에는 분해하지 않는다) | — |

## webpack 고정

Next 16의 기본 bundler는 Turbopack이지만 `scripts/next.mjs`(build)와 `scripts/dev.mjs`(dev), Playwright 개발 서버, 자체 호스팅 E2E 빌드는 `--webpack`을 명시한다. `next.config.ts`의 아래 계약이 webpack hook에 묶여 있기 때문이다.

| webpack 의존 | 위치 | 역할 |
| --- | --- | --- |
| fixture module boundary | `scripts/webpack-fixture-boundary.mjs` | 명시적 CI·mock·별도 출력 조건에서만 E2E fixture 정책 모듈을 바꾸고, 일반 compiler에 테스트 전용 모듈이 들어오면 실패시킨다. |
| 개발 manifest 원자적 쓰기 | `scripts/webpack-atomic-manifests.mjs` | 자체 호스팅 E2E 개발 서버에서 manifest를 빈 파일로 읽는 문제를 막는다. |
| heic wasm 규칙 | `next.config.ts`의 `asset/resource` rule | `@discourse/heic` 디코더 wasm을 npm 모듈로 해석하지 않게 한다. |
| 테스트 | `tests/self-host-production-e2e.test.mts`, `tests/self-host-atomic-manifests.test.mts` | `next/dist/compiled/webpack`을 import해 위 경계를 검증한다. |

해제 조건(모두 충족해야 한다):

1. 세 계약을 Turbopack 설정이나 bundler 독립적인 방식으로 다시 구현하고, fixture 경계가 Production 빌드에 섞이지 않음을 같은 수준의 테스트로 다시 증명했다.
2. 위 두 테스트가 webpack 내부 모듈 없이 같은 계약을 검사한다.
3. 로컬·자체 호스팅 CI에서 빌드 시간과 메모리를 측정해 전환 이득을 확인했다.

Next가 webpack 지원 축소를 예고하면 위 조건과 무관하게 이 항목을 Issue로 올린다. 관련 Issue: —

## 보류: 대규모 재배치·타입 생성·공용 프레임워크

효용이 탐색성과 장기 타입 안전에 한정되고, 소스 경로를 하드코딩한 계약 테스트와 병합 충돌 비용이 크다. 아래 허용 범위(각각 작은 PR)만 필요할 때 기능 변경에 편승해 진행한다.

| 항목 | 지금 허용하는 범위 | 전면 적용 재개 조건 | Issue |
| --- | --- | --- | --- |
| `src/lib` 평면 파일 디렉터리 재편(partner, admin, 알림, member, Mattermost, 텔레메트리, graduate 접두사) | partner portal 관련 6파일만 `src/lib/partner-auth/`로 이동(바깥 평면 파일에 의존하는 유일한 경계) | 배치 규칙([결정 D4](./active/refactor-program-2026-10.md#기본-결정))이 정착하고, 해당 도메인 기능 변경이 예정되며, 그 경로를 읽는 소스 계약 테스트를 먼저 재지정했을 때. 재개 전에 서버 전용 표식(`.server.ts` 접미사와 `server-only` import 중 무엇을 경계로 삼을지)을 먼저 정한다. 기준 시점에 `src`의 `.server.ts` 35개 중 `server-only`를 import하는 파일은 4개뿐이라 어느 쪽도 일관된 경계가 아니다. | — |
| `supabase gen types` 기반 Database 타입 | 수동 생성 스크립트와 생성 파일 커밋, 저장소 1개 파일럿 typed accessor | 운영 DB와 같은 마이그레이션 적용 결과를 CI 밖에서 재현할 수 있을 때. 전역 적용은 기존 `as XxxRow` 단언이 타입 오류로 깨질 수 있어 단계적으로 한다. | — |
| route handler 공용 래퍼·API 응답 봉투 통일 | 새 라우트에만 `unauthorized()`·`forbidden()`·`payloadTooLarge()` 같은 상수 응답 적용 | 보안 경계 하드닝이 안착하고 가드 순서를 검사하는 소스 정규식 테스트를 동작 테스트로 바꾼 뒤 | — |
| 공용 fake Supabase·mock/Supabase 계약 스위트 | 새 테스트에만 쓰는 작은 env·HTTP 테스트 헬퍼 | mock 지원 범위([결정 D6](./active/refactor-program-2026-10.md#기본-결정))가 바뀔 때 | — |
| 소규모 정리 | 사건명 테스트 파일 리네임, 관리자 read model timeout 상수 3단계 통합, 파트너 플랜 RPC 에러 매퍼 추출과 허용 목록 패리티 테스트 | 해당 파일을 다른 이유로 수정할 때 | — |
| `cacheComponents`·PPR 범위 재논의 | 없음([결정 D8](./active/refactor-program-2026-10.md#기본-결정)) | 첫 페인트·이미지 개선 뒤 PVE에서 익명·로그인 TTFB를 실측해 유의미한 차이가 날 때, 한 라우트 스파이크로 | — |

## 제외 결정

이번 프로그램에서 하지 않기로 한 후보와 다시 검토할 조건이다.

### 구조

| 제외한 후보 | 이유와 대체 | 재검토 조건 |
| --- | --- | --- |
| members·promotions·graduate·partner account 등 신규 Repository 인터페이스+mock 쌍 대량 도입 | 영향 파일이 많고 인증·롤백 경로와 겹치며 mock 쓰기 구현은 유지비만 늘린다. 위 증가 금지 기준으로 대체한다. | 해당 도메인 기능 변경 때 결정 D4 배치로 한 도메인씩 |
| `defineRouteHandler`·`withApiGuards`류 공용 래퍼와 API 응답 봉투 일괄 통일 | 100개가 넘는 라우트의 가드 순서와 응답 shape를 한 번에 바꾸는 큰 작업이고 소스 계약 테스트가 모두 깨진다. 좁은 보안 하드닝으로 대체한다. | 위 보류 표의 route 래퍼 조건 |
| `src/lib` 평면 파일 순수 재배치 | 동작·규칙 위반 해소 없이 importer와 테스트 경로만 바꾼다. 접두사 지도는 [시스템 개요](../architecture/system-overview.md#domain-servicehelper-배치)에 둔다. | 위 보류 표의 디렉터리 재편 조건 |
| 캐시 추상화(`defineCachedRead`, `use cache` 대비 어댑터)와 무효화 모듈 6개 분리·`next/cache` import 금지 lint | `unstable_cache`는 현재 Next에서 동작하고 `use cache`는 지시어 기반이라 어댑터로 바뀌지 않는다. TTL 상수 통합과 무효화 헬퍼만 한다. | Next가 `unstable_cache` 제거를 예고하거나 `use cache` 전환을 결정할 때 |
| 용도별 파생 서명 키 레지스트리, v1→v2 이중 검증, 서명 쿠키 세션 팩토리 | 전 세션·이메일 코드·QR이 무효화될 위험이 크고 real 모드가 이미 전용 비밀을 요구한다. fallback 제거와 비밀 읽기 헬퍼로 충분하다. | 키 유출이 의심되거나 정기 키 회전 정책을 도입할 때 |
| `supabase/migrations` squash | 적용 원장이 이름·checksum으로 검증하고, 다수 테스트가 마이그레이션 파일명을 참조한다. forward-only 규칙과 충돌한다. | 없음(현재 형태는 `schema.sql`로 확인) |
| i18n 추출 | 단일 로케일 제품이다. 오류 메시지 매핑은 공용 검증 작업에서 다룬다. | 다국어 지원 요구가 생길 때 |
| Storybook 스토리 자체의 유지비 축소 | 별도 결함 근거가 없다. 스토리 인벤토리는 mock 시나리오 정리에서 다룬다. | 스토리 유지가 기능 변경을 실제로 막을 때 |
| React Compiler 사용 중 수동 `useMemo`/`useCallback` 제거 | 동작 영향이 없고 효과가 작다. | 해당 파일을 다른 이유로 수정할 때 |
| 회원 수동 추가 provisioning의 순차 왕복 최적화 | 호출처가 없는 `provisionManualMembers`와 전용 rollback·payload 테스트를 제거했다. 활성 회원 가져오기 파이프라인의 정규화·알림 계약은 유지하며 해당 활성 경로를 테스트한다. | 수동 추가 기능을 다시 화면에 연결할 때. 그때는 soft-delete 회원을 덮어쓰지 않는지도 함께 확인한다. |
| Storage bucket 상수의 전역 레지스트리화 | 업로드·프로필·리뷰 등 각 도메인이 자신의 bucket 계약을 소유한다. 이름이 같다는 이유만으로 서로 다른 수명·권한 경계를 하나의 전역 설정에 결합하지 않는다. | 여러 도메인이 실제로 함께 변경돼야 하는 공용 bucket 계약이 생길 때 |

### 성능·UX·운영

| 제외한 후보 | 이유와 대체 | 재검토 조건 |
| --- | --- | --- |
| 회원 게이트의 Suspense 이전·proxy 통합·`cacheComponents`/PPR 전환 | Suspense 안의 `redirect()`는 클라이언트 이동이 돼 동의·사진 필수 게이트가 약해진다. 결정 D8과 같다. | 위 보류 표의 TTFB 조건 |
| 사용 빈도가 낮아 보이는 인덱스 삭제, PostgREST 최대 행 수 설정 도입 | 운영 DB 사용 통계 없이 삭제하면 위험하고 이득이 작다. 스냅샷에서 빠져 보이는 인덱스는 스냅샷 드리프트일 수 있다. | 운영 DB `pg_stat_user_indexes`의 `idx_scan`을 2주 간격으로 두 번 수집한 뒤. 행 수 상한은 전량 읽기 경로 정리 뒤 |
| `tailwind-merge` 도입·전역 `!` 금지, 전역 `dark:`·팔레트 금지 lint, soft/foreground 토큰 대량 codemod, `text-xs` 일괄 치환 | 수백 개 call site의 클래스 해석을 바꾸고 정당한 사용(인증 카드·QR·차트·스켈레톤 등)에 허용 목록이 필요하다. 토큰 래칫과 핫스팟 이관으로 대체한다. | 토큰 래칫 수치가 충분히 줄어 전역 금지가 현실적일 때 |
| 횡단 프레임워크: 액션 피드백 레지스트리·쿼리 키 통일·공용 피드백 배너, 서버 로거 codemod·`no-console`·요청 ID 상관, env 매니페스트 생성기 | 관리자 사용자가 적고 로그 수집기가 없는 1인 운영 대비 과투자이고 소스 계약 테스트 충돌이 크다. 최소 조치(세션 만료 헬퍼, raw error 정제, 예시 env 보강과 대조 테스트)로 대체한다. | 로그 수집기를 도입하거나 운영자가 늘 때 |
| 관측 후속: 컨테이너 자원 지표(cAdvisor), 수신기 상태·서비스 로그·경보 훈련 운영 래퍼 | 앱·의존성·예약 작업·배포 수신기·edge 5xx 경보와 runbook의 확인 명령으로 1인 운영 장애 인지는 충분하다(#543). 상주 exporter와 래퍼는 유지 대상만 늘린다. | 컨테이너 자원 문제로 장애가 반복되거나 같은 확인 절차를 자주 반복할 때 |
| 측정·스키마가 먼저 필요한 재설계: Storage `copy()` 전환, 엑셀 서버 파싱 엔드포인트, 업로드 variants와 업로드 세션 컬럼 확장, 제휴처·캠퍼스별 동적 OG 이미지, RSS·sitemap 캐시, 페이지 12개 `Promise.all` 일괄 전환 | 전제가 틀렸거나(재검증은 헤더 파싱) 새 공격 표면을 만들거나, 효과를 측정하지 않았다. | 실측 결과나 별도 Issue가 생길 때 |
| 금칙어 테스트, Storybook a11y 정기 실행·Playwright 모바일 프로젝트 이동, Turbopack 전환 스파이크, 아이콘 일괄 전환·아이콘 배럴, 쿠폰 두 흐름 통합·쿠폰함 전면 사용 진입, 종료 이벤트 archived 상태·삭제 | 운영자·제품 결정 또는 측정이 먼저다. 어미·아이콘·쿠폰은 결정 D17·D18로 범위를 정했고, Turbopack 전환 조건은 위 [webpack 고정](#webpack-고정) 절에 기록했다. | 각 결정이 바뀌거나 빌드 속도를 측정했을 때. 이벤트 상태는 보상 모델 확정 뒤 |

### 보안·데이터·복원력

| 제외한 후보 | 이유와 대체 | 재검토 조건 |
| --- | --- | --- |
| nonce 기반 CSP | 모든 페이지를 dynamic 렌더로 강제하고 첫 페인트 개선이 먼저다. 결정과 tradeoff만 위협 모델에 기록한다. | 첫 페인트 개선 뒤 정적 렌더 비중이 정해졌을 때 |
| `/api/image` HMAC 서명 | 클라이언트 호출·관리자 미리보기와 충돌한다. 클라이언트 IP 복원과 이미지 프록시 버킷 제한으로 대체한다. | 프록시 남용이 관측될 때 |
| 제품 이벤트 정의 단일 객체 통합, 행 키 단언 헬퍼 | 후자는 기존 행 변환이 블라인드 캐스트라 전제가 틀렸고, 둘 다 Database 타입 생성 결정에 종속된다. | `supabase gen types` 전면 적용을 결정할 때 |
| blue-green 2슬롯 배포, 백업 계층 보존 도구, Cron 체크포인트 래퍼 | 1인 운영 대비 과투자다. | 배포 중단 시간이나 백업 용량을 측정해 문제가 확인될 때 |
| 역할별 DB `statement_timeout` | 앱의 Supabase 상한은 클라이언트 쪽이라 DB 안의 질의를 취소하지 않을 수 있다. 실제로 계속 실행되는지 운영 DB에서 확인하지 않았고, 이번 프로그램의 새 마이그레이션은 [결정 D9](./active/refactor-program-2026-10.md#기본-결정)에 따라 RF-02 묶음에만 둔다. [외부 호출 상한](../operations/reliability.md#외부-호출-상한) 규칙으로 대체한다. | 상한에 걸린 요청 뒤에도 질의가 계속 실행되는 것이 운영 DB 관찰로 확인될 때 |
| SMTP 전송 전체 마감, 시도 수를 제한한 DNS 사전 해석 | nodemailer가 resolver 시도 횟수를 노출하지 않아 응답 없는 DNS 앞에서 해석이 상한을 넘을 수 있다. 전체 마감은 실패로 답한 메일이 늦게 발송될 수 있고, 사전 해석은 TLS 검증 경로를 다시 확인해야 한다. 기본 발송 경로가 Resend면 수용한다. | 운영 기본 발송 경로가 SMTP로 확인되거나 DNS 지연으로 공개 요청 상한을 넘는 사례가 관측될 때 |
| 리뷰 이미지 연결 실패 뒤 같은 요청 ID 재시도와 중복 요청 정리의 경합 | 기존 결함이다. 실패 정리는 최종 파일만 지우고 업로드 세션은 연결 상태로 남아, 같은 업로드로 다시 연결하면 지워진 파일 URL이 리뷰에 저장될 수 있다. 중복 요청이 먼저 온 요청의 리뷰 저장 전에 실패하면 같은 경로의 파일을 지울 수 있는 짧은 창도 남는다. 재시도는 공용 업로드 계약(정리 시 세션 해제 또는 연결 시 객체 확인)과 작성 화면의 다시 올리기 처리로, 경합 창은 연결 임대(lease)나 파일 유지와 고아 정리 작업으로 닫아야 하고, 무엇을 고르느냐에 따라 재시도 UX와 미사용 파일 보유 기간이 달라진다. 지금은 저장되지 않았음이 확인될 때만 정리하도록 좁혔다. | 리뷰·업로드 흐름을 다시 고칠 때, 또는 재시도 UX와 미사용 파일 보유 기간을 정할 때 |
| Wallet 플랫폼 분기·다운로드 폴백 | 현재 마운트되지 않은 코드다. | Apple Wallet 재노출 Issue(#301)에서 |
| 회원 self-service 열람 화면 | 처리방침 v4의 열람 요청 절차 문구로 대체하고 실제 요청이 오면 관리자 내보내기부터 한다. | 열람 요청이 반복될 때 |

## 종료 Issue에서 이관한 잔여 항목

종료된 기능 명세의 미체크 항목 중 저장소 문서 증거로 완료를 확인하지 못한 것이다. 라이브 상태 확인은 운영자 몫이며, 완료가 확인되면 이 표에서 지운다. 각 명세의 종료 정리는 [기능 명세 인덱스](../specs/index.md)에서 연결한다.

| 항목 | 출처 | 현재 판단 | 재개 조건 | Issue |
| --- | --- | --- | --- | --- |
| 독립 회선에서 공개 HTTPS 직접 확인과 상시 외부 polling | #478, #523 | 같은 집 네트워크와 heartbeat 감시만 확인됐다. 결정 D15에 따라 GitHub schedule 대신 [외부 HTTP 감시 설정 절차](../operations/runbooks/self-host-observability.md#외부-http-감시-설정)를 문서화했다(#543). 외부 모니터 설정과 `OPS_EXTERNAL_MONITOR_CONFIGURED` 선언은 운영자 조치로 남아 있다. | 운영자가 외부 모니터를 설정하고 실패·회복 알림 도착을 실측할 때 | #543 |
| 서버 밖 복구 키 보관과 새 장치에서의 복구 실습 | #435 | 복구 키 보관 위치·2차 수신자가 운영자 결정 대기다. 보관 위치는 공개 저장소에 쓰지 않는다. | 운영자 결정 뒤 | #530 |
| 독립 장애 영역 백업 사본과 연속 WAL/PITR | #435, #523 | 6시간 스냅샷은 연속 PITR이 아니고, PVE 사본은 운영 VM과 같은 물리 호스트에 있다. | 백업 보존·사본 위치 결정 뒤 | — |
| RPO/RTO 확정과 운영 VM 자원·부하 측정 | #435 | 순차 재부팅 복구 시간과 소규모 순차 요청만 측정했다. | 운영 연속성 문서 작업 때 | #530 |
| DB 이미지 최소화(부가 PostgreSQL 패키지 제거, SBOM·취약점 검증) | #435 | 미착수 | DB 이미지를 다시 빌드할 때 | — |
| 자체 RUM·오류·가용성 대시보드와 외부 알림의 완결 | #435 | 관측 작업 단위(#543)가 서버 오류 구조화 로그, `/api/ready` 준비 상태, edge 5xx·예약 작업·배포 수신기·DB 경보와 대시보드 패널을 추가하고 Web Vitals 보존 한계(telemetry 메모리 histogram, Prometheus 7일)를 [관측 runbook](../operations/runbooks/self-host-observability.md#web-vitals-보존)에 기록했다. 남은 범위는 운영 VM 적용과 실측, 2주 운영 뒤 잠정 임계값 재검토, 위 독립 회선 외부 감시다. Web Vitals 원본 장기 저장소와 별도 오류 수집 endpoint는 두지 않는다. | 운영 적용·임계값 재검토가 끝나거나, 7일보다 긴 성능 비교가 실제로 필요해질 때 | #543 |
| Apple Wallet 실제 연동 확인 | #435 | 메일·Mattermost·Push는 운영 사용 중이다. Wallet 기능과 조정 timer는 비활성이다. | Wallet 재노출(#301) 때 | #301 |
| 테스트 SMTP·푸시 수신처를 허용하는 제한된 Preview 외부 연동 경로 | #435 | Preview는 외부 메일·푸시·Mattermost 통신을 차단한 상태로 운영한다. | Preview에서 실제 발송 검증이 필요해질 때 | — |

## 문서 freshness 연동

- `source_paths`가 바뀌었지만 관련 descriptive 문서가 갱신되지 않은 경우를 자동으로 경고하는 기능은 후속 후보로 둔다.
- 단순 경로 변경이 거짓 양성을 만들 수 있으므로 현재 문서 검증기는 metadata, 구조, 링크, 탐색 가능성만 fail-closed로 검사한다.

## 정리 기록

- 2026-10-05: 이전 원장의 "Push service와 관리자 UI 분해"는 `src/lib/push/*` 모듈 분리와 `AdminPushManager`·`PushSettingsCard` 축소로 끝나 삭제했다. 남은 큰 화면은 위 `PushComposerSection` 후보로 옮겼다. 범위가 정의되지 않은 "DB Schema-Service wave 11"도 삭제했다.
