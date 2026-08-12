import assert from "node:assert/strict";
import test from "node:test";
import { MOCK_MEMBER_ID } from "../src/lib/mock/member.ts";
import { MockWalletPassRepository } from "../src/lib/repositories/mock/wallet-pass-repository.mock.ts";

function createIssueInput(overrides: Partial<Parameters<MockWalletPassRepository["issueMemberWalletPass"]>[0]> = {}) {
  return {
    memberId: MOCK_MEMBER_ID,
    platform: "apple" as const,
    consentVersion: 3,
    consentedAt: "2026-08-11T00:00:00.000Z",
    snapshotHash: "snapshot-hash-v1",
    snapshot: {
      displayName: "정민호",
      generationLabel: "15기",
      campusLabel: "서울 캠퍼스",
      roleLabel: "교육생",
    },
    idempotencyKey: "wallet-pass-issue-key-0001",
    requestFingerprint: "wallet-pass-issue-fingerprint-0001",
    ...overrides,
  };
}

test("wallet pass issue creates an active pass and immutable first revision", async () => {
  const repository = new MockWalletPassRepository();

  const result = await repository.issueMemberWalletPass(createIssueInput());

  assert.equal(result.isNewPass, true);
  assert.equal(result.isNewRevision, true);
  assert.equal(result.pass.credentialStatus, "active");
  assert.equal(result.pass.installationStatus, "pending");
  assert.equal(result.pass.currentRevision, 1);
  assert.equal(result.revision.revision, 1);
  assert.equal(result.revision.snapshotHash, "snapshot-hash-v1");
  assert.equal(result.pass.publicId.length, 43);
  assert.equal(result.pass.serialNumber, `sp-${result.pass.publicId}`);
});

test("wallet pass issue replays the same result for an idempotent retry", async () => {
  const repository = new MockWalletPassRepository();
  const input = createIssueInput();

  const first = await repository.issueMemberWalletPass(input);
  const retry = await repository.issueMemberWalletPass(input);

  assert.equal(retry.pass.id, first.pass.id);
  assert.equal(retry.revision.id, first.revision.id);
  assert.equal(retry.operationCreated, false);
  assert.equal(retry.isNewPass, false);
  assert.equal(retry.isNewRevision, false);
});

test("wallet pass issue increments the revision when the snapshot changes", async () => {
  const repository = new MockWalletPassRepository();

  const first = await repository.issueMemberWalletPass(createIssueInput());
  const second = await repository.issueMemberWalletPass(
    createIssueInput({
      snapshotHash: "snapshot-hash-v2",
      snapshot: {
        displayName: "정민호",
        generationLabel: "15기",
        campusLabel: "서울 캠퍼스",
        roleLabel: "운영진",
      },
      idempotencyKey: "wallet-pass-issue-key-0002",
      requestFingerprint: "wallet-pass-issue-fingerprint-0002",
    }),
  );

  assert.equal(second.pass.id, first.pass.id);
  assert.equal(second.isNewPass, false);
  assert.equal(second.isNewRevision, true);
  assert.equal(second.pass.currentRevision, 2);
  assert.equal(second.revision.revision, 2);
});

test("wallet pass issue rejects snapshots outside the public four-field contract", async () => {
  const repository = new MockWalletPassRepository();

  await assert.rejects(
    repository.issueMemberWalletPass(
      createIssueInput({
        snapshot: {
          displayName: "정민호",
          generationLabel: "15기",
          campusLabel: "서울 캠퍼스",
          roleLabel: "교육생",
          email: "member@example.com",
        },
      }),
    ),
    /member_wallet_pass_snapshot_invalid/,
  );
});

test("wallet pass revoke preserves the old row and reissue creates a new credential row", async () => {
  const repository = new MockWalletPassRepository();

  const issued = await repository.issueMemberWalletPass(createIssueInput());
  const revoked = await repository.revokeMemberWalletPass({
    memberId: MOCK_MEMBER_ID,
    platform: "apple",
    idempotencyKey: "wallet-pass-revoke-key-0001",
    requestFingerprint: "wallet-pass-revoke-fingerprint-0001",
    reason: "member_requested",
  });
  const reissued = await repository.issueMemberWalletPass(
    createIssueInput({
      idempotencyKey: "wallet-pass-issue-key-0003",
      requestFingerprint: "wallet-pass-issue-fingerprint-0003",
      snapshotHash: "snapshot-hash-v3",
    }),
  );

  assert.equal(revoked.pass.id, issued.pass.id);
  assert.equal(revoked.pass.credentialStatus, "revoked");
  assert.notEqual(reissued.pass.id, issued.pass.id);
  assert.equal(reissued.pass.credentialStatus, "active");
  assert.equal(reissued.isNewPass, true);
});

test("wallet pass register and unregister device transitions installation state", async () => {
  const repository = new MockWalletPassRepository();
  const issued = await repository.issueMemberWalletPass(createIssueInput());

  const registered = await repository.registerAppleWalletDevice({
    publicId: issued.pass.publicId,
    deviceLibraryIdentifierHash: "device-library-hash-0001",
    pushTokenCiphertext: "ciphertext-1",
    pushTokenIv: "iv-1",
    pushTokenAuthTag: "tag-1",
    pushTokenKeyVersion: 1,
  });
  assert.equal(registered.isNewRegistration, true);
  assert.equal(registered.pass.installationStatus, "installed");

  const unregistered = await repository.unregisterAppleWalletDevice({
    publicId: issued.pass.publicId,
    deviceLibraryIdentifierHash: "device-library-hash-0001",
  });
  assert.equal(unregistered.removed, true);
  assert.equal(unregistered.pass.installationStatus, "removed");
});

test("wallet pass revoke keeps observed installation state until Apple unregisters", async () => {
  const repository = new MockWalletPassRepository();
  const issued = await repository.issueMemberWalletPass(createIssueInput());
  await repository.registerAppleWalletDevice({
    publicId: issued.pass.publicId,
    deviceLibraryIdentifierHash: "device-library-hash-revoke",
    pushTokenCiphertext: "ciphertext-revoke",
    pushTokenIv: "iv-revoke",
    pushTokenAuthTag: "tag-revoke",
    pushTokenKeyVersion: 1,
  });

  const revoked = await repository.revokeMemberWalletPass({
    memberId: MOCK_MEMBER_ID,
    platform: "apple",
    idempotencyKey: "wallet-pass-revoke-key-install-state",
    requestFingerprint: "wallet-pass-revoke-fingerprint-install-state",
    reason: "member_requested",
  });

  assert.equal(revoked.pass.credentialStatus, "revoked");
  assert.equal(revoked.pass.installationStatus, "installed");
});

test("wallet pass listUpdated returns updated passes with active device registrations only", async () => {
  const repository = new MockWalletPassRepository();
  const issued = await repository.issueMemberWalletPass(createIssueInput());
  await repository.registerAppleWalletDevice({
    publicId: issued.pass.publicId,
    deviceLibraryIdentifierHash: "device-library-hash-0001",
    pushTokenCiphertext: "ciphertext-1",
    pushTokenIv: "iv-1",
    pushTokenAuthTag: "tag-1",
    pushTokenKeyVersion: 1,
  });

  const updated = await repository.listUpdatedAppleWalletPasses({
    deviceLibraryIdentifierHash: "device-library-hash-0001",
    updatedSince: "2026-08-10T00:00:00.000Z",
    limit: 10,
  });

  assert.equal(updated.length, 1);
  assert.equal(updated[0]?.pass.id, issued.pass.id);
  assert.equal(updated[0]?.registrations.length, 1);
});

test("wallet pass listing only returns the requested device registration scope", async () => {
  const repository = new MockWalletPassRepository();
  const issued = await repository.issueMemberWalletPass(createIssueInput());
  await repository.registerAppleWalletDevice({
    publicId: issued.pass.publicId,
    deviceLibraryIdentifierHash: "device-library-hash-0001",
    pushTokenCiphertext: "ciphertext-1",
    pushTokenIv: "iv-1",
    pushTokenAuthTag: "tag-1",
    pushTokenKeyVersion: 1,
  });
  await repository.registerAppleWalletDevice({
    publicId: issued.pass.publicId,
    deviceLibraryIdentifierHash: "device-library-hash-0002",
    pushTokenCiphertext: "ciphertext-2",
    pushTokenIv: "iv-2",
    pushTokenAuthTag: "tag-2",
    pushTokenKeyVersion: 1,
  });

  const updated = await repository.listUpdatedAppleWalletPasses({
    deviceLibraryIdentifierHash: "device-library-hash-0002",
    updatedSince: null,
    limit: 10,
  });

  assert.equal(updated.length, 1);
  assert.equal(updated[0]?.registrations.length, 1);
  assert.equal(
    updated[0]?.registrations[0]?.deviceLibraryIdentifierHash,
    "device-library-hash-0002",
  );
});

test("wallet pass repository exposes lookups and sync status updates", async () => {
  const repository = new MockWalletPassRepository();
  const issued = await repository.issueMemberWalletPass(createIssueInput());

  const byPublicId = await repository.getWalletPassByPublicId(issued.pass.publicId);
  const bySerial = await repository.getAppleWalletPassBySerialNumber(
    issued.pass.serialNumber,
  );
  const synced = await repository.markWalletPassSyncSuccess({
    passId: issued.pass.id,
    syncedAt: "2026-08-11T01:00:00.000Z",
  });
  const failed = await repository.markWalletPassSyncFailure({
    passId: issued.pass.id,
    safeErrorCode: "push_delivery_failed",
    attemptedAt: "2026-08-11T02:00:00.000Z",
  });

  assert.equal(byPublicId?.id, issued.pass.id);
  assert.equal(bySerial?.id, issued.pass.id);
  assert.equal(synced.syncStatus, "synced");
  assert.equal(failed.syncStatus, "failed");
  assert.equal(failed.lastSyncErrorCode, "push_delivery_failed");
});

test("wallet pass sync timestamps do not mutate pass updatedAt", async () => {
  const repository = new MockWalletPassRepository();
  const issued = await repository.issueMemberWalletPass(createIssueInput());
  const originalUpdatedAt = issued.pass.updatedAt;

  const synced = await repository.markWalletPassSyncSuccess({
    passId: issued.pass.id,
    syncedAt: "2026-08-11T03:00:00.000Z",
  });
  const failed = await repository.markWalletPassSyncFailure({
    passId: issued.pass.id,
    safeErrorCode: "push_delivery_failed",
    attemptedAt: "2026-08-11T04:00:00.000Z",
  });

  assert.equal(synced.updatedAt, originalUpdatedAt);
  assert.equal(failed.updatedAt, originalUpdatedAt);
  assert.equal(failed.lastSyncAttemptedAt, "2026-08-11T04:00:00.000Z");
  assert.equal(failed.lastSyncErrorAt, "2026-08-11T04:00:00.000Z");
});

test("wallet pass reconciliation refreshes content and can invalidate the credential", async () => {
  const repository = new MockWalletPassRepository();
  const issued = await repository.issueMemberWalletPass(createIssueInput());
  await repository.registerAppleWalletDevice({
    publicId: issued.pass.publicId,
    deviceLibraryIdentifierHash: "device-library-hash-reconcile",
    pushTokenCiphertext: "ciphertext-reconcile",
    pushTokenIv: "iv-reconcile",
    pushTokenAuthTag: "tag-reconcile",
    pushTokenKeyVersion: 1,
  });
  await repository.markWalletPassSyncFailure({
    passId: issued.pass.id,
    safeErrorCode: "previous_failure",
  });

  const candidates = await repository.listAppleWalletPassesForReconciliation({
    limit: 10,
  });
  const pending = await repository.reconcileWalletPassContent({
    passId: issued.pass.id,
    action: "refresh",
    snapshotHash: "snapshot-hash-v2",
    snapshot: {
      displayName: "홍길동",
      generationLabel: "15기",
      campusLabel: "서울",
      roleLabel: "교육생",
    },
    changedAt: "2026-08-11T05:00:00.000Z",
  });

  assert.deepEqual(candidates.map((pass) => pass.id), [issued.pass.id]);
  assert.equal(pending.syncStatus, "pending");
  assert.equal(pending.lastSyncErrorCode, null);
  assert.equal(pending.currentRevision, 2);
  assert.equal(pending.currentSnapshotHash, "snapshot-hash-v2");
  assert.equal(pending.updatedAt, "2026-08-11T05:00:00.000Z");

  const invalidated = await repository.reconcileWalletPassContent({
    passId: issued.pass.id,
    action: "invalidate",
    changedAt: "2026-08-11T06:00:00.000Z",
  });
  assert.equal(invalidated.credentialStatus, "revoked");
  assert.equal(invalidated.revokedAt, "2026-08-11T06:00:00.000Z");
  assert.deepEqual(
    (await repository.listAppleWalletPassesForReconciliation({ limit: 10 }))
      .map((pass) => pass.id),
    [issued.pass.id],
  );
  await repository.markWalletPassSyncSuccess({ passId: issued.pass.id });
  assert.deepEqual(
    await repository.listAppleWalletPassesForReconciliation({ limit: 10 }),
    [],
  );
});
