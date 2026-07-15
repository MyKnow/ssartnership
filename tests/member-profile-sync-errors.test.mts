import assert from "node:assert/strict";
import test from "node:test";

type FailureModule = typeof import("../src/lib/member-profile-sync-errors.ts");
type ServerApiModule = typeof import("../src/lib/ssafy-verify/server-api.ts");
type AdminActionErrorsModule = typeof import("../src/lib/admin-action-errors.ts");

const failureModulePromise = import(
  new URL("../src/lib/member-profile-sync-errors.ts", import.meta.url).href,
) as Promise<FailureModule>;
const serverApiModulePromise = import(
  new URL("../src/lib/ssafy-verify/server-api.ts", import.meta.url).href,
) as Promise<ServerApiModule>;
const adminActionErrorsModulePromise = import(
  new URL("../src/lib/admin-action-errors.ts", import.meta.url).href,
) as Promise<AdminActionErrorsModule>;

test("MM 프로필 동기화 실패를 운영자가 조치 가능한 안전한 사유로 분류한다", async () => {
  const [failureModule, serverApiModule] = await Promise.all([
    failureModulePromise,
    serverApiModulePromise,
  ]);

  const { MemberProfileSyncError, getMemberProfileSyncFailureCode } = failureModule;
  const { SsafyVerifyServerApiError } = serverApiModule;

  assert.equal(
    getMemberProfileSyncFailureCode(
      new SsafyVerifyServerApiError({
        status: 403,
        errorCode: "FORBIDDEN",
        message: "scope missing",
      }),
    ),
    "member_sync_provider_access_denied",
  );
  assert.equal(
    getMemberProfileSyncFailureCode(
      new SsafyVerifyServerApiError({
        status: 429,
        errorCode: "RATE_LIMITED",
        message: "too many requests",
      }),
    ),
    "member_sync_provider_rate_limited",
  );
  assert.equal(
    getMemberProfileSyncFailureCode(
      new SsafyVerifyServerApiError({
        status: 502,
        errorCode: "VERIFY_SERVER_API_INVALID_RESPONSE",
        message: "invalid response",
      }),
    ),
    "member_sync_provider_invalid_response",
  );
  assert.equal(
    getMemberProfileSyncFailureCode(
      new MemberProfileSyncError("identity_mismatch"),
    ),
    "member_sync_identity_mismatch",
  );
  assert.equal(
    getMemberProfileSyncFailureCode(
      new MemberProfileSyncError("profile_image_failed"),
    ),
    "member_sync_profile_image_failed",
  );
  assert.equal(
    getMemberProfileSyncFailureCode(new Error("unexpected")),
    "member_sync_failed",
  );
});

test("노출되는 동기화 실패 문구는 원인과 다음 조치를 안내한다", async () => {
  const { adminActionErrorMessages } = await adminActionErrorsModulePromise;

  assert.match(
    adminActionErrorMessages.member_sync_provider_access_denied,
    /SSAFY Verify.*권한|권한.*SSAFY Verify/,
  );
  assert.match(
    adminActionErrorMessages.member_sync_identity_mismatch,
    /MM user ID|자동 연결하지 않았습니다/,
  );
  assert.match(
    adminActionErrorMessages.member_sync_profile_image_failed,
    /프로필 사진/,
  );
});
