import crypto from "crypto";

/**
 * @typedef {"hex" | "base64url"} HmacDigestEncoding
 */

/**
 * @param {string} payload
 * @param {string} secret
 * @param {HmacDigestEncoding} [encoding="hex"]
 * @returns {string}
 */
export function createHmacDigest(
  payload,
  secret,
  encoding = "hex",
) {
  return crypto.createHmac("sha256", secret).update(payload).digest(encoding);
}

/**
 * @param {string} payload
 * @param {string} signature
 * @param {string} secret
 * @param {HmacDigestEncoding} [encoding="hex"]
 * @returns {boolean}
 */
export function verifyHmacDigest(
  payload,
  signature,
  secret,
  encoding = "hex",
) {
  const expected = createHmacDigest(payload, secret, encoding);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (signatureBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
}

/**
 * @param {string} token
 * @returns {[string, string] | null}
 */
export function splitSignedToken(token) {
  const separatorIndex = token.lastIndexOf(".");
  if (separatorIndex <= 0 || separatorIndex >= token.length - 1) {
    return null;
  }
  return [
    token.slice(0, separatorIndex),
    token.slice(separatorIndex + 1),
  ];
}
