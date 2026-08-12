import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAppleWalletPassPayload,
  createAppleWalletIconBuffers,
  getAppleWalletWebServiceUrl,
} from "@/lib/wallet/apple";

const config = {
  organizationName: "싸트너십",
  passTypeIdentifier: "pass.com.ssartnership.member",
  teamIdentifier: "ABCD123456",
  siteUrl: "https://ssartnership.myknow.xyz",
} as const;

const input = {
  serialNumber: "sp-serial-0001",
  authenticationToken: "auth-token-0001",
  verificationUrl: "/wallet/verify/opaque.signature",
  displayName: "홍길동",
  generationLabel: "15기",
  campusLabel: "서울 캠퍼스",
  roleLabel: "구성원",
  updatedAt: "2026-08-11T09:30:00.000Z",
} as const;

test("apple wallet payload builds generic pass with korean fields", () => {
  const payload = buildAppleWalletPassPayload(input, config);

  assert.equal(payload.description, "싸트너십 회원 인증");
  assert.equal(payload.passTypeIdentifier, config.passTypeIdentifier);
  assert.equal(payload.teamIdentifier, config.teamIdentifier);
  assert.equal(payload.organizationName, config.organizationName);
  assert.equal(payload.authenticationToken, input.authenticationToken);
  assert.equal(
    payload.webServiceURL,
    "https://ssartnership.myknow.xyz/api/wallet/apple",
  );
  assert.equal(payload.sharingProhibited, true);
  assert.equal(payload.voided, false);
  assert.equal(payload.backgroundColor, "rgb(15, 23, 42)");
  assert.equal(payload.labelColor, "rgb(226, 232, 240)");

  assert.deepEqual(payload.generic?.headerFields?.[0], {
    key: "generation",
    label: "기수",
    value: "15기",
  });
  assert.deepEqual(payload.generic?.primaryFields?.[0], {
    key: "displayName",
    label: "이름",
    value: "홍길동",
  });
  assert.equal(payload.generic?.secondaryFields?.[0]?.label, "캠퍼스");
  assert.equal(payload.generic?.secondaryFields?.[1]?.label, "권한");
  assert.equal(payload.generic?.auxiliaryFields?.[0]?.label, "마지막 갱신");
  assert.equal(payload.generic?.backFields?.[0]?.label, "사용 안내");
  assert.equal(payload.generic?.backFields?.[1]?.label, "안내");
  assert.equal(payload.userInfo, undefined);
});

test("apple wallet payload can void a revoked credential without changing its identity", () => {
  const payload = buildAppleWalletPassPayload({ ...input, voided: true }, config);
  assert.equal(payload.voided, true);
  assert.equal(payload.serialNumber, input.serialNumber);
  assert.equal(payload.authenticationToken, input.authenticationToken);
});

test("apple wallet payload uses only the opaque verification url in its barcode", () => {
  const payload = buildAppleWalletPassPayload(input, config);
  const barcodeMessage = payload.barcodes?.[0]?.message;

  assert.ok(barcodeMessage);

  const url = new URL(barcodeMessage);
  assert.equal(url.origin, "https://ssartnership.myknow.xyz");
  assert.equal(url.pathname, "/wallet/verify/opaque.signature");
  assert.equal(url.search, "");
  assert.equal(barcodeMessage.includes(input.serialNumber), false);
});

test("apple wallet helper returns canonical web service url", () => {
  assert.equal(
    getAppleWalletWebServiceUrl("https://ssartnership.myknow.xyz"),
    "https://ssartnership.myknow.xyz/api/wallet/apple",
  );
});

test("apple wallet icon helper generates required icon buffers from public asset", async () => {
  const buffers = await createAppleWalletIconBuffers();

  assert.deepEqual(Object.keys(buffers).sort(), [
    "icon.png",
    "icon@2x.png",
    "icon@3x.png",
  ]);

  for (const buffer of Object.values(buffers)) {
    assert.ok(buffer.length > 0);
    assert.equal(buffer.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  }
});
