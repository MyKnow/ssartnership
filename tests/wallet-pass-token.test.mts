import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createWalletPassPublicId,
  createWalletPassSerialNumber,
  createWalletPassVerificationUrl,
  deriveAppleWalletAuthenticationToken,
  signWalletPassVerificationToken,
  verifyWalletPassVerificationToken,
} from "../src/lib/wallet/wallet-pass-token.ts";

const MASTER_KEY = Buffer.alloc(32, 19);

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

describe("wallet pass token", () => {
  it("creates an opaque public id and signed verification URL", () => {
    const publicId = createWalletPassPublicId(() => Buffer.alloc(32, 7));
    assert.equal(publicId.length, 43);
    assert.equal(createWalletPassSerialNumber(publicId), `sp-${publicId}`);

    const token = signWalletPassVerificationToken(publicId, MASTER_KEY);
    assert.deepEqual(verifyWalletPassVerificationToken(token, MASTER_KEY), {
      publicId,
    });
    const url = createWalletPassVerificationUrl(publicId, {
      masterKey: MASTER_KEY,
      siteUrl: "https://example.com",
    });
    assert.match(url, /^https:\/\/example\.com\/wallet\/verify\//);
    assert.equal(url.includes("member"), false);
  });

  it("rejects tampered and malformed verification tokens", () => {
    const publicId = createWalletPassPublicId(() => Buffer.alloc(32, 9));
    const token = signWalletPassVerificationToken(publicId, MASTER_KEY);
    assert.equal(
      verifyWalletPassVerificationToken(`${token.slice(0, -1)}x`, MASTER_KEY),
      null,
    );
    assert.equal(
      verifyWalletPassVerificationToken("member-id.signature", MASTER_KEY),
      null,
    );
  });

  it("keeps QR and ApplePass tokens stable across auth-secret rotation", () => {
    const originalCurrent = process.env.APPLE_WALLET_AUTH_SECRET;
    const originalPrevious = process.env.APPLE_WALLET_AUTH_SECRET_PREVIOUS;
    const originalMasterKey =
      process.env.APPLE_WALLET_DEVICE_TOKEN_ENCRYPTION_KEY_BASE64;
    const publicId = createWalletPassPublicId(() => Buffer.alloc(32, 10));

    try {
      process.env.APPLE_WALLET_DEVICE_TOKEN_ENCRYPTION_KEY_BASE64 =
        MASTER_KEY.toString("base64");
      process.env.APPLE_WALLET_AUTH_SECRET = "a".repeat(32);

      const issuedQrToken = signWalletPassVerificationToken(publicId);
      const issuedQrUrl = createWalletPassVerificationUrl(publicId, {
        siteUrl: "https://example.com",
      });
      const issuedAuthenticationToken =
        deriveAppleWalletAuthenticationToken(
          publicId,
          "pass.com.example.member",
        );

      process.env.APPLE_WALLET_AUTH_SECRET_PREVIOUS = "a".repeat(32);
      process.env.APPLE_WALLET_AUTH_SECRET = "b".repeat(32);

      const updatedQrToken = signWalletPassVerificationToken(publicId);
      const updatedQrUrl = createWalletPassVerificationUrl(publicId, {
        siteUrl: "https://example.com",
      });
      const updatedAuthenticationToken =
        deriveAppleWalletAuthenticationToken(
          publicId,
          "pass.com.example.member",
        );

      assert.equal(updatedQrToken, issuedQrToken);
      assert.equal(updatedQrUrl, issuedQrUrl);
      assert.equal(updatedAuthenticationToken, issuedAuthenticationToken);
      assert.deepEqual(verifyWalletPassVerificationToken(issuedQrToken), {
        publicId,
      });
    } finally {
      restoreEnv("APPLE_WALLET_AUTH_SECRET", originalCurrent);
      restoreEnv("APPLE_WALLET_AUTH_SECRET_PREVIOUS", originalPrevious);
      restoreEnv(
        "APPLE_WALLET_DEVICE_TOKEN_ENCRYPTION_KEY_BASE64",
        originalMasterKey,
      );
    }
  });

  it("derives domain-separated Apple authentication values", () => {
    const publicId = createWalletPassPublicId(() => Buffer.alloc(32, 11));
    const authenticationToken = deriveAppleWalletAuthenticationToken(
      publicId,
      "pass.com.example.member",
      MASTER_KEY,
    );
    const verificationSignature = signWalletPassVerificationToken(
      publicId,
      MASTER_KEY,
    ).split(".")[1];
    assert.equal(authenticationToken.length, 43);
    assert.notEqual(authenticationToken, verificationSignature);
    assert.notEqual(
      authenticationToken,
      deriveAppleWalletAuthenticationToken(
        publicId,
        "pass.com.example.other",
        MASTER_KEY,
      ),
    );
    assert.notEqual(
      authenticationToken,
      deriveAppleWalletAuthenticationToken(
        createWalletPassPublicId(() => Buffer.alloc(32, 12)),
        "pass.com.example.member",
        MASTER_KEY,
      ),
    );
  });
});
