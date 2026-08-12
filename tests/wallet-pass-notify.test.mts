import assert from "node:assert/strict";
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
  9,
).toString("base64");
process.env.NEXT_PUBLIC_SITE_URL = "https://ssartnership.example.com";

const { MOCK_MEMBER_ID } = await import("../src/lib/mock/member.ts");
const { walletPassRepository } = await import(
  "../src/lib/repositories/wallet-pass.ts"
);
const { notifyAppleWalletPassChange } = await import(
  "../src/lib/wallet/wallet-pass-service.ts"
);
const { encryptApplePushToken } = await import(
  "../src/lib/wallet/apple/apple-wallet-device-token.ts"
);

test("wallet pass push marks unreadable encrypted registrations as a safe failure", async () => {
  const issued = await walletPassRepository.issueMemberWalletPass({
    memberId: MOCK_MEMBER_ID,
    platform: "apple",
    consentVersion: 1,
    consentedAt: "2026-08-11T00:00:00.000Z",
    snapshotHash: "snapshot-notify-test",
    snapshot: {
      displayName: "홍길동",
      generationLabel: "15기",
      campusLabel: "서울",
      roleLabel: "교육생",
    },
    idempotencyKey: "wallet-pass-notify-issue-key",
    requestFingerprint: "wallet-pass-notify-issue-fingerprint",
  });
  await walletPassRepository.registerAppleWalletDevice({
    publicId: issued.pass.publicId,
    deviceLibraryIdentifierHash: "wallet-pass-notify-device-hash",
    pushTokenCiphertext: "unreadable",
    pushTokenIv: "unreadable",
    pushTokenAuthTag: "unreadable",
    pushTokenKeyVersion: 1,
  });

  const result = await notifyAppleWalletPassChange(issued.pass);
  const pass = await walletPassRepository.getWalletPassByPublicId(
    issued.pass.publicId,
  );

  assert.deepEqual(result, {
    delivered: 0,
    failed: 1,
    reasonCodes: ["push_token_unreadable"],
  });
  assert.equal(pass?.syncStatus, "failed");
  assert.equal(pass?.lastSyncErrorCode, "push_token_unreadable");

  await walletPassRepository.unregisterAppleWalletDevice({
    publicId: issued.pass.publicId,
    deviceLibraryIdentifierHash: "wallet-pass-notify-device-hash",
  });
});

test("wallet pass push removes invalid APNs registrations without poisoning healthy sync", async () => {
  const issued = await walletPassRepository.issueMemberWalletPass({
    memberId: MOCK_MEMBER_ID,
    platform: "apple",
    consentVersion: 1,
    consentedAt: "2026-08-11T00:00:00.000Z",
    snapshotHash: "snapshot-notify-test",
    snapshot: {
      displayName: "홍길동",
      generationLabel: "15기",
      campusLabel: "서울",
      roleLabel: "교육생",
    },
    idempotencyKey: "wallet-pass-notify-issue-key-2",
    requestFingerprint: "wallet-pass-notify-issue-fingerprint-2",
  });
  const encryptionKey = Buffer.alloc(32, 9);
  const validToken = "a".repeat(64);
  const invalidToken = "b".repeat(64);

  for (const [deviceHash, token] of [
    ["wallet-pass-notify-healthy-device", validToken],
    ["wallet-pass-notify-stale-device", invalidToken],
  ] as const) {
    const encrypted = encryptApplePushToken(token, { key: encryptionKey });
    await walletPassRepository.registerAppleWalletDevice({
      publicId: issued.pass.publicId,
      deviceLibraryIdentifierHash: deviceHash,
      pushTokenCiphertext: encrypted.ciphertext,
      pushTokenIv: encrypted.iv,
      pushTokenAuthTag: encrypted.tag,
      pushTokenKeyVersion: encrypted.keyVersion,
    });
  }

  const result = await notifyAppleWalletPassChange(issued.pass, {
    sendUpdate: async () => ({
      delivered: 1,
      invalidTokens: [invalidToken],
      failed: 1,
      reasonCodes: ["invalid_token"],
    }),
  });
  const pass = await walletPassRepository.getWalletPassByPublicId(
    issued.pass.publicId,
  );
  const registrations = await walletPassRepository
    .listAppleWalletDeviceRegistrationsForPass(issued.pass.id);

  assert.equal(result.failed, 1);
  assert.equal(pass?.syncStatus, "synced");
  assert.equal(pass?.lastSyncErrorCode, null);
  assert.deepEqual(
    registrations.map((registration) => registration.deviceLibraryIdentifierHash),
    ["wallet-pass-notify-healthy-device"],
  );
});
