import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const approvalModulePromise = import(
  new URL("../src/lib/mm-signup-approval.ts", import.meta.url).href,
);

test("Mattermost 닉네임 파싱 성공은 기존 직접 가입 모드로 분류한다", async () => {
  const {
    classifyMattermostSignupProfile,
    getMattermostSignupDisplayName,
  } = await approvalModulePromise;

  const result = classifyMattermostSignupProfile({
    id: "mm-user-1",
    username: "ssafy-user",
    nickname: "김싸피[서울]팀원",
    firstName: "",
    lastName: "",
  });

  assert.equal(result.mode, "direct");
  assert.equal(result.profile.parsedName, "김싸피");
  assert.equal(result.profile.campus, "서울");
  assert.equal(result.profile.parsedExclusionReason, undefined);
  assert.equal(
    getMattermostSignupDisplayName({
      id: "mm-user-1",
      username: "ssafy-user",
      nickname: "정민호[서울_6반_A602]팀원",
      firstName: "",
      lastName: "",
    }),
    "정민호",
  );
});

test("닉네임을 파싱할 수 없으면 승인 대기 모드로 분류하고 안전한 사유만 반환한다", async () => {
  const { classifyMattermostSignupProfile } = await approvalModulePromise;

  const result = classifyMattermostSignupProfile({
    id: "mm-user-2",
    username: "myknow",
    nickname: "myknow",
    firstName: "",
    lastName: "",
  });

  assert.equal(result.mode, "approval");
  assert.equal(result.profile.parseModeCandidateMatch, false);
  assert.equal(result.profile.parsedExclusionReason, "display_name_not_person_like");
});

test("운영진은 캠퍼스 없이 승인 정보를 완성할 수 있다", async () => {
  const { parseMattermostSignupApprovalDecision } = await approvalModulePromise;

  const result = parseMattermostSignupApprovalDecision({
    displayName: "김운영",
    generation: "0",
    campus: "",
  });

  assert.deepStrictEqual(result, {
    ok: true,
    value: {
      displayName: "김운영",
      generation: 0,
      campus: null,
    },
  });
});

test("교육생 승인은 유효한 캠퍼스를 반드시 선택해야 한다", async () => {
  const { parseMattermostSignupApprovalDecision } = await approvalModulePromise;

  const result = parseMattermostSignupApprovalDecision({
    displayName: "김싸피",
    generation: "15",
    campus: "알 수 없는 캠퍼스",
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.fieldErrors.campus, "캠퍼스를 선택해 주세요.");
  }
});

test("승인 요청 목록 DTO에는 비밀번호 material이 포함되지 않는다", async () => {
  const { toSafeMattermostSignupApprovalRequest } = await approvalModulePromise;

  const result = toSafeMattermostSignupApprovalRequest({
    id: "request-1",
    mm_user_id: "mm-user-1",
    mm_username: "myknow",
    mattermost_display_name: "myknow",
    sender_generation: 15,
    requested_generation: 15,
    parse_exclusion_reason: "display_name_not_person_like",
    status: "pending",
    marketing_policy_checked: false,
    consent_agreed_at: "2026-07-17T00:00:00.000Z",
    created_at: "2026-07-17T00:00:00.000Z",
    updated_at: "2026-07-17T00:00:00.000Z",
    password_hash: "must-not-leak",
    password_salt: "must-not-leak",
  });

  assert.equal("password_hash" in result, false);
  assert.equal("password_salt" in result, false);
  assert.equal("profileImageUploadId" in result, false);
  assert.equal("hasProfileImage" in result, false);
  assert.equal(result.mmUsername, "myknow");
});

test("승인 요청 DB 계약은 RLS·Super Admin RPC·credential 삭제 규칙을 포함한다", async () => {
  const migration = await readFile(
    new URL(
      "../supabase/migrations/20260717180051_add_mm_signup_approval_requests.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const signupImageMigration = await readFile(
    new URL(
      "../supabase/migrations/20260719134505_add_signup_image_upload_policy.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(migration, /alter table public\.member_signup_approval_requests enable row level security/);
  assert.match(migration, /revoke all on table public\.member_signup_approval_requests from anon/);
  assert.match(migration, /grant execute on function public\.approve_member_signup_approval_request/);
  assert.match(migration, /grant execute on function public\.reject_member_signup_approval_request/);
  assert.match(migration, /password_hash = null/);
  assert.match(migration, /old\.status = 'pending' and new\.status in \('approved', 'rejected'\)/);
  assert.match(migration, /profile\.permission_template_key = 'super_admin'/);
  assert.match(signupImageMigration, /profile_image_upload_id uuid/);
  assert.match(signupImageMigration, /expires_at timestamp with time zone/);
  assert.match(signupImageMigration, /approval_timeout/);
  assert.match(signupImageMigration, /expires_at <= p_now/);
});

test("신규 가입 이미지 권한은 별도 owner kind와 7일 승인 TTL을 사용한다", async () => {
  const [repository, supabaseRepository, signupPolicy] = await Promise.all([
    readFile(
      new URL("../src/lib/image-upload/repository.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/lib/image-upload/repository.supabase.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/lib/image-upload/signup.ts", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(repository, /\| "signup"/);
  assert.match(supabaseRepository, /isUuid\(input\.actor\.id\)/);
  assert.match(signupPolicy, /SIGNUP_APPROVAL_TTL_MS = 7 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(signupPolicy, /member-signup-profile/);
});

test("승인 이후 signup 브라우저가 완료 API로 업로드를 다시 조회하지 못한다", async () => {
  const repository = await readFile(
    new URL("../src/lib/image-upload/repository.supabase.ts", import.meta.url),
    "utf8",
  );

  assert.match(
    repository,
    /session\.status === "attached" && input\.purpose === "member-signup-profile"/,
  );
  assert.match(
    repository,
    /latest\.status === "attached" && input\.purpose === "member-signup-profile"/,
  );
});

test("실패한 업로드 정리는 signed URL 만료 시각도 함께 닫는다", async () => {
  const repository = await readFile(
    new URL("../src/lib/image-upload/repository.supabase.ts", import.meta.url),
    "utf8",
  );

  assert.match(
    repository,
    /failure_code: "discard_cleanup_pending",\s+signed_url_expires_at: now\.toISOString\(\),\s+expires_at: now\.toISOString\(\)/,
  );
  assert.match(
    repository,
    /status: "expired",\s+failure_code: null,\s+signed_url_expires_at: now\.toISOString\(\),\s+expires_at: now\.toISOString\(\)/,
  );
  assert.match(repository, /markFailed\(supabase, claimedSession\.id, "attach_failed", \["attaching"\]\)/);
});

test("가입 API는 승인 모드에서 회원 세션을 발급하지 않고 대기 페이지로 보낸다", async () => {
  const route = await readFile(
    new URL("../src/app/api/mm/signup/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(route, /createMattermostSignupApprovalRequest/);
  assert.match(route, /redirectTo: "\/auth\/signup\/pending"/);
  assert.match(route, /approvalMode/);
  assert.doesNotMatch(route, /properties:\s*\{[^}]*password/i);
});

test("가입 인증 세션은 Mattermost ID가 아닌 랜덤 signup owner UUID를 만든다", async () => {
  const [verifyRoute, sessionModule] = await Promise.all([
    readFile(
      new URL("../src/app/api/mm/code/verify/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/lib/mattermost-code-session.ts", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(verifyRoute, /signupUploadOwnerId: randomUUID\(\)/);
  assert.match(sessionModule, /isUuid\(String\(payload\.signupUploadOwnerId/);
  assert.match(sessionModule, /isUuid\(session\.signupUploadOwnerId \?\? ""\)/);
});
