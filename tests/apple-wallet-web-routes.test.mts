import assert from "node:assert/strict";
import test from "node:test";
import { MOCK_MEMBER_ID } from "../src/lib/mock/member.ts";
import { decryptApplePushToken } from "../src/lib/wallet/apple/apple-wallet-device-token.ts";
import { deriveAppleWalletAuthenticationToken } from "../src/lib/wallet/wallet-pass-token.ts";

function applyAppleWalletEnv() {
  process.env.NEXT_PUBLIC_DATA_SOURCE = "mock";
  process.env.APPLE_WALLET_ENABLED = "true";
  process.env.APPLE_WALLET_TEAM_ID = "ABCDE12345";
  process.env.APPLE_WALLET_PASS_TYPE_ID = "pass.com.ssartnership.member";
  process.env.APPLE_WALLET_ORGANIZATION_NAME = "SSARTNERSHIP";
  process.env.APPLE_WALLET_CERTIFICATE_BASE64 = Buffer.from(
    "-----BEGIN CERTIFICATE-----\nZmFrZQ==\n-----END CERTIFICATE-----",
  ).toString("base64");
  process.env.APPLE_WALLET_PRIVATE_KEY_BASE64 = Buffer.from(
    "-----BEGIN PRIVATE KEY-----\nZmFrZQ==\n-----END PRIVATE KEY-----",
  ).toString("base64");
  process.env.APPLE_WALLET_WWDR_CERTIFICATE_BASE64 = Buffer.from(
    "-----BEGIN CERTIFICATE-----\nZmFrZQ==\n-----END CERTIFICATE-----",
  ).toString("base64");
  process.env.APPLE_WALLET_DEVICE_TOKEN_ENCRYPTION_KEY_BASE64 = Buffer.alloc(
    32,
    7,
  ).toString("base64");
  process.env.NEXT_PUBLIC_SITE_URL = "https://ssartnership.example.com";
}

async function issueMockPass() {
  applyAppleWalletEnv();
  const { walletPassRepository } = await import("../src/lib/repositories/wallet-pass.ts");
  return walletPassRepository.issueMemberWalletPass({
    memberId: MOCK_MEMBER_ID,
    platform: "apple",
    consentVersion: 1,
    consentedAt: "2026-08-11T00:00:00.000Z",
    snapshotHash: `snapshot-${crypto.randomUUID()}`,
    snapshot: {
      displayName: "홍길동",
      generationLabel: "15기",
      campusLabel: "서울",
      roleLabel: "교육생",
    },
    idempotencyKey: `wallet-pass-issue-${crypto.randomUUID()}`,
    requestFingerprint: `wallet-pass-fingerprint-${crypto.randomUUID()}`,
  });
}

function createApplePassHeaders(
  publicId: string,
) {
  const masterKey = Buffer.from(
    process.env.APPLE_WALLET_DEVICE_TOKEN_ENCRYPTION_KEY_BASE64 ?? "",
    "base64",
  );
  return {
    authorization: `ApplePass ${deriveAppleWalletAuthenticationToken(
      publicId,
      process.env.APPLE_WALLET_PASS_TYPE_ID ?? "",
      masterKey,
    )}`,
  };
}

test("apple wallet registration route encrypts push tokens and returns 201/200", async () => {
  const issued = await issueMockPass();
  const route = await import(
    "../src/app/api/wallet/apple/v1/devices/[deviceId]/registrations/[passTypeId]/[serialNumber]/route.ts"
  );
  const params = Promise.resolve({
    deviceId: "device-token-1234",
    passTypeId: process.env.APPLE_WALLET_PASS_TYPE_ID ?? "",
    serialNumber: issued.pass.serialNumber,
  });

  const firstResponse = await route.POST(
    new Request("https://example.com/api/wallet/apple/v1/devices", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...createApplePassHeaders(issued.pass.publicId),
      },
      body: JSON.stringify({ pushToken: "a".repeat(64) }),
    }),
    { params },
  );
  assert.equal(firstResponse.status, 201);

  const secondResponse = await route.POST(
    new Request("https://example.com/api/wallet/apple/v1/devices", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...createApplePassHeaders(issued.pass.publicId),
      },
      body: JSON.stringify({ pushToken: "b".repeat(64) }),
    }),
    { params },
  );
  assert.equal(secondResponse.status, 200);

  const { walletPassRepository } = await import("../src/lib/repositories/wallet-pass.ts");
  const registrations = await walletPassRepository.listAppleWalletDeviceRegistrationsForPass(
    issued.pass.id,
  );
  assert.equal(registrations.length >= 1, true);
  assert.equal(registrations[0]?.pushTokenCiphertext.includes("b".repeat(64)), false);
  assert.equal(
    decryptApplePushToken({
      ciphertext: registrations[0]?.pushTokenCiphertext ?? "",
      iv: registrations[0]?.pushTokenIv ?? "",
      tag: registrations[0]?.pushTokenAuthTag ?? "",
      keyVersion: registrations[0]?.pushTokenKeyVersion ?? 1,
    }),
    "b".repeat(64),
  );
});

test("apple wallet updated list route is device-scoped and returns 204 when empty", async () => {
  const issued = await issueMockPass();
  const registerRoute = await import(
    "../src/app/api/wallet/apple/v1/devices/[deviceId]/registrations/[passTypeId]/[serialNumber]/route.ts"
  );
  const listRoute = await import(
    "../src/app/api/wallet/apple/v1/devices/[deviceId]/registrations/[passTypeId]/route.ts"
  );

  await registerRoute.POST(
    new Request("https://example.com/api/wallet/apple/v1/devices", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...createApplePassHeaders(issued.pass.publicId),
      },
      body: JSON.stringify({ pushToken: "c".repeat(64) }),
    }),
    {
      params: Promise.resolve({
        deviceId: "device-token-2000",
        passTypeId: process.env.APPLE_WALLET_PASS_TYPE_ID ?? "",
        serialNumber: issued.pass.serialNumber,
      }),
    },
  );

  const listResponse = await listRoute.GET(
    new Request(
      "https://example.com/api/wallet/apple/v1/devices/device-token-2000/registrations/pass.com.ssartnership.member",
    ),
    {
      params: Promise.resolve({
        deviceId: "device-token-2000",
        passTypeId: process.env.APPLE_WALLET_PASS_TYPE_ID ?? "",
      }),
    },
  );
  assert.equal(listResponse.status, 200);
  const listPayload = await listResponse.json();
  assert.deepEqual(listPayload.serialNumbers, [issued.pass.serialNumber]);
  assert.equal(
    new Date(listPayload.lastUpdated).getTime() >=
      new Date(issued.pass.updatedAt).getTime(),
    true,
  );

  const emptyResponse = await listRoute.GET(
    new Request(
      "https://example.com/api/wallet/apple/v1/devices/device-token-empty/registrations/pass.com.ssartnership.member",
    ),
    {
      params: Promise.resolve({
        deviceId: "device-token-empty",
        passTypeId: process.env.APPLE_WALLET_PASS_TYPE_ID ?? "",
      }),
    },
  );
  assert.equal(emptyResponse.status, 204);
});

test("unrelated auth secret rotation preserves an existing device registration", async () => {
  const issued = await issueMockPass();
  const deviceId = `device-rotation-${crypto.randomUUID()}`;
  const registerRoute = await import(
    "../src/app/api/wallet/apple/v1/devices/[deviceId]/registrations/[passTypeId]/[serialNumber]/route.ts"
  );
  const listRoute = await import(
    "../src/app/api/wallet/apple/v1/devices/[deviceId]/registrations/[passTypeId]/route.ts"
  );

  const registrationResponse = await registerRoute.POST(
    new Request("https://example.com/api/wallet/apple/v1/devices", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...createApplePassHeaders(issued.pass.publicId),
      },
      body: JSON.stringify({ pushToken: "d".repeat(64) }),
    }),
    {
      params: Promise.resolve({
        deviceId,
        passTypeId: process.env.APPLE_WALLET_PASS_TYPE_ID ?? "",
        serialNumber: issued.pass.serialNumber,
      }),
    },
  );
  assert.equal(registrationResponse.status, 201);

  process.env.APPLE_WALLET_AUTH_SECRET_PREVIOUS = "a".repeat(32);
  process.env.APPLE_WALLET_AUTH_SECRET = "b".repeat(32);

  const listResponse = await listRoute.GET(
    new Request("https://example.com/api/wallet/apple/v1/devices"),
    {
      params: Promise.resolve({
        deviceId,
        passTypeId: process.env.APPLE_WALLET_PASS_TYPE_ID ?? "",
      }),
    },
  );
  assert.equal(listResponse.status, 200);
  assert.deepEqual((await listResponse.json()).serialNumbers, [
    issued.pass.serialNumber,
  ]);

  const unregisterResponse = await registerRoute.DELETE(
    new Request("https://example.com/api/wallet/apple/v1/devices", {
      method: "DELETE",
      headers: createApplePassHeaders(issued.pass.publicId),
    }),
    {
      params: Promise.resolve({
        deviceId,
        passTypeId: process.env.APPLE_WALLET_PASS_TYPE_ID ?? "",
        serialNumber: issued.pass.serialNumber,
      }),
    },
  );
  assert.equal(unregisterResponse.status, 200);
});

test("apple wallet latest pass route honors authorization and If-Modified-Since before rebuilding", async () => {
  const issued = await issueMockPass();
  const passRoute = await import(
    "../src/app/api/wallet/apple/v1/passes/[passTypeId]/[serialNumber]/route.ts"
  );

  const unauthorizedResponse = await passRoute.GET(
    new Request("https://example.com/api/wallet/apple/v1/passes", {
      headers: {
        authorization: "ApplePass wrong",
      },
    }),
    {
      params: Promise.resolve({
        passTypeId: process.env.APPLE_WALLET_PASS_TYPE_ID ?? "",
        serialNumber: issued.pass.serialNumber,
      }),
    },
  );
  assert.equal(unauthorizedResponse.status, 401);

  const notModifiedResponse = await passRoute.GET(
    new Request("https://example.com/api/wallet/apple/v1/passes", {
      headers: {
        ...createApplePassHeaders(issued.pass.publicId),
        "if-modified-since": new Date(
          new Date(issued.pass.updatedAt).getTime() + 1000,
        ).toUTCString(),
      },
    }),
    {
      params: Promise.resolve({
        passTypeId: process.env.APPLE_WALLET_PASS_TYPE_ID ?? "",
        serialNumber: issued.pass.serialNumber,
      }),
    },
  );
  assert.equal(notModifiedResponse.status, 304);
  assert.equal(
    notModifiedResponse.headers.get("last-modified"),
    new Date(issued.pass.updatedAt).toUTCString(),
  );

  const malformedSerialResponse = await passRoute.GET(
    new Request("https://example.com/api/wallet/apple/v1/passes", {
      headers: createApplePassHeaders(issued.pass.publicId),
    }),
    {
      params: Promise.resolve({
        passTypeId: process.env.APPLE_WALLET_PASS_TYPE_ID ?? "",
        serialNumber: "%E0%A4%A",
      }),
    },
  );
  assert.equal(malformedSerialResponse.status, 404);
});

test("apple wallet log route validates the schema and never echoes logs", async () => {
  applyAppleWalletEnv();
  const logRoute = await import(
    "../src/app/api/wallet/apple/v1/log/route.ts"
  );

  const invalidResponse = await logRoute.POST(
    new Request("https://example.com/api/wallet/apple/v1/log", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ logs: [123] }),
    }),
  );
  assert.equal(invalidResponse.status, 400);

  const validResponse = await logRoute.POST(
    new Request("https://example.com/api/wallet/apple/v1/log", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ logs: ["device said hello"] }),
    }),
  );
  assert.equal(validResponse.status, 200);
  assert.equal(await validResponse.text(), "");
});
