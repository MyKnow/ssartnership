---
title: 수료생 증명서·본인 사진 인증 화면 계약
type: product-contract
status: current
authority: normative
---

# 수료생 증명서·본인 사진 인증 화면 계약

작성 기준일: 2026-09-05
범위: 수료생 이메일 계정, 교육이수증 검토, 본인 사진 검토·교체

## 공통 정책

- 수료생은 외부 Verify 없이 이메일 인증과 교육이수증으로 신청한다.
- 1학기·2학기 교육이수증은 같은 수료생 혜택 자격을 만든다.
- 기수는 SSAFY 반기 경계를 이용해 현재 선택 가능 상한을 계산하고, 신청자가 그 범위 안의 기수를 직접 선택한다.
- 본인 사진은 신청에 필수다. 관리자는 신원 확인이나 얼굴 인식을 하지 않고, 인증 카드 사진으로 적합한지만 판단한다.
- 수료증과 사진은 private Storage에만 보관한다. 사진은 본인 인증 화면과 유효한 QR 검증에서만 서버 스트리밍으로 제공한다.
- 실제 수료증·얼굴 사진은 Story, 테스트, 저장소의 public URL에 포함하지 않는다.

## 기수 선택 계약

규칙 버전은 `ssafy-half-year-v1`이다.

`getGraduateGenerationOptions(now)`는 2019년 1월 1기, 7월 2기(2018년 12월은 1기) 경계로 현재 기수를 계산하고 `1..현재 기수` 정수를 최신순으로 반환한다. 새 신청은 기본값 없이 선택한다. 클라이언트와 서버는 `validateGraduateEducationDetails()`로 이름(1~100자), 정수 기수, 캠퍼스 목록을 함께 검증한다.

<!-- screen-contract: auth.signup -->

## `/auth/signup` — 회원가입 유형 선택

| 항목 | 계약 |
| --- | --- |
| routeKind | canonical |
| 사용자 목표 | 본인 자격에 맞는 가입 경로를 선택한다. |
| 정보 우선순위 | 운영진·재학생 Mattermost DM 코드 경로 → 수료생 신규 가입 → 기존 회원 복구 |
| 주 액션 | 활성 탭의 `Mattermost 인증 시작` 또는 수료생 선택 버튼 |
| 보조 액션 | `기존 회원 복구 신청`으로 이동 |
| 권한·데이터 | 비로그인 공개 화면. Sender credential은 브라우저에 전달하지 않는다. |
| 상태 | 기본, 안전한 Mattermost 발송 오류, returnTo 보존 |
| 반응형 | 320px부터 두 탭이 동일 폭을 유지하고 줄바꿈 없이 읽힌다. |
| 분석 | `signup_type_selected` `{ type: student_staff | graduate }` |
| 수용 기준 | 수료생 신규 가입은 `/auth/signup/graduate`, 기존 회원 복구는 `/auth/signup/graduate?kind=recovery`로 이동하며 직접 MM 코드 외의 Verify를 호출하지 않는다. |

<!-- screen-contract: auth.graduate-verification -->

## `/auth/signup/graduate` — 수료생 인증 신청

| 항목 | 계약 |
| --- | --- |
| routeKind | canonical |
| 사용자 목표 | 이메일을 증명하고 이름·기수·캠퍼스·수료증·본인 사진을 제출해 신규 가입 또는 기존 회원 복구를 신청한다. |
| 정보 우선순위 | 이메일 인증 → 교육 정보(이름·기수·캠퍼스) → 요청된 파일 → 개인정보·사진 이용 동의 |
| 주 액션 | `수료생 인증 제출` 또는 `보완 제출` |
| 보조 액션 | 이메일 인증 코드 재발송, 파일 선택·1:1 크롭, 제출 전 이전 단계 이동, 제출 후 철회 |
| 진입·이탈 | `/auth/signup`의 수료생 탭에서 신규 가입 또는 기존 회원 복구로 진입한다. 복구 승인은 관리자가 기존 회원 ID를 명시 선택한 뒤에만 이메일 설정 링크를 보낸다. |
| 권한·데이터 | 비로그인. HttpOnly의 짧은 이메일 인증 세션만 신청 API에 전달한다. 파일의 영구 Storage 경로를 UI에 반환하지 않는다. |
| 기본 상태 | 3단계 이메일 인증/교육 정보/파일 제출. 현재 단계는 번호와 `aria-current="step"`, 완료 단계는 체크와 완료 텍스트로 구분한다. 제출 후에는 입력 단계 표시를 숨기고 검토 상태를 안내한다. 기수는 기본값 없이 선택하며 첫 오류 필드로 초점을 이동한다. |
| 오류 상태 | 6자리 코드 만료·횟수 초과, 이름·기수·캠퍼스 오류, PDF·사진 제약 오류, 동의 누락, 업로드 만료, 이미 열린 신청 |
| 도메인 상태 | `needs_resubmission`은 교육 정보·수료증·사진 중 요청 항목만 다시 받는다. 파일만 보완할 때 이름·캠퍼스·기수는 잠기며, 교육 정보 보완일 때만 기수를 수정할 수 있다. `submitted`은 검토 대기로 표시하며 철회 가능하다. `in_review`는 철회 버튼을 숨긴다. |
| 반응형 | 페이지 wrapper가 최대 640px 너비를 소유하며 공용 Card의 최대 너비와 충돌하지 않는다. 320px부터 번호·연결선과 짧은 단계 이름을 3열로 읽을 수 있어야 한다. 이메일 단계 주 액션은 입력창과 같은 너비이고, 이후 단계는 이전 버튼 옆의 남은 폭을 주 액션이 사용한다. 파일 card의 선택 버튼은 좁은 화면에서 다음 행으로 내려가며 파일명은 영역 안에서 줄바꿈한다. |
| 분석 | `graduate_email_code_sent`, `graduate_email_verified`, `graduate_files_uploaded`, `graduate_verification_submitted`, `graduate_verification_withdrawn` |
| 수용 기준 | 서버가 현재 기수 범위의 정수 선택값을 검증하고, 수료증과 사진 모두 서버 검증에 성공하기 전에는 `submitted`가 되지 않는다. 복구 종류의 승인 RPC는 새 `members` 행을 만들지 않는다. |

### 복구 신청의 정보 위계

- 첫 화면은 `기존 회원 복구`와 짧은 검토 안내를 보여준다. 영문 분류 라벨이나 관리자의 회원 연결 절차를 사용자 안내로 반복하지 않는다.
- 현재 단계의 행동형 제목과 입력을 우선한다. 파일 안내는 해당 파일 제출 단계에서 제공한다.
- 주 액션은 단계에 따라 `인증 코드 보내기`, `이메일 인증하기`, `다음`, `복구 신청 제출`로 구분한다. 코드 재발송과 이전 이동은 보조 액션이다.
- 단계 표시의 첫 항목과 마지막 항목은 입력 영역 양 끝에 맞추고, 연결선이 남은 너비를 채운다. 3단계의 짧은 이름이 320px에도 한 줄씩 들어가므로 별도 전체 단계 disclosure 없이 진행 순서를 항상 표시한다.

### Storybook 가입·복구 기수 계약

- `EducationDetails`, `FileSubmission`, `CohortRequired` 및 복구 대응 Storybook은 실제 generation-only 화면 계약을 사용한다.
- `EducationInfoResubmission`은 기수 수정 가능 상태를, `FileOnlyResubmissionLocksEducation`은 서버와 동일한 잠금 UI 상태를 보인다. Storybook의 신청 API 요청은 mock으로 가로챈다.

<!-- screen-contract: auth.graduate-password-setup -->

## `/auth/graduate/setup` — 비밀번호 설정

| 항목 | 계약 |
| --- | --- |
| routeKind | conditional |
| 사용자 목표 | 승인 또는 이메일 재설정 링크의 단기 토큰으로 비밀번호를 설정한다. |
| 주 액션 | `비밀번호 설정 완료` |
| 권한·데이터 | 이메일 링크의 fragment에서만 단기 토큰을 읽고 즉시 주소에서 제거한다. 토큰은 same-origin 요청 본문으로 한 번만 제출하며, DB에는 해시만 저장한다. |
| 상태 | 기본, 비밀번호 정책 오류, 만료/사용됨, 완료 후 `/certification` 이동 |
| 수용 기준 | 토큰은 사용 후 재사용할 수 없고, 성공 시에만 회원 세션을 만든다. |

<!-- screen-contract: member.certification-photo -->

## `/certification/photo` — 본인 사진 교체

| 항목 | 계약 |
| --- | --- |
| routeKind | canonical |
| 사용자 목표 | 인증 카드에 표시할 본인 사진을 교체 신청한다. |
| 주 액션 | `사진 변경 요청` |
| 권한·데이터 | 로그인한 `graduate_verified_at` 회원만 접근한다. 새 사진은 short-lived private upload 후 서버가 WebP로 재인코딩한다. |
| 상태 | 업로드 전, 크롭, 업로드 중, 형식/크기 오류, 검토 대기, 반려 안내 |
| 반응형 | 360px에서 미리보기·선택·제출 버튼은 줄바꿈을 허용하되 touch target 44px 이상을 유지한다. |
| 분석 | `graduate_profile_photo_change_requested` |
| 수용 기준 | 검토 중·반려 중에는 기존 승인 사진이 계속 표시되고, 승인 순간에만 활성 사진이 교체된다. |

<!-- screen-contract: admin.graduate-verifications -->

## `/admin/graduate-verifications` — 수료생 인증 검토

| 항목 | 계약 |
| --- | --- |
| routeKind | canonical |
| 사용자 목표 | 신규 수료생 인증, 기존 회원 복구, 사진 변경을 안전하게 검토·결정한다. |
| 정보 우선순위 | 신규 인증 큐 → 수료증/사진 열람 → 보완·승인·반려 → 비밀번호 설정 메일 재발송 → 사진 변경 큐 |
| 주 액션 | 신규 인증은 `승인 및 비밀번호 설정 메일`, 기존 회원 복구는 기존 회원 ID 선택 후 `기존 회원 연결 및 설정 메일`, 사진 교체는 `사진 교체 승인` |
| 보조 액션 | 검토 시작, 수료증·사진 private viewer, 보완 요청, 반려, 아직 비밀번호를 설정하지 않은 승인 건의 설정 메일 재발송 |
| 권한·데이터 | `graduate_verifications.read/update` 권한이 필요하다. private 파일 viewer는 권한 검증 후 `no-store`로 응답한다. 감사 로그는 식별자·결정만 저장하고 이메일·문서번호·경로·signed URL을 저장하지 않는다. |
| 상태 | 신규/검토 중/보완 요청/빈 큐/메일 발송 실패 표시. 사진 변경 큐는 신규 인증과 분리한다. |
| 반응형 | 820px 미만에서 파일 viewer action과 결정 form을 한 열로 쌓고 긴 이름·이메일은 break-all 하지 않고 truncate+title 처리한다. |
| 분석 | `graduate_verification_review_start`, `graduate_verification_resubmission_request`, `graduate_verification_approve`, `graduate_verification_reject`, `graduate_profile_photo_approve`, `graduate_profile_photo_reject` |
| 수용 기준 | 신규 가입 승인 RPC는 회원·email identity·승인 사진·활성 사진·설정 토큰을 한 트랜잭션으로 생성한다. 기존 회원 복구는 선택한 기존 회원에만 이를 연결하고 새 회원 행을 만들지 않는다. |

## 인증 카드·QR 사진 노출

- 본인 인증 카드의 사진 URL은 `/api/certification/profile-image`뿐이며 로그인 세션과 활성 승인 이미지가 모두 필요하다.
- QR 검증 화면은 만료되지 않은 QR 토큰을 확인한 뒤 `/api/certification/avatar/[token]`에서 사진을 스트리밍한다.
- 두 응답은 `Cache-Control: private, no-store`와 `X-Content-Type-Options: nosniff`를 갖는다.
- MM 회원은 기존 아바타 경로를 유지하며, 수료생 private 사진을 public avatar URL로 변환하지 않는다.
