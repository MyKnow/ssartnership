import assert from "node:assert/strict";
import test from "node:test";

type FailureModule = typeof import("../src/lib/member-profile-sync-errors.ts");
type MattermostClientModule = typeof import("../src/lib/mattermost/client.ts");
type SenderServiceModule = typeof import("../src/lib/mattermost-senders/service.ts");
type AdminActionErrorsModule = typeof import("../src/lib/admin-action-errors.ts");
type SnapshotModule = typeof import("../src/lib/mm-member-sync/snapshot.ts");

const failureModulePromise = import(
  new URL("../src/lib/member-profile-sync-errors.ts", import.meta.url).href,
) as Promise<FailureModule>;
const mattermostClientModulePromise = import(
  new URL("../src/lib/mattermost/client.ts", import.meta.url).href,
) as Promise<MattermostClientModule>;
const senderServiceModulePromise = import(
  new URL("../src/lib/mattermost-senders/service.ts", import.meta.url).href,
) as Promise<SenderServiceModule>;
const adminActionErrorsModulePromise = import(
  new URL("../src/lib/admin-action-errors.ts", import.meta.url).href,
) as Promise<AdminActionErrorsModule>;
const snapshotModulePromise = import(
  new URL("../src/lib/mm-member-sync/snapshot.ts", import.meta.url).href,
) as Promise<SnapshotModule>;

test("단건 MM 프로필 동기화는 직접 Mattermost 사용자·사진 응답만 반영한다", async () => {
  const { fetchMemberSnapshotByUserId } = await snapshotModulePromise;
  const session = {
    getUserById: async () => ({
      id: "mm.user-123",
      username: "student.name",
      nickname: "김싸피",
      firstName: "ignored",
      lastName: "ignored",
      deleteAt: 0,
    }),
    getUserImage: async () => ({
      contentType: "image/png",
      bytes: Buffer.from("image"),
    }),
  };

  const { snapshot } = await fetchMemberSnapshotByUserId("mm.user-123", session as never);

  assert.deepEqual(snapshot, {
    mmUserId: "mm.user-123",
    mmUsername: "student.name",
    displayName: "김싸피",
    campus: null,
    track: null,
    trackName: null,
    avatarFetched: true,
    avatarUrl: null,
    avatarContentType: "image/png",
    avatarBase64: Buffer.from("image").toString("base64"),
  });
});

test("단건 MM 프로필 동기화는 다른 MM user id를 받은 응답을 연결하지 않는다", async () => {
  const { fetchMemberSnapshotByUserId } = await snapshotModulePromise;
  const session = {
    getUserById: async () => ({
      id: "mm.other-456",
      username: "other.member",
      nickname: "",
      firstName: "",
      lastName: "",
      deleteAt: 0,
    }),
    getUserImage: async () => ({
      contentType: "image/png",
      bytes: Buffer.from("image"),
    }),
  };

  await assert.rejects(
    () => fetchMemberSnapshotByUserId("mm.user-123", session as never),
    { name: "MemberProfileSyncError", code: "identity_mismatch" },
  );
});

test("MM 프로필 동기화 실패를 운영자가 조치 가능한 안전한 사유로 분류한다", async () => {
  const [failureModule, mattermostClientModule, senderServiceModule] = await Promise.all([
    failureModulePromise,
    mattermostClientModulePromise,
    senderServiceModulePromise,
  ]);

  const { MemberProfileSyncError, getMemberProfileSyncFailureCode } = failureModule;
  const { MattermostApiError } = mattermostClientModule;
  const { MattermostSenderUnavailableError } = senderServiceModule;

  assert.equal(
    getMemberProfileSyncFailureCode(new MattermostApiError("forbidden", 403)),
    "member_sync_provider_access_denied",
  );
  assert.equal(
    getMemberProfileSyncFailureCode(new MattermostApiError("rate_limited", 429)),
    "member_sync_provider_rate_limited",
  );
  assert.equal(
    getMemberProfileSyncFailureCode(new MattermostApiError("not_found", 404)),
    "member_sync_provider_not_found",
  );
  assert.equal(
    getMemberProfileSyncFailureCode(new MattermostApiError("invalid_response")),
    "member_sync_provider_invalid_response",
  );
  assert.equal(
    getMemberProfileSyncFailureCode(new MattermostSenderUnavailableError("sender_not_configured")),
    "member_sync_sender_not_configured",
  );
  assert.equal(
    getMemberProfileSyncFailureCode(new MemberProfileSyncError("identity_mismatch")),
    "member_sync_identity_mismatch",
  );
  assert.equal(
    getMemberProfileSyncFailureCode(new MemberProfileSyncError("profile_image_failed")),
    "member_sync_profile_image_failed",
  );
  assert.equal(getMemberProfileSyncFailureCode(new Error("unexpected")), "member_sync_failed");
});

test("노출되는 동기화 실패 문구는 Mattermost 상태와 무전환 원칙을 안내한다", async () => {
  const { adminActionErrorMessages } = await adminActionErrorsModulePromise;

  assert.match(
    adminActionErrorMessages.member_sync_provider_access_denied,
    /Mattermost Sender.*권한|권한.*Mattermost Sender/,
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
