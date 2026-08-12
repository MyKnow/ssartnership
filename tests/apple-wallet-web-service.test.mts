import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAppleWalletUpdatedPassesResponse,
  hashAppleWalletDeviceIdentifier,
  isAppleWalletPassModifiedAfter,
  isExpectedAppleWalletPassTypeIdentifier,
  normalizeAppleWalletSerialNumber,
  parseAppleWalletIfModifiedSince,
  parseAppleWalletUpdatedSince,
  verifyAppleWalletPassAuthorization,
} from "../src/lib/wallet/apple/web-service.ts";
import { deriveAppleWalletAuthenticationToken } from "../src/lib/wallet/wallet-pass-token.ts";

const deviceTokenEncryptionKey = Buffer.alloc(32, 7);
const passTypeIdentifier = "pass.com.ssartnership.member";

test("apple wallet auth verification uses ApplePass token and exact pass type identifier", () => {
  const publicId = "A".repeat(43);
  const authorizationToken = deriveAppleWalletAuthenticationToken(
    publicId,
    passTypeIdentifier,
    deviceTokenEncryptionKey,
  );
  const request = new Request("https://example.com", {
    headers: {
      authorization: `ApplePass ${authorizationToken}`,
    },
  });

  assert.equal(
    verifyAppleWalletPassAuthorization(
      request,
      { publicId },
      {
        passTypeIdentifier,
        deviceTokenEncryptionKey,
      },
    ),
    true,
  );
  assert.equal(
    verifyAppleWalletPassAuthorization(
      new Request("https://example.com", {
        headers: { authorization: "Bearer wrong" },
      }),
      { publicId },
      {
        passTypeIdentifier,
        deviceTokenEncryptionKey,
      },
    ),
    false,
  );
  assert.equal(
    isExpectedAppleWalletPassTypeIdentifier(
      encodeURIComponent(passTypeIdentifier),
      passTypeIdentifier,
    ),
    true,
  );
  assert.equal(
    isExpectedAppleWalletPassTypeIdentifier("pass.com.other", passTypeIdentifier),
    false,
  );
  assert.equal(isExpectedAppleWalletPassTypeIdentifier("%E0%A4%A", passTypeIdentifier), false);
  assert.equal(normalizeAppleWalletSerialNumber(`sp-${"A".repeat(43)}`), `sp-${"A".repeat(43)}`);
  assert.equal(normalizeAppleWalletSerialNumber("%E0%A4%A"), null);
});

test("apple wallet auth verification keeps accepting an installed pass after unrelated auth-secret rotation", () => {
  const publicId = "B".repeat(43);
  const installedAuthorizationToken = deriveAppleWalletAuthenticationToken(
    publicId,
    passTypeIdentifier,
    deviceTokenEncryptionKey,
  );

  assert.equal(
    verifyAppleWalletPassAuthorization(
      new Request("https://example.com", {
        headers: {
          authorization: `ApplePass ${installedAuthorizationToken}`,
        },
      }),
      { publicId },
      {
        passTypeIdentifier,
        deviceTokenEncryptionKey,
      },
    ),
    true,
  );
});

test("apple wallet device ids and update timestamps are normalized safely", () => {
  assert.match(
    hashAppleWalletDeviceIdentifier(
      "device-token-1234",
      deviceTokenEncryptionKey,
    ) ?? "",
    /^[A-Za-z0-9_-]+$/,
  );
  assert.equal(
    hashAppleWalletDeviceIdentifier(
      "bad space",
      deviceTokenEncryptionKey,
    ),
    null,
  );

  const sinceRequest = new Request(
    "https://example.com/api?passesUpdatedSince=2026-08-11T00:00:00.000Z",
  );
  assert.deepEqual(parseAppleWalletUpdatedSince(sinceRequest), {
    ok: true,
    value: "2026-08-11T00:00:00.000Z",
  });
  assert.deepEqual(
    parseAppleWalletUpdatedSince(
      new Request("https://example.com/api?passesUpdatedSince=not-a-date"),
    ),
    { ok: false },
  );

  const modifiedSince = parseAppleWalletIfModifiedSince(
    new Request("https://example.com", {
      headers: {
        "if-modified-since": "Tue, 11 Aug 2026 00:00:00 GMT",
      },
    }),
  );
  assert.equal(modifiedSince.ok, true);
  if (!modifiedSince.ok) {
    assert.fail("expected If-Modified-Since to parse");
  }
  assert.equal(
    isAppleWalletPassModifiedAfter(
      { updatedAt: "2026-08-11T00:00:01.000Z" },
      modifiedSince.value,
    ),
    true,
  );
  assert.equal(
    isAppleWalletPassModifiedAfter(
      { updatedAt: "2026-08-11T00:00:00.000Z" },
      modifiedSince.value,
    ),
    false,
  );
  assert.equal(
    isAppleWalletPassModifiedAfter(
      { updatedAt: "2026-08-11T00:00:00.999Z" },
      modifiedSince.value,
    ),
    false,
  );
});

test("apple wallet updated pass payload returns serials and latest tag", () => {
  const payload = buildAppleWalletUpdatedPassesResponse([
    {
      pass: {
        serialNumber: "sp-first",
        updatedAt: "2026-08-11T00:00:00.000Z",
      },
      registrations: [
        {
          updatedAt: "2026-08-11T00:00:10.000Z",
        },
      ],
    },
    {
      pass: {
        serialNumber: "sp-second",
        updatedAt: "2026-08-11T00:00:03.000Z",
      },
      registrations: [],
    },
  ] as never);

  assert.deepEqual(payload, {
    serialNumbers: ["sp-first", "sp-second"],
    lastUpdated: "2026-08-11T00:00:03.000Z",
  });
});
