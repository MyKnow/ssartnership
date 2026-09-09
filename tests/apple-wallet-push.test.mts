import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  sendAppleWalletPassUpdate,
  type AppleWalletPushTransport,
} from "../src/lib/wallet/apple/index.ts";

const ORIGINAL_ENV = { ...process.env };
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
const fakeCertificate = Buffer.from(signerCertificatePem).toString("base64");
const fakeKey = Buffer.from(
  "-----BEGIN PRIVATE KEY-----\nZmFrZQ==\n-----END PRIVATE KEY-----\n",
).toString("base64");

function setConfiguredEnv() {
  Object.assign(process.env, {
    APPLE_WALLET_ENABLED: "true",
    APPLE_WALLET_TEAM_ID: "ABCD123456",
    APPLE_WALLET_PASS_TYPE_ID: "pass.com.example.member",
    APPLE_WALLET_ORGANIZATION_NAME: "싸트너십",
    APPLE_WALLET_CERTIFICATE_BASE64: fakeCertificate,
    APPLE_WALLET_PRIVATE_KEY_BASE64: fakeKey,
    APPLE_WALLET_WWDR_CERTIFICATE_BASE64: fakeCertificate,
    APPLE_WALLET_DEVICE_TOKEN_ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 4).toString("base64"),
    NEXT_PUBLIC_SITE_URL: "https://example.com",
  });
}

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
});

describe("Apple Wallet APNs update", () => {
  it("deduplicates tokens and returns only safe result codes", async () => {
    setConfiguredEnv();
    const calls: string[] = [];
    const transport: AppleWalletPushTransport = async ({ pushToken }) => {
      calls.push(pushToken);
      return pushToken.startsWith("b")
        ? { statusCode: 410, reason: "Unregistered" }
        : { statusCode: 200 };
    };
    const validA = "a".repeat(64);
    const validB = "b".repeat(64);
    const result = await sendAppleWalletPassUpdate(
      [validA, validA, validB, "bad token"],
      { transport, concurrency: 2 },
    );
    assert.deepEqual(calls.sort(), [validA, validB].sort());
    assert.equal(result.delivered, 1);
    assert.equal(result.failed, 2);
    assert.deepEqual(result.invalidTokens, [validB]);
    assert.deepEqual(result.reasonCodes.sort(), ["invalid_token", "invalid_token_format"]);
  });

  it("fails closed without exposing configuration values", async () => {
    process.env.APPLE_WALLET_ENABLED = "false";
    const result = await sendAppleWalletPassUpdate(["a".repeat(64)], {
      transport: async () => ({ statusCode: 200 }),
    });
    assert.deepEqual(result.reasonCodes, ["wallet_disabled"]);
    assert.equal(result.failed, 1);
  });

  it("bounds one notification batch before starting APNs transports", async () => {
    setConfiguredEnv();
    let transportCalls = 0;
    const tokens = Array.from({ length: 1_001 }, (_, index) =>
      index.toString(16).padStart(64, "0"));

    const result = await sendAppleWalletPassUpdate(tokens, {
      transport: async () => {
        transportCalls += 1;
        return { statusCode: 200 };
      },
      concurrency: 16,
    });

    assert.equal(transportCalls, 1_000);
    assert.equal(result.delivered, 1_000);
    assert.equal(result.failed, 1);
    assert.deepEqual(result.reasonCodes, ["batch_truncated"]);
  });
});
