# FIX.md

이 문서는 현재 코드베이스를 훑으면서 확인한, 불필요한 서버 에러와 UX 저하 지점을 기록한다.  
기준은 `500을 사용자에게 직접 노출시키는가`, `같은 화면에서 복구할 수 있는가`, `입력값을 잃지 않는가`다.

## 수행

- `src/app/admin/(protected)/actions.ts`의 브랜드 create/update 검증 실패를 redirect/query param 기반으로 바꾸고, `/admin/partners`와 `/admin/partners/new`에서 inline error + focus 복구가 되도록 정리했다.
- `src/app/admin/(protected)/partners/new/page.tsx`와 `src/components/PartnerCardForm.tsx`를 `useActionState` 기반으로 바꿔, `/admin/partners/new`에서 validation 실패 시 입력값과 이미지를 유지하고 필드 아래에 에러를 보여주도록 정리했다.
- `src/components/PartnerCardForm.tsx`의 핵심 입력 필드를 controlled state로 바꿔, validation 실패 시 텍스트/선택값이 초기화되지 않도록 보강했다.
- `src/components/partner/PartnerPortalActionLinks.tsx`의 로그아웃 프리패치를 꺼서, 미리 요청으로 세션이 풀리는 경로를 막았다.
- `src/app/admin/(protected)/partners/page.tsx`와 `src/app/admin/(protected)/partners/new/page.tsx`를 분리해서, 브랜드 추가 실패 시 현재 작성 페이지에 남고 성공 시 목록으로 이동하도록 바꿨다.
- `src/lib/partner-form-errors.ts`와 `src/components/admin/AdminPartnerCreateToast.tsx`를 추가해, 생성 성공/실패 메시지를 공용으로 다루게 했다.
- `src/app/admin/(protected)/actions.ts`의 카테고리/협력사/기수 설정 입력 오류를 redirect 기반으로 바꾸고, `partners / companies / cycle` 페이지에서 같은 화면 복구가 되도록 배너를 붙였다.
- `src/app/admin/(protected)/actions.ts`의 업체 계정/연결/초기설정/회원 수정·삭제/브랜드 승인·거절·삭제 입력 오류도 redirect 기반으로 바꾸고, `companies / members / partners` 페이지에서 같은 화면 복구가 되도록 확장했다.
- `src/app/api/suggest/route.ts`의 메일 설정 누락/전송 실패를 503 계열로 정리하고, `src/components/SuggestForm.tsx`에서 inline error로 같은 화면 복구가 되도록 바꿨다.
- `src/lib/partner-change-requests.ts`의 Supabase 조회/갱신 실패를 `PartnerChangeRequestError`로 감싸, 호출부에서 같은 화면 복구 경로로 처리할 수 있게 정리했다.
- `src/lib/policy-documents.ts`, `src/lib/push.ts`, `src/lib/ssafy-cycle-settings.ts`, `src/lib/mm-directory.ts`의 raw `Error`를 typed error로 바꿔, 데이터 계층 예외를 코드화하기 시작했다.
- `src/lib/mm-member-sync.ts`와 `src/lib/member-manual-add.ts`의 raw `Error`도 typed error로 바꿔, 회원 동기화/수동 추가 경로까지 동일한 예외 규칙으로 맞췄다.
- `src/components/admin/AdminPushManager.tsx`와 `src/components/admin/AdminLogsManager.tsx`의 fetch 실패를 토스트만 남기지 않고 inline error로 보여주도록 바꿨다.
- `src/app/api/mm/*`, `src/app/api/partner/change-password/route.ts`, `src/app/api/partner/reset-password/route.ts`, `src/app/api/partner/setup/[token]/route.ts`의 catch-all 500을 503 계열로 낮추고, 인증/초기설정/재설정 실패가 같은 화면에서 복구 가능하도록 정리했다.

## P0. 서버 액션의 입력 오류가 500으로 승격되는 경로 (완료)

- `src/app/admin/(protected)/actions.ts:960-1078`
- `src/app/admin/(protected)/actions.ts:1234-1455`
- `src/app/admin/(protected)/actions.ts:1559-1766`
- `src/app/admin/(protected)/actions.ts:1841-2035`

문제:
- 카테고리, 기준 학기, 회사, 협력사, 회원 수정/삭제 같은 관리자 입력 흐름에서 `throw new Error(...)`가 많다.
- 이 중 일부는 아직 redirect나 inline message로 흡수되지 않아, 폼 검증 실패나 not found가 곧바로 Next error boundary 또는 500으로 이어질 수 있다.
- 특히 “존재하지 않음”과 “입력값 누락”은 서버 장애가 아니라 사용자 상호작용 실패다.

권장:
- 사용자 입력 오류는 `redirect(...?error=...)`, `FormMessage`, field error state, 또는 structured action result로 돌린다.
- not found는 가능한 한 같은 목록/작성 화면으로 돌려보내고, 복구 가능한 메시지를 보여준다.
- raw throw는 invariant나 진짜 시스템 장애에만 남긴다.

## P0. 회원 인증 API에서 복구 가능한 실패가 500으로 끝남 (완료)

- `src/app/api/mm/verify-code/route.ts:390-523`
- `src/app/api/mm/change-password/route.ts:159`
- `src/app/api/mm/reset-password/route.ts:397`
- `src/app/api/mm/request-code/route.ts:406`
- `src/app/api/mm/consent/route.ts:97`
- `src/app/api/mm/profile-sync/route.ts:39`
- `src/app/api/partner/change-password/route.ts:171`

문제:
- 코드, 비밀번호, 동의, 초기화, 프로필 동기화 과정에서 외부 API나 DB 상태가 조금만 흔들려도 `500`이 된다.
- 사용자는 입력을 맞게 넣었는데도 “잠깐 실패”와 “입력 실수”를 구분하지 못한다.
- 일부 경로는 이미 `400/401/429`를 쓰지만, 마지막 catch-all 500이 너무 넓다.

권장:
- 인증/변경/초기화는 실패 사유를 코드화해서 같은 페이지로 되돌린다.
- 입력값은 유지하고, 재시도 가능한지와 무엇이 틀렸는지 분리해서 보여준다.
- 500은 정말 예외적인 내부 장애만 남긴다.

## P1. 제안/문의 폼의 전송 실패가 너무 거칠게 처리됨 (완료)

- `src/app/api/suggest/route.ts:40-166`

문제:
- 이메일 전송 전 검증은 잘 되어 있지만, SMTP 설정 누락이나 전송 실패는 결국 500으로 끝난다.
- 사용자는 제출이 저장됐는지, 재시도해도 되는지, 어떤 필드가 문제인지 알기 어렵다.

권장:
- 제안은 먼저 저장하고 전송은 비동기로 넘기거나, 최소한 실패 코드와 재시도 안내를 분리한다.
- 요청 실패 시에도 작성 폼으로 돌아가 입력값을 유지한다.

## P1. 데이터 계층의 raw Error가 너무 넓게 퍼져 있음 (완료)

- `src/lib/partner-change-requests.ts`
- `src/lib/mm-directory.ts`
- `src/lib/mm-member-sync.ts`
- `src/lib/push.ts`
- `src/lib/policy-documents.ts`
- `src/lib/ssafy-cycle-settings.ts`
- `src/lib/member-manual-add.ts`

문제:
- 이들 함수는 `throw new Error(...)`를 많이 사용한다.
- helper 자체는 괜찮지만, 호출부가 한 번만 catch를 빼먹어도 서버 에러로 바로 번진다.
- 현재는 사용자가 직접 트리거하는 흐름과 내부 배치 흐름이 섞여 있어, 예외를 어디서 흡수해야 하는지 경계가 흐리다.

권장:
- 사용자 상호작용 경로는 `Result` 스타일이나 에러 코드 기반 반환으로 맞춘다.
- 내부 배치나 정말 복구 불가능한 케이스만 raw throw를 유지한다.

## P2. 클라이언트 fetch 실패가 toast로만 끝나는 패턴 (완료)

- `src/components/admin/AdminPushManager.tsx:280-409`
- `src/components/admin/AdminLogsManager.tsx:909-1020`

문제:
- 실패는 토스트로 알려주지만, 어떤 조건에서 실패했는지 화면에 남지 않는다.
- 긴 작업이나 삭제 작업에서는 입력 상태와 실패 사유를 같이 봐야 복구가 쉽다.

권장:
- destructive action은 inline retry 또는 failure state를 남긴다.
- 가능하면 서버 응답 코드와 메시지를 화면 상태에 반영해, 다음 행동이 바로 보이게 한다.

## 이미 정리된 항목

- `src/app/admin/(protected)/actions.ts`의 브랜드 create/update는 `/admin/partners` 흐름에서 redirect 기반 에러 처리로 바꿨다.
- `src/components/partner/PartnerPortalActionLinks.tsx`의 로그아웃 프리패치는 꺼서, 미리 요청으로 세션이 풀리는 문제를 줄였다.
- `src/app/admin/(protected)/partners/page.tsx`와 `src/app/admin/(protected)/partners/new/page.tsx`는 작성 실패를 페이지 안에서 보여주도록 분리했다.

## 다음 우선순위

- 관리자 action 전체를 “raw throw -> redirect/query param -> inline form state” 패턴으로 계속 정리한다.
- 회원/파트너 인증 API는 500과 사용자 입력 실패를 더 명확히 분리한다.
- 폼성 페이지는 서버 에러 대신 같은 페이지 복구를 기본값으로 둔다.
