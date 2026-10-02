import { createHash, createPrivateKey, X509Certificate } from "node:crypto";

import * as asn1js from "asn1js";
import JSZip from "jszip";
import {
  Attribute, Certificate, ContentInfo, CryptoEngine, EncapsulatedContentInfo,
  IssuerAndSerialNumber, SignedAndUnsignedAttributes, SignedData, SignerInfo,
} from "pkijs";

import type { AppleWalletPassPayload } from "./pass-types";
import type { AppleWalletConfig } from "./types";

const engine = new CryptoEngine({ name: "ssartnership-wallet", crypto: globalThis.crypto });
const SIGNING_ALGORITHM: RsaHashedImportParams = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-1" };
const DATA_OID = "1.2.840.113549.1.7.1";
const ICON_NAMES = ["icon.png", "icon@2x.png", "icon@3x.png"] as const;
type SigningConfig = Pick<AppleWalletConfig, "signerCert" | "wwdr" | "signerKey" | "signerKeyPassphrase">;

function parseCertificate(pem: Buffer) {
  return Certificate.fromBER(Uint8Array.from(new X509Certificate(pem).raw).buffer);
}

async function signManifest(manifest: Buffer, config: SigningConfig) {
  const certificate = new X509Certificate(config.signerCert);
  const key = createPrivateKey({ key: config.signerKey, format: "pem", passphrase: config.signerKeyPassphrase });
  if (key.asymmetricKeyType !== "rsa" || !certificate.checkPrivateKey(key)) {
    throw new Error("Wallet signing certificate and RSA key do not match.");
  }
  const signer = parseCertificate(config.signerCert);
  const wwdr = parseCertificate(config.wwdr);
  const pkcs8 = key.export({ type: "pkcs8", format: "der" });
  let cryptoKey: CryptoKey;
  try {
    // Preserve Apple's existing SHA-1 manifest/CMS compatibility. Key operations
    // use native crypto; no JavaScript RSA signature verifier is bundled.
    cryptoKey = await engine.importKey("pkcs8", pkcs8, SIGNING_ALGORITHM, false, ["sign"]);
  } finally {
    pkcs8.fill(0);
  }
  const now = new Date();
  const attributes = [
    new Attribute({ type: "1.2.840.113549.1.9.3", values: [new asn1js.ObjectIdentifier({ value: DATA_OID })] }),
    new Attribute({ type: "1.2.840.113549.1.9.4", values: [new asn1js.OctetString({ valueHex: Uint8Array.from(createHash("sha1").update(manifest).digest()).buffer })] }),
    new Attribute({ type: "1.2.840.113549.1.9.5", values: [now.getUTCFullYear() < 2050 ? new asn1js.UTCTime({ valueDate: now }) : new asn1js.GeneralizedTime({ valueDate: now })] }),
  ].sort((a, b) => Buffer.compare(Buffer.from(a.toSchema().toBER(false)), Buffer.from(b.toSchema().toBER(false))));
  const signed = new SignedData({
    version: 1,
    encapContentInfo: new EncapsulatedContentInfo({ eContentType: DATA_OID }),
    certificates: [signer, wwdr].sort((a, b) => Buffer.compare(Buffer.from(a.toSchema(true).toBER(false)), Buffer.from(b.toSchema(true).toBER(false)))),
    signerInfos: [new SignerInfo({
      version: 1,
      sid: new IssuerAndSerialNumber({ issuer: signer.issuer, serialNumber: signer.serialNumber }),
      signedAttrs: new SignedAndUnsignedAttributes({ type: 0, attributes }),
    })],
  });
  await signed.sign(cryptoKey, 0, "SHA-1", manifest, engine);
  return Buffer.from(new ContentInfo({ contentType: "1.2.840.113549.1.7.2", content: signed.toSchema(true) }).toSchema().toBER(false));
}

export async function createAppleWalletPassArchive(
  payload: AppleWalletPassPayload,
  icons: Readonly<Record<string, Buffer>>,
  config: SigningConfig,
) {
  const files = new Map<string, Buffer>([["pass.json", Buffer.from(JSON.stringify(payload, null, 2))]]);
  for (const name of ICON_NAMES) {
    if (!Buffer.isBuffer(icons[name]) || icons[name].length === 0) throw new Error("Wallet icon is missing.");
    files.set(name, icons[name]);
  }
  const manifest = Buffer.from(JSON.stringify(Object.fromEntries(
    [...files].map(([name, bytes]) => [name, createHash("sha1").update(bytes).digest("hex")]),
  )));
  const signature = await signManifest(manifest, config);
  const archive = new JSZip();
  for (const [name, bytes] of files) archive.file(name, bytes);
  archive.file("manifest.json", manifest);
  archive.file("signature", signature);
  return archive.generateAsync({ type: "nodebuffer", compression: "STORE" });
}
