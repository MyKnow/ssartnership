---
title: 신뢰성 판단과 복구 기준
type: runbook
status: current
authority: normative
---

# 신뢰성 판단과 복구 기준

회원 로그인·허용 혜택 조회·관리자 업무·업로드·외부 발송·배포와 복구를 독립적으로 판단한다.

| 확인 대상 | 성공 근거 | 실패 대응 정본 |
| --- | --- | --- |
| 앱 | exact SHA/image, health, 공개 URL, 필요한 인증 과업 | [배포·rollback](./runbooks/self-host-ci-maintenance.md) |
| DB·Storage | 적용 schema와 복원 목록·객체 동등성 | [데이터 운영](./runbooks/self-host-database.md) |
| 백업·외부 사본 | 최근 성공 시각, 검증 가능한 사본, 복원 시험 | [백업](./runbooks/self-host-operations.md), [외부 사본·관측](./runbooks/self-host-observability.md) |
| 외부 전달 | 요청 접수와 provider 전달 결과 구분 | [API](../architecture/api-and-integrations.md), [로그](../architecture/event-logging.md) |

가용성·RTO·RPO 목표는 측정 근거와 운영 승인이 있어야 한다. 이 정비에서는 새 목표 수치를 승인하지 않는다. 미정 목표를 충족한 것으로 보고하지 않는다.

Runbook은 대상 환경·필요 권한·선행 조건·부작용·성공·중단·복구 조건을 포함한다. 실제 장애가 생기면 시각·영향·원인·복구·재발 방지를 시점 기록으로 남기며, 평소 절차 정본과 분리한다.

## 외부 호출 상한

외부 호출(DB gateway·메일·푸시·외부 API)은 모두 명시적 상한을 둔다. 하위 호출 상한은 그 호출을 기다리는 상위 상한보다 길 수 없다. 상위가 먼저 포기한 뒤에도 서버가 계속 매달려 연결과 작업자를 점유하지 않게 하기 위해서다.

| 계층 | 상한 | 정본 |
| --- | --- | --- |
| 공개 요청(edge·relay 프록시) | 본문 수신·응답 쓰기 각 70초 | `deploy/pve/edge.Caddyfile`, `deploy/pve/relay.Caddyfile` |
| 예약 작업 호출 클라이언트 | 60초 후 중단 | `scripts/lib/self-host-cron.mjs` |
| Supabase REST·RPC·Auth | 30초 (`SUPABASE_FETCH_TIMEOUT_MS`) | `src/lib/supabase/timeout.ts` |
| Supabase Storage(`/storage/v1/`) | 60초 (`SUPABASE_STORAGE_FETCH_TIMEOUT_MS`) | `src/lib/supabase/timeout.ts` |
| SMTP | DNS 질의 시도당 5초, 연결 10초, 인사 10초, 소켓 무응답 20초 | `src/lib/smtp.ts` |
| Resend·Mattermost·사업자 상태조회·이미지 프록시·APNs | 각 10초 | 각 클라이언트 모듈 |
| Web Vitals 수집기 | 2초 | `src/app/api/web-vitals/route.ts` |

- Supabase 상한은 서버 SDK 클라이언트(`getSupabaseAdminClient`, `getSupabasePublicClient`)의 공용 fetch에 걸린다. 쿼리의 `.abortSignal()`이나 Request의 signal은 `AbortSignal.any`로 결합되어 먼저 발생한 쪽이 요청을 끊는다.
- 예외: `getSupabasePublicClient`의 Next 데이터 캐시가 만료 항목을 다시 받아오는 재검증 요청(백그라운드 갱신·정적 재생성)에는 Next가 signal을 넘기지 않아 이 상한이 걸리지 않는다. 캐시 항목이 없어 처음 받아오는 요청과 admin 클라이언트(`cache: "no-store"`) 요청에는 상한이 걸린다.
- Next는 `init`에 signal이 있는 요청을 렌더 단위 GET 중복 제거에서 뺀다. 내부 gateway(`SUPABASE_INTERNAL_URL`) 경로는 Next가 Request로 합쳐 중복 제거가 유지되지만, gateway 없이 직접 연결하면 같은 렌더의 동일 조회가 각각 DB로 간다. 한 렌더에서 반복되는 조회는 fetch 중복 제거에 기대지 말고 React `cache()`로 감싼다.
- 두 Supabase env는 1초~300초 정수 밀리초만 받는다. 잘못된 값은 무시하고 기본값을 쓰며, 서버 로그에는 env 이름만 남긴다.
- SMTP DNS 상한은 질의 시도 1회 기준이다. Node resolver는 기본 4회 시도하며 시도마다 대기를 두 배로 늘리므로, DNS 서버가 아예 응답하지 않으면 IPv4·IPv6 해석이 각각 약 75초까지 걸릴 수 있다. nodemailer 옵션에는 시도 횟수 설정이 없다.
- 상한 초과는 일시 실패다. PostgREST는 메시지가 `TimeoutError:`로 시작하는 오류 객체를, Storage는 `originalError.name`이 `TimeoutError`인 `StorageUnknownError`를, SMTP는 연결·인사·무응답 초과에 `ETIMEDOUT`을, DNS 해석 실패(상한 초과 포함)에 `EDNS`를 돌려준다. 이를 "없음", 영구 거부, 구독·자격 비활성화로 분류하지 않는다.
- 클라이언트 중단은 DB 안의 질의를 취소하지 않을 수 있다. 저장소는 역할별 `statement_timeout`을 설정하지 않으므로, DB 측 상한이 필요하면 측정 후 별도 migration으로 정한다.
- 상한을 올리기 전에 해당 경로의 실제 최대 소요를 측정한다. 공개 요청 경로는 70초, 예약 작업은 60초 위로 올려도 효과가 없다.
