import assert from "node:assert/strict";
import { createHash, createPrivateKey, generateKeyPairSync, verify, X509Certificate } from "node:crypto";
import test from "node:test";

import * as asn1js from "asn1js";
import JSZip from "jszip";
import { AttributeTypeAndValue, Certificate, ContentInfo, CryptoEngine, SignedData } from "pkijs";

import { createAppleWalletPassArchive } from "@/lib/wallet/apple/archive";
import { buildAppleWalletPassPayload } from "@/lib/wallet/apple/payload";
import type { AppleWalletConfig } from "@/lib/wallet/apple/types";

const engine = new CryptoEngine({ name: "wallet-test", crypto: globalThis.crypto });
const algorithm: RsaHashedImportParams = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-1" };
const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
const otherPair = generateKeyPairSync("rsa", { modulusLength: 2048 });
const signingKey = await engine.importKey("pkcs8", Uint8Array.from(pair.privateKey.export({ type: "pkcs8", format: "der" })).buffer,
  algorithm, false, ["sign"]);

async function certificate(serial: number, name: string) {
  const cert = new Certificate();
  cert.version = 2;
  cert.serialNumber = new asn1js.Integer({ value: serial });
  cert.issuer.typesAndValues.push(new AttributeTypeAndValue({ type: "2.5.4.3", value: new asn1js.Utf8String({ value: "Synthetic Wallet test CA" }) }));
  cert.subject.typesAndValues.push(new AttributeTypeAndValue({ type: "2.5.4.3", value: new asn1js.Utf8String({ value: name }) }));
  cert.notBefore.value = new Date("2020-01-01T00:00:00Z");
  cert.notAfter.value = new Date("2099-01-01T00:00:00Z");
  const publicKey = await engine.importKey("spki", Uint8Array.from(pair.publicKey.export({ type: "spki", format: "der" })).buffer,
    algorithm, true, ["verify"]);
  await cert.subjectPublicKeyInfo.importKey(publicKey, engine);
  await cert.sign(signingKey, "SHA-1", engine);
  const raw = Buffer.from(cert.toSchema(true).toBER(false));
  return Buffer.from(`-----BEGIN CERTIFICATE-----\n${raw.toString("base64").match(/.{1,64}/g)?.join("\n")}\n-----END CERTIFICATE-----\n`);
}

const signerCert = await certificate(1, "Synthetic Wallet test signer");
const wwdr = await certificate(2, "Synthetic Wallet test WWDR");
const certificates = { signerCert, wwdr, signerKey: Buffer.from(pair.privateKey.export({ type: "pkcs8", format: "pem" })) };
const payload = buildAppleWalletPassPayload({ serialNumber: "test-serial", authenticationToken: "test-token-with-at-least-sixteen-characters", verificationUrl: "/wallet/verify/opaque.signature", displayName: "테스트", generationLabel: "15기", campusLabel: "서울", roleLabel: "구성원", updatedAt: "2026-10-02T00:00:00Z" },
  { organizationName: "싸트너십", passTypeIdentifier: "pass.com.ssartnership.test", teamIdentifier: "TEST123456", siteUrl: "https://ssartnership.myknow.xyz" });
const icons = { "icon.png": Buffer.from("synthetic-icon"), "icon@2x.png": Buffer.from("synthetic-icon-2x"), "icon@3x.png": Buffer.from("synthetic-icon-3x") };

async function inspectArchive(certs: Pick<AppleWalletConfig, "signerCert" | "wwdr" | "signerKey" | "signerKeyPassphrase"> = certificates) {
  const archive = await createAppleWalletPassArchive(payload, icons, certs);
  const zip = await JSZip.loadAsync(archive);
  const manifest = await zip.file("manifest.json")!.async("nodebuffer");
  const signature = await zip.file("signature")!.async("nodebuffer");
  const content = ContentInfo.fromBER(Uint8Array.from(signature).buffer);
  assert.equal(content.contentType, "1.2.840.113549.1.7.2");
  const signed = new SignedData({ schema: content.content });
  return { zip, manifest, signed };
}

test("Wallet archive preserves payload and hashes every bundled payload/icon file", async () => {
  const { zip, manifest, signed } = await inspectArchive();
  assert.deepEqual(Object.keys(zip.files).sort(), ["icon.png", "icon@2x.png", "icon@3x.png", "manifest.json", "pass.json", "signature"]);
  assert.deepEqual(JSON.parse(await zip.file("pass.json")!.async("string")), payload);
  const hashes = JSON.parse(manifest.toString());
  assert.deepEqual(Object.keys(hashes).sort(), ["icon.png", "icon@2x.png", "icon@3x.png", "pass.json"]);
  for (const [name, hash] of Object.entries(hashes)) {
    assert.equal(createHash("sha1").update(await zip.file(name)!.async("nodebuffer")).digest("hex"), hash);
  }
  assert.equal(signed.encapContentInfo.eContent, undefined, "CMS must be detached");
  assert.equal(signed.certificates?.length, 2);
  const expected = [new X509Certificate(signerCert).fingerprint256, new X509Certificate(wwdr).fingerprint256].sort();
  const actual = signed.certificates!.map((cert) => new X509Certificate(Buffer.from((cert as Certificate).toSchema(true).toBER(false))).fingerprint256).sort();
  assert.deepEqual(actual, expected);
});

test("Wallet detached CMS signature and authenticated manifest digest verify with native Node crypto", async () => {
  const { manifest, signed } = await inspectArchive();
  const info = signed.signerInfos[0];
  assert.equal(info.digestAlgorithm.algorithmId, "1.3.14.3.2.26");
  assert.equal(info.signatureAlgorithm.algorithmId, "1.2.840.113549.1.1.5");
  const attrs = info.signedAttrs!.attributes;
  assert.equal(attrs.find((attr) => attr.type === "1.2.840.113549.1.9.3")!.values[0].valueBlock.toString(), "1.2.840.113549.1.7.1");
  const digest = Buffer.from((attrs.find((attr) => attr.type === "1.2.840.113549.1.9.4")!.values[0] as asn1js.OctetString).valueBlock.valueHexView);
  assert.deepEqual(digest, createHash("sha1").update(manifest).digest());
  assert.equal(attrs.filter((attr) => attr.type === "1.2.840.113549.1.9.5").length, 1);
  const signedBytes = Buffer.from(info.signedAttrs!.encodedValue);
  const signature = Buffer.from(info.signature.valueBlock.valueHexView);
  assert.equal(verify("RSA-SHA1", signedBytes, new X509Certificate(signerCert).publicKey, signature), true);
  const corrupted = Buffer.from(signature); corrupted[0] ^= 1;
  assert.equal(verify("RSA-SHA1", signedBytes, new X509Certificate(signerCert).publicKey, corrupted), false);
  assert.equal(verify("RSA-SHA1", signedBytes, otherPair.publicKey, signature), false);
  assert.notDeepEqual(digest, createHash("sha1").update(Buffer.concat([manifest, Buffer.from("tampered")])).digest());
});

test("Wallet signing supports encrypted PKCS8 and leaves supplied secret buffers unchanged", async () => {
  const encrypted = Buffer.from(pair.privateKey.export({ type: "pkcs8", format: "pem", cipher: "aes-256-cbc", passphrase: "synthetic-test-passphrase" }));
  const before = Buffer.from(encrypted);
  await inspectArchive({ ...certificates, signerKey: encrypted, signerKeyPassphrase: "synthetic-test-passphrase" });
  assert.deepEqual(encrypted, before);
  assert.ok(createPrivateKey(certificates.signerKey));
  await assert.rejects(createAppleWalletPassArchive(payload, icons, { ...certificates, signerKey: encrypted, signerKeyPassphrase: "incorrect-test-passphrase" }));
});

test("Wallet signing rejects mismatched private key and malformed certificate", async () => {
  await assert.rejects(createAppleWalletPassArchive(payload, icons, { ...certificates, signerKey: Buffer.from(otherPair.privateKey.export({ type: "pkcs8", format: "pem" })) }));
  await assert.rejects(createAppleWalletPassArchive(payload, icons, { ...certificates, wwdr: Buffer.from("invalid-certificate") }));
});
