import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { MemberWalletPass } from "../src/lib/repositories/wallet-pass-repository.ts";

const signerCertificatePem = `-----BEGIN CERTIFICATE-----
MIIDJzCCAg+gAwIBAgIUL9LhxGZsKfYjc6iSEuI75iMyInAwDQYJKoZIhvcNAQEL
BQAwIzEhMB8GA1UEAwwYc3NhcnRuZXJzaGlwLXdhbGxldC10ZXN0MB4XDTI2MDgx
MjE2MDkwNFoXDTI3MDgxMjE2MDkwNFowIzEhMB8GA1UEAwwYc3NhcnRuZXJzaGlw
LXdhbGxldC10ZXN0MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA7SYY
ToCUfRHM7q5x9M65yJwe7Y4s9M3WvvT4KQZ1DccqHvO4l6iMZtN50h2nvsz8fTv8
t/GcRhhgMGhNeVWX90ZNde1A6tZigG9b5c6/309qFueBZU+U+LQvUE36H7OqvToC
6xVI7Ei5jUJyORFBCIKlQuvYZxqzOOTi8CakDDEBSApTXhZNn/PVrnufQGWPw2Oe
8C/ZviG5XwoDSoMs4OtwQPKCgH+U7RzeXl/g9AsvftwTErTSYfOB9vvorY6Xvqag
Bfuhq5bQEXLTvQBd0JX/BFTvnUatNqB605OsyrOEmgGxy3SWyvZGjm+lSSjHzOy6
6/dR+vfe5ssX8a9xuwIDAQABo1MwUTAdBgNVHQ4EFgQU/2zVCHI4jUB+qZIX6LD8
jOi1KO8wHwYDVR0jBBgwFoAU/2zVCHI4jUB+qZIX6LD8jOi1KO8wDwYDVR0TAQH/
BAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEAUElMhzusC4dy6VmhnfA+do0SvPxk
NSK+7f1ExxQj8lgKuRGs7XVFCNZrrI6WC6+wkrTIWaWuBOv0H1wNmVaRSFJyDT2i
n4mMpZA9vHxZ09mVWeriSLgeLgPx82LgcyULjv9kxXjOGFv6Z+YHHS/jeRPCQUJz
uetYNdvhh2gm+IYMXt9L69qjzku5/7Awea5w4h+tx0084tjqCt7NMONPgCeSOV6i
ocPkgHOpZtaA1+chF1S9W55iD9u4A8GPsi8Hb7f98Gf2u6OQJuMEko8t1OCvIZqF
nKSZC+IjBruCE6hve0uGD+wDuZvS1X5zzpErjj6CpQJccrlBj2F4r0j9nQ==
-----END CERTIFICATE-----`;

process.env.NEXT_PUBLIC_DATA_SOURCE = "mock";
process.env.APPLE_WALLET_ENABLED = "true";
process.env.APPLE_WALLET_TEAM_ID = "ABCDE12345";
process.env.APPLE_WALLET_PASS_TYPE_ID = "pass.com.ssartnership.member";
process.env.APPLE_WALLET_ORGANIZATION_NAME = "싸트너십";
process.env.APPLE_WALLET_CERTIFICATE_BASE64 = Buffer.from(
  signerCertificatePem,
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
const {
  reconcileInstalledAppleWalletPasses,
} = await import(
  "../src/lib/wallet/wallet-pass-service.ts"
);
const { getAppleWalletConfigStatus } = await import(
  "../src/lib/wallet/apple/index.ts"
);

function getBaselineConfigStatus() {
  const status = getAppleWalletConfigStatus(process.env, {
    now: new Date("2026-08-12T16:09:04.000Z"),
  });
  assert.equal(status.ok, true);
  return status;
}

function createRevokedWalletPass(index: number): MemberWalletPass {
  const timestamp = "2026-08-30T00:00:00.000Z";
  return {
    id: `concurrency-pass-${index}`,
    memberId: `concurrency-member-${index}`,
    platform: "apple",
    publicId: `concurrency-public-${index}`,
    serialNumber: `concurrency-serial-${index}`,
    credentialStatus: "revoked",
    installationStatus: "installed",
    syncStatus: "failed",
    consentVersion: 1,
    consentedAt: timestamp,
    currentRevision: 1,
    currentSnapshotHash: `concurrency-snapshot-${index}`,
    currentSnapshot: {},
    issuedAt: timestamp,
    revokedAt: timestamp,
    lastSyncAttemptedAt: timestamp,
    lastSyncedAt: null,
    lastSyncErrorCode: "retry",
    lastSyncErrorAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

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
    configStatus: getBaselineConfigStatus(),
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
    skipReason: null,
    configWarningCodes: [],
    certificateExpiresInDays: 365,
  });

  const converged = await reconcileInstalledAppleWalletPasses({
    batchSize: 10,
    maxPasses: 10,
    configStatus: getBaselineConfigStatus(),
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
    skipReason: null,
    configWarningCodes: [],
    certificateExpiresInDays: 365,
  });

  await walletPassRepository.markWalletPassSyncFailure({
    passId: issued.pass.id,
    safeErrorCode: "transient_push_failure",
  });
  let activeRetryCount = 0;
  const retriedActive = await reconcileInstalledAppleWalletPasses({
    batchSize: 10,
    maxPasses: 10,
    configStatus: getBaselineConfigStatus(),
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
    configStatus: getBaselineConfigStatus(),
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
    configStatus: getBaselineConfigStatus(),
    notifyPassChange: async () => {
      assert.fail("a synced revoked pass must leave the reconciliation queue");
    },
  });
  assert.equal(revokedConverged.scanned, 0);
  assert.equal(revokedConverged.skipReason, null);
  assert.deepEqual(revokedConverged.configWarningCodes, []);
  assert.equal(revokedConverged.certificateExpiresInDays, 365);
});

test("daily reconciliation bounds independent pass work while preserving one visit per pass", async () => {
  const repository = walletPassRepository as typeof walletPassRepository & {
    listAppleWalletPassesForReconciliation: (
      input: { afterPassId?: string | null; limit: number },
    ) => Promise<MemberWalletPass[]>;
  };
  const originalList = repository.listAppleWalletPassesForReconciliation;
  const passes = Array.from({ length: 4 }, (_, index) =>
    createRevokedWalletPass(index),
  );
  repository.listAppleWalletPassesForReconciliation = async ({ afterPassId }) =>
    afterPassId ? [] : passes;

  let active = 0;
  let maximumActive = 0;
  const visited = new Set<string>();
  try {
    const result = await reconcileInstalledAppleWalletPasses({
      batchSize: 4,
      maxPasses: 4,
      concurrency: 2,
      configStatus: getBaselineConfigStatus(),
      notifyPassChange: async (pass) => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        visited.add(pass.id);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        return { delivered: 1, invalidTokens: [], failed: 0, reasonCodes: [] };
      },
    });

    assert.equal(maximumActive, 2);
    assert.deepEqual([...visited].sort(), passes.map((pass) => pass.id).sort());
    assert.equal(result.scanned, 4);
    assert.equal(result.failed, 0);
    assert.equal(result.truncated, true);
  } finally {
    repository.listAppleWalletPassesForReconciliation = originalList;
  }
});

test("reconciliation surfaces safe skip reasons and certificate warnings", async () => {
  const disabled = await reconcileInstalledAppleWalletPasses({
    configStatus: {
      ok: false,
      code: "disabled",
      enabled: false,
      message: "disabled",
    },
  });
  assert.deepEqual(disabled, {
    skipped: true,
    scanned: 0,
    invalidated: 0,
    failed: 0,
    truncated: false,
    skipReason: "wallet_disabled",
    configWarningCodes: [],
    certificateExpiresInDays: null,
  });

  const invalid = await reconcileInstalledAppleWalletPasses({
    configStatus: {
      ok: false,
      code: "invalid_env",
      enabled: true,
      invalidEnv: "APPLE_WALLET_CERTIFICATE_BASE64",
      message: "invalid",
    },
  });
  assert.deepEqual(invalid, {
    skipped: true,
    scanned: 0,
    invalidated: 0,
    failed: 0,
    truncated: false,
    skipReason: "wallet_config_invalid",
    configWarningCodes: [],
    certificateExpiresInDays: null,
  });

  const expiringSoonStatus = getAppleWalletConfigStatus(
    {
      APPLE_WALLET_ENABLED: "true",
      APPLE_WALLET_TEAM_ID: "ABCDE12345",
      APPLE_WALLET_PASS_TYPE_ID: "pass.com.ssartnership.member",
      APPLE_WALLET_ORGANIZATION_NAME: "싸트너십",
      APPLE_WALLET_CERTIFICATE_BASE64: Buffer.from(
        signerCertificatePem,
      ).toString("base64"),
      APPLE_WALLET_PRIVATE_KEY_BASE64: Buffer.from(
        "-----BEGIN PRIVATE KEY-----\nZmFrZQ==\n-----END PRIVATE KEY-----",
      ).toString("base64"),
      APPLE_WALLET_WWDR_CERTIFICATE_BASE64: Buffer.from(
        signerCertificatePem,
      ).toString("base64"),
      APPLE_WALLET_DEVICE_TOKEN_ENCRYPTION_KEY_BASE64: Buffer.alloc(
        32,
        7,
      ).toString("base64"),
      NEXT_PUBLIC_SITE_URL: "https://ssartnership.example.com",
    },
    {
      now: new Date("2027-08-07T16:09:04.000Z"),
    },
  );
  assert.equal(expiringSoonStatus.ok, true);

  const withWarning = await reconcileInstalledAppleWalletPasses({
    batchSize: 1,
    maxPasses: 1,
    configStatus: expiringSoonStatus,
    notifyPassChange: async () => {
      assert.fail("warning-only config should not change the reconciliation flow");
    },
  });
  assert.equal(withWarning.skipped, false);
  assert.deepEqual(withWarning.configWarningCodes, [
    "certificate_expiring_soon",
  ]);
  assert.equal(withWarning.certificateExpiresInDays, 5);
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

  assert.match(route, /ensureCronApiAccess\(request/);
  assert.match(route, /getCronErrorResponse\("reconcile-apple-wallet-passes"/);
  assert.match(route, /"cache-control": "no-store"/);
  assert.doesNotMatch(route, /isAdminSession|adminAuthorized/);
  assert.match(route, /reconcileInstalledAppleWalletPasses\(\)/);
  assert.match(route, /scheduleProductEventLog/);
  assert.match(route, /syncScope:\s*"daily_reconcile"/);
  assert.match(route, /configWarningCodes/);
  assert.match(route, /certificateExpiresInDays/);
  assert.match(route, /reasonCode:\s*result\.skipReason/);
  assert.doesNotMatch(route, /queueMicrotask/);
  assert.doesNotMatch(route, /import\("@\/lib\/activity-logs"\)/);
  assert.doesNotMatch(route, /publicId|memberId|passId/);
  assert.match(vercel, /\/api\/cron\/reconcile-apple-wallet-passes/);
});
