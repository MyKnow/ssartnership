import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  sendAppleWalletPassUpdate,
  type AppleWalletPushTransport,
} from "../src/lib/wallet/apple/index.ts";

const ORIGINAL_ENV = { ...process.env };
const fakeCertificate = Buffer.from(
  "-----BEGIN CERTIFICATE-----\nZmFrZQ==\n-----END CERTIFICATE-----\n",
).toString("base64");
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
});
