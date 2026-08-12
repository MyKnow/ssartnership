import assert from "node:assert/strict";
import { X509Certificate } from "node:crypto";
import test from "node:test";

import {
  getAppleWalletConfigStatus,
  getAppleWalletEnvironmentNames,
} from "@/lib/wallet/apple";

const envNames = getAppleWalletEnvironmentNames();
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
const base64Pem = Buffer.from(signerCertificatePem).toString("base64");
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
  assert.equal(status.config.signerCertificateValidity.expiringSoon, false);
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

test("apple wallet config rejects Pass Type certificates that are not yet valid", () => {
  const certificate = new X509Certificate(signerCertificatePem);
  const status = getAppleWalletConfigStatus(buildValidEnv(), {
    now: new Date(new Date(certificate.validFrom).getTime() - 1_000),
  });

  assert.equal(status.ok, false);
  assert.equal(status.code, "invalid_env");
  assert.equal(status.invalidEnv, "APPLE_WALLET_CERTIFICATE_BASE64");
  assert.match(status.message, /아직 유효하지 않습니다/);
});

test("apple wallet config rejects expired Pass Type certificates", () => {
  const certificate = new X509Certificate(signerCertificatePem);
  const status = getAppleWalletConfigStatus(buildValidEnv(), {
    now: new Date(new Date(certificate.validTo).getTime() + 1_000),
  });

  assert.equal(status.ok, false);
  assert.equal(status.code, "invalid_env");
  assert.equal(status.invalidEnv, "APPLE_WALLET_CERTIFICATE_BASE64");
  assert.match(status.message, /만료되었습니다/);
});

test("apple wallet config surfaces expiring-soon Pass Type certificates without leaking cert contents", () => {
  const certificate = new X509Certificate(signerCertificatePem);
  const status = getAppleWalletConfigStatus(buildValidEnv(), {
    now: new Date(new Date(certificate.validTo).getTime() - 5 * 24 * 60 * 60 * 1_000),
  });

  assert.equal(status.ok, true);
  assert.equal(status.config.signerCertificateValidity.expiringSoon, true);
  assert.ok(status.config.signerCertificateValidity.expiresInDays <= 5);
  assert.deepEqual(status.warnings?.map((warning) => warning.code), [
    "certificate_expiring_soon",
  ]);
  assert.equal(
    status.warnings?.[0]?.message.includes(signerCertificatePem),
    false,
  );
});
