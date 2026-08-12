import assert from "node:assert/strict";
import test from "node:test";

import {
  getAppleWalletConfigStatus,
  getAppleWalletEnvironmentNames,
} from "@/lib/wallet/apple";

const envNames = getAppleWalletEnvironmentNames();
const base64Pem = Buffer.from("-----BEGIN CERTIFICATE-----\nZmFrZQ==\n-----END CERTIFICATE-----").toString("base64");
const base64Key = Buffer.from("-----BEGIN PRIVATE KEY-----\nZmFrZQ==\n-----END PRIVATE KEY-----").toString("base64");

function buildValidEnv() {
  return {
    APPLE_WALLET_ENABLED: "true",
    APPLE_WALLET_TEAM_ID: "ABCD123456",
    APPLE_WALLET_PASS_TYPE_ID: "pass.com.ssartnership.member",
    APPLE_WALLET_ORGANIZATION_NAME: "싸트너십",
    APPLE_WALLET_CERTIFICATE_BASE64: base64Pem,
    APPLE_WALLET_PRIVATE_KEY_BASE64: base64Key,
    APPLE_WALLET_WWDR_CERTIFICATE_BASE64: base64Pem,
    APPLE_WALLET_DEVICE_TOKEN_ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 7).toString("base64"),
    NEXT_PUBLIC_SITE_URL: "https://ssartnership.myknow.xyz",
  };
}

test("apple wallet config exposes documented env names", () => {
  assert.deepEqual(envNames, {
    enabled: "APPLE_WALLET_ENABLED",
    teamIdentifier: "APPLE_WALLET_TEAM_ID",
    passTypeIdentifier: "APPLE_WALLET_PASS_TYPE_ID",
    organizationName: "APPLE_WALLET_ORGANIZATION_NAME",
    signerCertificate: "APPLE_WALLET_CERTIFICATE_BASE64",
    signerPrivateKey: "APPLE_WALLET_PRIVATE_KEY_BASE64",
    signerPrivateKeyPassphrase: "APPLE_WALLET_PRIVATE_KEY_PASSPHRASE",
    wwdrCertificate: "APPLE_WALLET_WWDR_CERTIFICATE_BASE64",
    deviceTokenEncryptionKey: "APPLE_WALLET_DEVICE_TOKEN_ENCRYPTION_KEY_BASE64",
    siteUrl: "NEXT_PUBLIC_SITE_URL",
  });
});

test("apple wallet config reports disabled when feature flag is off", () => {
  const status = getAppleWalletConfigStatus({
    APPLE_WALLET_ENABLED: "false",
  });

  assert.equal(status.ok, false);
  assert.equal(status.code, "disabled");
  assert.equal(status.enabled, false);
});

test("apple wallet config reports missing required env names without secret values", () => {
  const status = getAppleWalletConfigStatus({
    APPLE_WALLET_ENABLED: "true",
    APPLE_WALLET_TEAM_ID: "ABCD123456",
  });

  assert.equal(status.ok, false);
  assert.equal(status.code, "missing_env");
  assert.deepEqual(status.missingEnv, [
    "APPLE_WALLET_PASS_TYPE_ID",
    "APPLE_WALLET_ORGANIZATION_NAME",
    "APPLE_WALLET_CERTIFICATE_BASE64",
    "APPLE_WALLET_PRIVATE_KEY_BASE64",
    "APPLE_WALLET_WWDR_CERTIFICATE_BASE64",
    "APPLE_WALLET_DEVICE_TOKEN_ENCRYPTION_KEY_BASE64",
    "NEXT_PUBLIC_SITE_URL",
  ]);
  assert.equal("config" in status, false);
});

test("apple wallet config rejects invalid base64 and exposes only env name", () => {
  const status = getAppleWalletConfigStatus({
    ...buildValidEnv(),
    APPLE_WALLET_CERTIFICATE_BASE64: "not-base64!",
  });

  assert.equal(status.ok, false);
  assert.equal(status.code, "invalid_env");
  assert.equal(status.invalidEnv, "APPLE_WALLET_CERTIFICATE_BASE64");
  assert.match(status.message, /APPLE_WALLET_CERTIFICATE_BASE64/);
  assert.doesNotMatch(status.message, /not-base64!/);
});

test("apple wallet config rejects decoded values that are not PEM material", () => {
  const status = getAppleWalletConfigStatus({
    ...buildValidEnv(),
    APPLE_WALLET_PRIVATE_KEY_BASE64: Buffer.from("not a private key").toString(
      "base64",
    ),
  });

  assert.equal(status.ok, false);
  assert.equal(status.code, "invalid_env");
  assert.equal(status.invalidEnv, "APPLE_WALLET_PRIVATE_KEY_BASE64");
  assert.doesNotMatch(status.message, /not a private key/);
});

test("apple wallet config returns decoded buffers for valid env", () => {
  const status = getAppleWalletConfigStatus(buildValidEnv());

  assert.equal(status.ok, true);
  assert.equal(status.code, "ok");
  assert.equal(status.config.enabled, true);
  assert.equal(status.config.siteUrl, "https://ssartnership.myknow.xyz");
  assert.equal(status.config.teamIdentifier, "ABCD123456");
  assert.equal(status.config.passTypeIdentifier, "pass.com.ssartnership.member");
  assert.equal(status.config.organizationName, "싸트너십");
  assert.ok(status.config.signerCert.length > 0);
  assert.ok(status.config.signerKey.length > 0);
  assert.ok(status.config.wwdr.length > 0);
  assert.equal(status.config.deviceTokenEncryptionKey.length, 32);
});

test("apple wallet config requires an explicit public HTTPS site URL", () => {
  const missingSiteUrlEnv: Partial<NodeJS.ProcessEnv> = buildValidEnv();
  delete missingSiteUrlEnv.NEXT_PUBLIC_SITE_URL;
  const missingStatus = getAppleWalletConfigStatus(missingSiteUrlEnv);

  assert.equal(missingStatus.ok, false);
  assert.equal(missingStatus.code, "missing_env");
  assert.deepEqual(missingStatus.missingEnv, ["NEXT_PUBLIC_SITE_URL"]);

  for (const invalidSiteUrl of [
    "http://ssartnership.example.com",
    "https://user:password@ssartnership.example.com",
    "https://ssartnership.example.com/base-path",
    "https://ssartnership.example.com?preview=1",
    "not-a-url",
  ]) {
    const invalidStatus = getAppleWalletConfigStatus({
      ...buildValidEnv(),
      NEXT_PUBLIC_SITE_URL: invalidSiteUrl,
    });
    assert.equal(invalidStatus.ok, false);
    assert.equal(invalidStatus.code, "invalid_env");
    assert.equal(invalidStatus.invalidEnv, "NEXT_PUBLIC_SITE_URL");
    assert.equal(invalidStatus.message.includes(invalidSiteUrl), false);
  }
});

test("apple wallet config rejects a master key that is not exactly 32 bytes", () => {
  for (const invalidKey of [Buffer.alloc(31), Buffer.alloc(33)]) {
    const status = getAppleWalletConfigStatus({
      ...buildValidEnv(),
      APPLE_WALLET_DEVICE_TOKEN_ENCRYPTION_KEY_BASE64:
        invalidKey.toString("base64"),
    });

    assert.equal(status.ok, false);
    assert.equal(status.code, "invalid_env");
    assert.equal(
      status.invalidEnv,
      "APPLE_WALLET_DEVICE_TOKEN_ENCRYPTION_KEY_BASE64",
    );
    assert.equal(status.message.includes(invalidKey.toString("base64")), false);
  }
});
