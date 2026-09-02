import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { MOCK_MEMBER_ID } from "../src/lib/mock/member.ts";
import { resetProductEventThrottleForTests } from "../src/lib/product-event-throttle.ts";
import { MAX_BULK_JSON_BODY_BYTES, MAX_STANDARD_JSON_BODY_BYTES } from "../src/lib/request-body-limit.ts";
import { decryptApplePushToken } from "../src/lib/wallet/apple/apple-wallet-device-token.ts";
import { deriveAppleWalletAuthenticationToken } from "../src/lib/wallet/wallet-pass-token.ts";

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

function applyAppleWalletEnv() {
  process.env.NEXT_PUBLIC_DATA_SOURCE = "mock";
  process.env.APPLE_WALLET_ENABLED = "true";
  process.env.APPLE_WALLET_TEAM_ID = "ABCDE12345";
  process.env.APPLE_WALLET_PASS_TYPE_ID = "pass.com.ssartnership.member";
  process.env.APPLE_WALLET_ORGANIZATION_NAME = "SSARTNERSHIP";
  process.env.APPLE_WALLET_CERTIFICATE_BASE64 = Buffer.from(
    signerCertificatePem,
  ).toString("base64");
  process.env.APPLE_WALLET_PRIVATE_KEY_BASE64 = Buffer.from(
    "-----BEGIN PRIVATE KEY-----\nZmFrZQ==\n-----END PRIVATE KEY-----",
  ).toString("base64");
  process.env.APPLE_WALLET_WWDR_CERTIFICATE_BASE64 = Buffer.from(
    signerCertificatePem,
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

function createStreamedJsonRequest(
  url: string,
  bodyText: string,
  init?: { headers?: HeadersInit },
) {
  const encoder = new TextEncoder();
  const midpoint = Math.floor(bodyText.length / 2);
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(bodyText.slice(0, midpoint)));
      controller.enqueue(encoder.encode(bodyText.slice(midpoint)));
      controller.close();
    },
  });

  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    body,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
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
    { passId: issued.pass.id, limit: 10 },
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

test("authorized unregister is a safe 200 no-op when the pass no longer exists", async () => {
  applyAppleWalletEnv();
  const registerRoute = await import(
    "../src/app/api/wallet/apple/v1/devices/[deviceId]/registrations/[passTypeId]/[serialNumber]/route.ts"
  );
  const orphanPublicId = "A".repeat(43);

  const response = await registerRoute.DELETE(
    new Request("https://example.com/api/wallet/apple/v1/devices", {
      method: "DELETE",
      headers: createApplePassHeaders(orphanPublicId),
    }),
    {
      params: Promise.resolve({
        deviceId: "device-orphan-2000",
        passTypeId: process.env.APPLE_WALLET_PASS_TYPE_ID ?? "",
        serialNumber: `sp-${orphanPublicId}`,
      }),
    },
  );

  assert.equal(response.status, 200);
});

test("orphan unregister still rejects invalid ApplePass authorization", async () => {
  applyAppleWalletEnv();
  const registerRoute = await import(
    "../src/app/api/wallet/apple/v1/devices/[deviceId]/registrations/[passTypeId]/[serialNumber]/route.ts"
  );

  const response = await registerRoute.DELETE(
    new Request("https://example.com/api/wallet/apple/v1/devices", {
      method: "DELETE",
      headers: {
        authorization: "ApplePass wrong",
      },
    }),
    {
      params: Promise.resolve({
        deviceId: "device-orphan-4010",
        passTypeId: process.env.APPLE_WALLET_PASS_TYPE_ID ?? "",
        serialNumber: `sp-${"A".repeat(43)}`,
      }),
    },
  );

  assert.equal(response.status, 401);
});

test("apple wallet web-service routes emit privacy-safe device observability only", () => {
  const registrationRoute = readFileSync(
    new URL(
      "../src/app/api/wallet/apple/v1/devices/[deviceId]/registrations/[passTypeId]/[serialNumber]/route.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const syncRoute = readFileSync(
    new URL(
      "../src/app/api/wallet/apple/v1/devices/[deviceId]/registrations/[passTypeId]/route.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const logRoute = readFileSync(
    new URL("../src/app/api/wallet/apple/v1/log/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(registrationRoute, /wallet_pass_device_register/);
  assert.match(registrationRoute, /wallet_pass_device_unregister/);
  assert.match(syncRoute, /wallet_pass_sync/);
  assert.match(registrationRoute, /scheduleProductEventLog/);
  assert.match(syncRoute, /scheduleProductEventLog/);
  assert.match(logRoute, /consumeProductEventIngressQuota/);
  assert.doesNotMatch(registrationRoute, /queueMicrotask/);
  assert.doesNotMatch(syncRoute, /queueMicrotask/);
  assert.doesNotMatch(registrationRoute, /request\.json\(/);
  assert.doesNotMatch(logRoute, /request\.json\(/);
  assert.doesNotMatch(registrationRoute, /import\("@\/lib\/activity-logs"\)/);
  assert.doesNotMatch(syncRoute, /import\("@\/lib\/activity-logs"\)/);

  const propertyBlocks = [
    ...registrationRoute.matchAll(
      /logWalletDeviceEvent\([^,]+,\s*\{([\s\S]{0,300}?)\}\);/g,
    ),
    ...syncRoute.matchAll(
      /logWalletSyncEvent\(\{([\s\S]{0,300}?)\}\);/g,
    ),
  ].map((match) => match[1] ?? "");

  assert.ok(propertyBlocks.length >= 5);

  for (const block of propertyBlocks) {
    assert.doesNotMatch(block, /targetId:/);
    assert.doesNotMatch(block, /deviceId:/);
    assert.doesNotMatch(block, /pushToken:/);
    assert.doesNotMatch(block, /authorization:/);
    assert.doesNotMatch(block, /memberId:/);
    assert.doesNotMatch(block, /publicId:/);
  }

  assert.match(syncRoute, /syncScope:\s*"device_updates"/);
});

test("apple wallet registration route distinguishes malformed 400 from oversized 413", async () => {
  const issued = await issueMockPass();
  const route = await import(
    "../src/app/api/wallet/apple/v1/devices/[deviceId]/registrations/[passTypeId]/[serialNumber]/route.ts"
  );
  const params = {
    params: Promise.resolve({
      deviceId: `device-invalid-${crypto.randomUUID()}`,
      passTypeId: process.env.APPLE_WALLET_PASS_TYPE_ID ?? "",
      serialNumber: issued.pass.serialNumber,
    }),
  };

  const malformedResponse = await route.POST(
    new Request("https://example.com/api/wallet/apple/v1/devices", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...createApplePassHeaders(issued.pass.publicId),
      },
      body: "not-json",
    }),
    params,
  );
  assert.equal(malformedResponse.status, 400);
  assert.deepEqual(await malformedResponse.json(), {
    message: "pushToken 형식이 올바르지 않습니다.",
  });

  const declaredOversizedResponse = await route.POST(
    new Request("https://example.com/api/wallet/apple/v1/devices", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(MAX_STANDARD_JSON_BODY_BYTES + 1),
        ...createApplePassHeaders(issued.pass.publicId),
      },
      body: "{}",
    }),
    params,
  );
  assert.equal(declaredOversizedResponse.status, 413);
  assert.deepEqual(await declaredOversizedResponse.json(), {
    message: "요청이 너무 큽니다.",
  });

  const streamedOversizedBody = JSON.stringify({
    pushToken: "a".repeat(MAX_STANDARD_JSON_BODY_BYTES),
  });
  const streamedOversizedResponse = await route.POST(
    createStreamedJsonRequest(
      "https://example.com/api/wallet/apple/v1/devices",
      streamedOversizedBody,
      {
        headers: createApplePassHeaders(issued.pass.publicId),
      },
    ),
    params,
  );
  assert.equal(streamedOversizedResponse.status, 413);
  assert.deepEqual(await streamedOversizedResponse.json(), {
    message: "요청이 너무 큽니다.",
  });
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
  resetProductEventThrottleForTests();
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

test("apple wallet log route distinguishes malformed 400 from oversized 413", async () => {
  applyAppleWalletEnv();
  resetProductEventThrottleForTests();
  const logRoute = await import(
    "../src/app/api/wallet/apple/v1/log/route.ts"
  );

  const malformedResponse = await logRoute.POST(
    new Request("https://example.com/api/wallet/apple/v1/log", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "198.51.100.10",
      },
      body: "not-json",
    }),
  );
  assert.equal(malformedResponse.status, 400);
  assert.deepEqual(await malformedResponse.json(), {
    message: "로그 본문 형식이 올바르지 않습니다.",
  });

  const declaredOversizedResponse = await logRoute.POST(
    new Request("https://example.com/api/wallet/apple/v1/log", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(MAX_BULK_JSON_BODY_BYTES + 1),
        "x-forwarded-for": "198.51.100.11",
      },
      body: "{}",
    }),
  );
  assert.equal(declaredOversizedResponse.status, 413);
  assert.deepEqual(await declaredOversizedResponse.json(), {
    message: "요청이 너무 큽니다.",
  });

  const streamedOversizedBody = JSON.stringify({
    logs: ["x".repeat(MAX_BULK_JSON_BODY_BYTES)],
  });
  const streamedOversizedResponse = await logRoute.POST(
    createStreamedJsonRequest(
      "https://example.com/api/wallet/apple/v1/log",
      streamedOversizedBody,
      {
        headers: {
          "x-forwarded-for": "198.51.100.12",
        },
      },
    ),
  );
  assert.equal(streamedOversizedResponse.status, 413);
  assert.deepEqual(await streamedOversizedResponse.json(), {
    message: "요청이 너무 큽니다.",
  });
});

test("apple wallet log route rate-limits repeated public IP ingress without surfacing an error", async () => {
  applyAppleWalletEnv();
  resetProductEventThrottleForTests();
  const logRoute = await import(
    "../src/app/api/wallet/apple/v1/log/route.ts"
  );
  const headers = {
    "content-type": "application/json",
    "x-forwarded-for": "198.51.100.99",
  };

  for (let index = 0; index < 240; index += 1) {
    const response = await logRoute.POST(
      new Request("https://example.com/api/wallet/apple/v1/log", {
        method: "POST",
        headers,
        body: JSON.stringify({ logs: [`message-${index}`] }),
      }),
    );
    assert.equal(response.status, 200);
  }

  const throttledResponse = await logRoute.POST(
    new Request("https://example.com/api/wallet/apple/v1/log", {
      method: "POST",
      headers,
      body: JSON.stringify({ logs: ["message-throttled"] }),
    }),
  );
  assert.equal(throttledResponse.status, 200);
  assert.equal(await throttledResponse.text(), "");
});
