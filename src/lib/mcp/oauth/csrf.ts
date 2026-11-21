import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const payloadSchema = z.strictObject({ nonce: z.string().uuid(), adminId: z.string().max(120), purpose: z.string().max(40), binding: z.string().length(64), expiresAt: z.number().int() });
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const signature = (secret: string, body: string) => createHmac("sha256", secret).update(`ssartnership:mcp:consent:v1:${body}`).digest();
export function createMcpConsentToken(secret: string, adminId: string, purpose: string, binding: string, now = Date.now()) {
  const body = Buffer.from(JSON.stringify({ nonce: randomUUID(), adminId, purpose, binding: digest(binding), expiresAt: now + 10 * 60_000 })).toString("base64url");
  return `${body}.${signature(secret,body).toString("base64url")}`;
}
export function verifyMcpConsentToken(secret: string, token: string, adminId: string, purpose: string, binding: string, now = Date.now()) {
  if (token.length > 2048) return null;
  try {
    const [body, mac, extra] = token.split(".");
    if (!body || !mac || extra) return null;
    const expected = signature(secret,body), actual = Buffer.from(mac,"base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual,expected)) return null;
    const parsed = payloadSchema.safeParse(JSON.parse(Buffer.from(body,"base64url").toString("utf8")));
    if (!parsed.success) return null;
    const value = parsed.data;
    return value.adminId === adminId && value.purpose === purpose && value.binding === digest(binding) && value.expiresAt > now && value.expiresAt <= now + 10 * 60_000 ? value.nonce : null;
  } catch { return null; }
}
