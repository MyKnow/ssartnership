import assert from "node:assert/strict";
import { createCipheriv, createHmac } from "node:crypto";
import { describe, it } from "node:test";
import {
  decryptApplePushToken,
  encryptApplePushToken,
  hashAppleDeviceLibraryIdentifier,
  normalizeApplePushToken,
} from "../src/lib/wallet/apple/apple-wallet-device-token.ts";

describe("Apple Wallet device push token", () => {
  it("validates and encrypts a token without storing plaintext", () => {
    const key = Buffer.alloc(32, 3);
    const pushToken = "a".repeat(64);
    const encrypted = encryptApplePushToken(pushToken, {
      key,
      random: () => Buffer.alloc(12, 4),
    });
    assert.equal(encrypted.ciphertext.includes(pushToken), false);
    assert.equal(decryptApplePushToken(encrypted, key), pushToken);

    const directKeyCiphertext = (() => {
      const cipher = createCipheriv("aes-256-gcm", key, Buffer.alloc(12, 4));
      return Buffer.concat([
        cipher.update(pushToken, "utf8"),
        cipher.final(),
      ]).toString("base64url");
    })();
    assert.notEqual(encrypted.ciphertext, directKeyCiphertext);
  });

  it("rejects malformed push tokens", () => {
    assert.equal(normalizeApplePushToken("short"), null);
    assert.equal(normalizeApplePushToken("token with spaces"), null);
    assert.throws(() =>
      encryptApplePushToken("short", { key: Buffer.alloc(32) }),
    );
  });

  it("hashes device identifiers with a domain-separated subkey", () => {
    const encryptionKey = Buffer.alloc(32, 9);
    const deviceLibraryIdentifier = "device-library-identifier";
    const derivedKey = createHmac("sha256", encryptionKey)
      .update("ssartnership:apple-wallet:device-id-hash-key:v1")
      .digest();
    const expectedHash = createHmac("sha256", derivedKey)
      .update("ssartnership:apple-wallet:device-id:v1\0")
      .update(deviceLibraryIdentifier)
      .digest("base64url");
    const directKeyReuseHash = createHmac("sha256", encryptionKey)
      .update(deviceLibraryIdentifier)
      .digest("base64url");

    assert.equal(
      hashAppleDeviceLibraryIdentifier(
        deviceLibraryIdentifier,
        encryptionKey,
      ),
      expectedHash,
    );
    assert.notEqual(expectedHash, directKeyReuseHash);
    assert.equal(
      hashAppleDeviceLibraryIdentifier("short", encryptionKey),
      null,
    );
    assert.throws(
      () =>
        hashAppleDeviceLibraryIdentifier(
          deviceLibraryIdentifier,
          Buffer.alloc(31),
        ),
      /암호화 키 형식/,
    );
  });
});
