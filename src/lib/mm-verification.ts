import crypto from "crypto";

export function generateCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function hashCode(code: string) {
  const secret = process.env.USER_SESSION_SECRET ?? "";
  return crypto.createHmac("sha256", secret).update(code).digest("hex");
}
