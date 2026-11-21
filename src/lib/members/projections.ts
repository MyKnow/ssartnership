/**
 * `members` 테이블의 반복 SELECT 프로젝션과 대응 Row 타입.
 *
 * 컬럼을 추가·이름 변경할 때 이 파일과 사용처만 확인하면 되도록 같은 모양의
 * 조회는 여기 상수를 쓴다. members Repository를 대체하지 않으며, Row는
 * 저장소 경계 안에서만 쓰고 화면에는 도메인 모델로 매핑해 넘긴다.
 */

/** 알림 대상·이벤트 후보처럼 회원 식별과 MM 디렉터리 연결에 필요한 최소 컬럼 */
export const MEMBER_IDENTITY_SELECT =
  "id,display_name,mattermost_account_id,generation,campus" as const;

export type MemberIdentityRow = {
  id: string;
  display_name: string | null;
  mattermost_account_id: string | null;
  generation: number | null;
  campus: string | null;
};

/** 개인 발송 대상 확인처럼 이름과 MM 디렉터리 연결만 필요한 조회 */
export const MEMBER_DIRECTORY_LINK_SELECT =
  "id,display_name,mattermost_account_id" as const;

export type MemberDirectoryLinkRow = Pick<
  MemberIdentityRow,
  "id" | "display_name" | "mattermost_account_id"
>;

/** 이벤트 보상 후보: 식별 컬럼 + 가입 시각 */
export const MEMBER_EVENT_CANDIDATE_SELECT =
  "id,display_name,mattermost_account_id,generation,campus,created_at" as const;

export type MemberEventCandidateRow = MemberIdentityRow & {
  created_at: string | null;
};

/** 관리자 통합 검색 결과 */
export const MEMBER_SEARCH_SELECT =
  "id,display_name,manual_login_id,generation,campus" as const;

export type MemberSearchRow = {
  id: string;
  display_name: string | null;
  manual_login_id: string | null;
  generation: number | null;
  campus: string | null;
};

/** 알림 템플릿 테스트 수신자 */
export const MEMBER_TEMPLATE_TEST_RECIPIENT_SELECT =
  "id,display_name,email,generation,staff_source_generation,mattermost_account_id,deleted_at" as const;

export type MemberTemplateTestRecipientRow = {
  id: string;
  display_name: string | null;
  email: string | null;
  generation: number | null;
  staff_source_generation: number | null;
  mattermost_account_id: string | null;
  deleted_at: string | null;
};

/** 회원 로그인 검증(비밀번호·이메일 인증·MM 로그인 차단 상태) */
export const MEMBER_LOGIN_SELECT =
  "id,password_hash,password_salt,must_change_password,email_verified_at,mattermost_login_disabled_at" as const;

/** 이메일 복구 로그인: 로그인 검증 컬럼 + 세션 버전 */
export const MEMBER_EMAIL_RECOVERY_SELECT =
  `${MEMBER_LOGIN_SELECT},auth_session_version` as const;
