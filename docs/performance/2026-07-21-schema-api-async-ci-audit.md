# 2026-07-21 스키마·API·비동기 UX·CI 감사

관련 이슈: [#181](https://github.com/MyKnow/ssartnership/issues/181)

## 2026-07-22 구현 착수

- `/admin/members` Mattermost 백필을 관리자 명시 배치로 실행하도록 바꾸고, 한 번에 최대 100명만 처리한다.
- 회원 UUID를 오름차순 cursor로 반환해 다음 배치를 이어서 실행할 수 있게 했다.
- 배치 크기와 cursor는 Server Action 경계에서 whitelist 검증하며, 기존 회원 동기화·감사 로그·실패 집계 계약은 유지한다.
- 이번 단계는 durable job 전환 전의 명시적 배치 단계이며, Preview/Production 운영 검증과 장기 job 필요성 재평가는 후속으로 남긴다.

## 조사 범위와 근거

- Vercel Production runtime 로그와 Supabase Production query 통계를 2026-07-21 KST에 읽기 전용으로 확인했다.
- DB 변경은 migration 파일과 schema snapshot에만 기록했다. Production 적용은 `production-migrations.yml`의 명시적 수동 gate를 통과할 때만 수행한다.
- 로그 원본 값, 회원 ID, 세션 ID, IP 주소는 이 문서와 신규 집계 테이블에 저장하지 않는다.

## 적용한 개선

### 플랫폼 활성도와 과거 지표

- `platform_active_identities`는 KST 일자, 식별자 종류, 단방향 해시만 저장하는 private projection이다. RLS를 켜고 `anon`/`authenticated` 권한을 제거했다.
- `event_logs` insert trigger는 로그인 회원과 비로그인 `guest` 세션을 분리해 projection을 갱신한다.
- `event_logs` 전체를 group-by/upsert하는 별도 DML migration을 추가했다. 따라서 재실행해도 같은 행을 중복 생성하지 않고, 배포 전 로그도 DAU·WAU·MAU 과거 구간에 포함된다.
- 관리자 홈은 로그인 회원 DAU/WAU/MAU와 비로그인 방문 세션을 명확히 분리해 표시한다. 2026-07-21 확인 시 최근 30일 원본 로그 기준 회원 MAU는 40명, 비로그인 방문 세션은 1,316개였고, 활동 잔디는 최근 12주를 보여준다.

### 중복 제휴처 집계 RPC

- 즐겨찾기와 리뷰 수는 항상 같은 화면에서 함께 요청돼 기존에는 RPC 두 번을 실행했다.
- `get_partner_engagement_counts(uuid[])`로 둘을 한 번에 가져오도록 관리자 지표, 파트너 대시보드, 제휴처 메트릭 호출을 통합했다.
- 기존 각각의 RPC는 외부/레거시 호환성을 위해 삭제하지 않았다. 호출자·소유자 inventory가 끝나기 전에는 legacy API를 제거하지 않는다.

### CI 중복 실행

- `public-readiness`, `storybook`, `lockfile-check`은 feature branch push와 PR 동시 생성 때 같은 검사를 중복 실행했다.
- push trigger를 `main`/`dev`로 한정하고 PR 검사는 유지했다. 동일 ref의 이전 run은 concurrency로 취소한다.

## 관찰된 병목과 후속 결정

| 관찰 | 근거 | 현재 결정 | 다음 조치 |
| --- | --- | --- | --- |
| `/admin/members` 요청이 300초에 종료됨 | Vercel Production timeout 로그 | 단일 요청의 전체 Mattermost 프로필·사진 동기화는 유지하지 않는다 | cursor 기반 durable job/관리자 명시 배치로 분리 |
| `event_logs` direct insert가 가장 많은 DB 호출 | Supabase query 통계에서 약 17.5k 호출, 평균 약 31ms | producer가 외부일 수 있어 즉시 계약을 바꾸지 않는다 | producer owner를 확정한 뒤 batch/RPC ingest 검토 |
| `get_admin_logs_summary`에 temporary write 관찰 | Supabase query 통계 | 이번 변경에서 무근거 index를 추가하지 않는다 | 운영 데이터 기간을 둔 뒤 `EXPLAIN (ANALYZE, BUFFERS)`로 cursor/rollup 결정 |
| image FormData 413 | Vercel 과거 로그 | 공통 staging Presigned URL 업로드로 해결된 기존 변경을 유지 | 413 재발 경보와 네트워크 payload 관찰 |

## 삭제하지 않은 레거시 항목

`mm_user_directory.legacy_ssafy_mattermost_user_id`를 포함해 이름만으로 legacy로 보이는 테이블·컬럼은 삭제하지 않았다. 아직 query/외부 owner inventory가 없는 상태에서 삭제하면 Production 가입/동기화 경로가 깨질 수 있다. 최소 30일 관찰 뒤 참조가 없고 rollback 요구가 없을 때 forward migration으로 제거한다.

## 비동기 UX 점검 원칙

- pagination, mutation, 재시도는 실제 권한과 데이터 양을 포함한 E2E로 확인한다.
- 새 action은 pending 동안 중복 실행을 막고, 버튼/폼에는 진행 상태와 실패 시 재시도 경로를 제공한다.
- 화면 코드를 정적 검색만으로 일괄 수정하지 않는다. 접근 불가 버튼이나 이미 공통 async action wrapper를 사용하는 흐름을 오탐으로 바꾸지 않기 위해서다.

## 배포 전 확인

1. Preview에서 DDL → DML backfill 순서로 migration을 적용한다.
2. 관리자 로그 권한이 있는 global admin에게만 지표 패널이 보이는지 확인한다.
3. 관리자 페이지 진입 시 metrics RPC 실패가 전체 대시보드를 실패시키지 않는지 확인한다.
4. Production manual migration gate 후, 원본 `event_logs`와 집계 RPC의 최근 30일 회원/guest count를 대조한다.
