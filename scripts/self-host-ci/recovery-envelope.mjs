import { constants, createCipheriv, createDecipheriv, createHash, createPrivateKey, createPublicKey, privateDecrypt, publicEncrypt, randomBytes } from "node:crypto";

const SUITE = "RSA-OAEP-SHA256/AES-256-GCM";
const MAX_BYTES = 64 * 1024;
const fingerprint = (key) => createHash("sha256").update(key.export({ type: "spki", format: "der" })).digest("hex");
const aad = (recipient) => Buffer.from(`ssartnership-recovery-keys/v1:${recipient}`);
export function sealRecoveryPayload(publicPem, plaintext) {
  const key = createPublicKey(publicPem);
  if (key.asymmetricKeyType !== "rsa" || key.asymmetricKeyDetails.modulusLength < 3072 || !Buffer.isBuffer(plaintext) || plaintext.length > MAX_BYTES) throw new Error("RECOVERY_RECIPIENT_INVALID");
  const recipient = fingerprint(key);
  const dataKey = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", dataKey, iv);
  cipher.setAAD(aad(recipient));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const wrapped = publicEncrypt({ key, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, dataKey);
  dataKey.fill(0);
  return { version: 1, suite: SUITE, recipient, wrappedKey: wrapped.toString("base64"), iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), ciphertext: ciphertext.toString("base64") };
}
export function openRecoveryPayload(privatePem, envelope) {
  if (!envelope || Object.keys(envelope).sort().join() !== ["version", "suite", "recipient", "wrappedKey", "iv", "tag", "ciphertext"].sort().join() || envelope.version !== 1 || envelope.suite !== SUITE) throw new Error("RECOVERY_ENVELOPE_INVALID");
  const privateKey = createPrivateKey(privatePem);
  const publicKey = createPublicKey(privateKey);
  if (fingerprint(publicKey) !== envelope.recipient) throw new Error("RECOVERY_WRONG_RECIPIENT");
  const decode = (value) => {
    if (typeof value !== "string" || value.length > MAX_BYTES * 2) throw new Error("RECOVERY_ENVELOPE_INVALID");
    const decoded = Buffer.from(value, "base64");
    if (decoded.toString("base64") !== value) throw new Error("RECOVERY_ENCODING_INVALID");
    return decoded;
  };
  const dataKey = privateDecrypt({ key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, decode(envelope.wrappedKey));
  const iv = decode(envelope.iv); const tag = decode(envelope.tag); const ciphertext = decode(envelope.ciphertext);
  if (dataKey.length !== 32 || iv.length !== 12 || tag.length !== 16 || ciphertext.length > MAX_BYTES) throw new Error("RECOVERY_ENVELOPE_INVALID");
  try {
    const decipher = createDecipheriv("aes-256-gcm", dataKey, iv);
    decipher.setAAD(aad(envelope.recipient)); decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } finally { dataKey.fill(0); }
}
