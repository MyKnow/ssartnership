import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

process.env.NEXT_PUBLIC_DATA_SOURCE = "mock";
process.env.APPLE_WALLET_ENABLED = "true";
process.env.APPLE_WALLET_TEAM_ID = "ABCDE12345";
process.env.APPLE_WALLET_PASS_TYPE_ID = "pass.com.ssartnership.member";
process.env.APPLE_WALLET_ORGANIZATION_NAME = "싸트너십";
process.env.APPLE_WALLET_CERTIFICATE_BASE64 = Buffer.from(
  "-----BEGIN CERTIFICATE-----\nZmFrZQ==\n-----END CERTIFICATE-----",
).toString("base64");
process.env.APPLE_WALLET_PRIVATE_KEY_BASE64 = Buffer.from(
  "-----BEGIN PRIVATE KEY-----\nZmFrZQ==\n-----END PRIVATE KEY-----",
).toString("base64");
process.env.APPLE_WALLET_WWDR_CERTIFICATE_BASE64 =
  process.env.APPLE_WALLET_CERTIFICATE_BASE64;
process.env.APPLE_WALLET_DEVICE_TOKEN_ENCRYPTION_KEY_BASE64 = Buffer.alloc(
  32,
  7,
).toString("base64");
process.env.NEXT_PUBLIC_SITE_URL = "https://ssartnership.example.com";

const { MOCK_MEMBER_ID, recordMockRequiredPolicyConsent } = await import(
  "../src/lib/mock/member.ts"
);
const { walletPassRepository } = await import(
  "../src/lib/repositories/wallet-pass.ts"
);
const { reconcileInstalledAppleWalletPasses } = await import(
  "../src/lib/wallet/wallet-pass-service.ts"
);

test("daily reconciliation persists a changed snapshot before the Apple update", async () => {
  recordMockRequiredPolicyConsent(MOCK_MEMBER_ID, {
    service: 1,
    privacy: 1,
  });
  const issued = await walletPassRepository.issueMemberWalletPass({
    memberId: MOCK_MEMBER_ID,
    platform: "apple",
    consentVersion: 1,
    consentedAt: "2026-08-11T00:00:00.000Z",
    snapshotHash: "stale-snapshot-hash",
    snapshot: {
      displayName: "홍길동",
      generationLabel: "15기",
      campusLabel: "서울",
      roleLabel: "교육생",
    },
    idempotencyKey: "wallet-pass-reconcile-issue-key",
    requestFingerprint: "wallet-pass-reconcile-issue-fingerprint",
  });
  await walletPassRepository.registerAppleWalletDevice({
    publicId: issued.pass.publicId,
    deviceLibraryIdentifierHash: "wallet-pass-reconcile-device-hash",
    pushTokenCiphertext: "ciphertext",
    pushTokenIv: "iv",
    pushTokenAuthTag: "tag",
    pushTokenKeyVersion: 1,
  });
  await walletPassRepository.markWalletPassSyncFailure({
    passId: issued.pass.id,
    safeErrorCode: "previous_failure",
  });

  const notifiedPassIds: string[] = [];
  const result = await reconcileInstalledAppleWalletPasses({
    batchSize: 10,
    maxPasses: 10,
    notifyPassChange: async (pass) => {
      notifiedPassIds.push(pass.id);
      assert.equal(pass.syncStatus, "pending");
      assert.equal(pass.lastSyncErrorCode, null);
      assert.equal(pass.currentRevision, 2);
      assert.notEqual(pass.currentSnapshotHash, "stale-snapshot-hash");
      await walletPassRepository.markWalletPassSyncSuccess({ passId: pass.id });
      return { delivered: 1, invalidTokens: [], failed: 0, reasonCodes: [] };
    },
  });

  assert.deepEqual(notifiedPassIds, [issued.pass.id]);
  assert.deepEqual(result, {
    skipped: false,
    scanned: 1,
    invalidated: 1,
    failed: 0,
    truncated: false,
  });

  const converged = await reconcileInstalledAppleWalletPasses({
    batchSize: 10,
    maxPasses: 10,
    notifyPassChange: async () => {
      assert.fail("a converged pass must not be pushed again");
    },
  });
  assert.deepEqual(converged, {
    skipped: false,
    scanned: 1,
    invalidated: 0,
    failed: 0,
    truncated: false,
  });

  await walletPassRepository.markWalletPassSyncFailure({
    passId: issued.pass.id,
    safeErrorCode: "transient_push_failure",
  });
  let activeRetryCount = 0;
  const retriedActive = await reconcileInstalledAppleWalletPasses({
    batchSize: 10,
    maxPasses: 10,
    notifyPassChange: async (pass) => {
      activeRetryCount += 1;
      assert.equal(pass.credentialStatus, "active");
      assert.equal(pass.syncStatus, "failed");
      await walletPassRepository.markWalletPassSyncSuccess({ passId: pass.id });
      return { delivered: 1, invalidTokens: [], failed: 0, reasonCodes: [] };
    },
  });
  assert.equal(activeRetryCount, 1);
  assert.equal(retriedActive.invalidated, 0);

  await walletPassRepository.reconcileWalletPassContent({
    passId: issued.pass.id,
    action: "invalidate",
  });
  await walletPassRepository.markWalletPassSyncFailure({
    passId: issued.pass.id,
    safeErrorCode: "transient_revoke_push_failure",
  });
  let revokedRetryCount = 0;
  const retriedRevoked = await reconcileInstalledAppleWalletPasses({
    batchSize: 10,
    maxPasses: 10,
    notifyPassChange: async (pass) => {
      revokedRetryCount += 1;
      assert.equal(pass.credentialStatus, "revoked");
      assert.equal(pass.syncStatus, "failed");
      await walletPassRepository.markWalletPassSyncSuccess({ passId: pass.id });
      return { delivered: 1, invalidTokens: [], failed: 0, reasonCodes: [] };
    },
  });
  assert.equal(revokedRetryCount, 1);
  assert.equal(retriedRevoked.invalidated, 0);

  const revokedConverged = await reconcileInstalledAppleWalletPasses({
    batchSize: 10,
    maxPasses: 10,
    notifyPassChange: async () => {
      assert.fail("a synced revoked pass must leave the reconciliation queue");
    },
  });
  assert.equal(revokedConverged.scanned, 0);
});

test("reconciliation route is secret-gated and scheduled without exposing pass ids", () => {
  const route = readFileSync(
    new URL(
      "../src/app/api/cron/reconcile-apple-wallet-passes/route.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const vercel = readFileSync(new URL("../vercel.json", import.meta.url), "utf8");

  assert.match(route, /process\.env\.CRON_SECRET/);
  assert.match(route, /request\.headers\.get\("authorization"\)/);
  assert.doesNotMatch(route, /isAdminSession|adminAuthorized/);
  assert.match(route, /reconcileInstalledAppleWalletPasses\(\)/);
  assert.doesNotMatch(route, /publicId|memberId|passId/);
  assert.match(vercel, /\/api\/cron\/reconcile-apple-wallet-passes/);
});
