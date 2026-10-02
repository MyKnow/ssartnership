import { createHash, ECDH } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { lookup } from "node:dns/promises";

const HOSTS = new Set(["android.googleapis.com", "fcm.googleapis.com", "push.services.mozilla.com", "updates.push.services.mozilla.com", "web.push.apple.com"]);
export function validatedOperatorSubscription(input) {
  try {
    const u = new URL(input.endpoint);
    if (u.protocol !== "https:" || u.username || u.password || u.hash || u.port || input.endpoint.length > 4096
      || !(HOSTS.has(u.hostname) || u.hostname.endsWith(".push.apple.com") || u.hostname.endsWith(".notify.windows.com"))) return null;
    const key = Buffer.from(input.keys?.p256dh ?? "", "base64url"), auth = Buffer.from(input.keys?.auth ?? "", "base64url");
    if (key.length !== 65 || auth.length !== 16) return null;
    ECDH.convertKey(key, "prime256v1");
    return { endpoint: u.href, keys: { p256dh: key.toString("base64url"), auth: auth.toString("base64url") } };
  } catch { return null; }
}

function publicAddress(address) {
  if (address.includes(":")) return !/^(::|fc|fd|fe80|ff)/iu.test(address);
  const [a, b] = address.split(".").map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127));
}

/**
 * Separate infra custody of ONLY the operator's subscriptions; no app/DB call.
 * @param {{ env?: NodeJS.ProcessEnv, deliver?: typeof fetch, resolveHost?: (hostname: string) => Promise<import('node:dns').LookupAddress[]>, library?: { generateRequestDetails: (subscription: { endpoint: string, keys: { p256dh: string, auth: string } }, payload: string, options: object) => { endpoint: string, headers: Record<string, string>, body?: BodyInit } } }} [options]
 */
export function createOperatorPush({ env = process.env, deliver = fetch, resolveHost = hostname => lookup(hostname, { all: true }), library } = {}) {
  if (!env.OPS_PUSH_SUBSCRIPTIONS_FILE) return { configured: false, count: 0, send: null };
  const records = JSON.parse(readFileSync(env.OPS_PUSH_SUBSCRIPTIONS_FILE, "utf8"));
  if (!Array.isArray(records) || records.length > 10 || !env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) throw new Error("PWA_PUSH_CONFIG");
  const subscriptions = records.map(validatedOperatorSubscription);
  if (subscriptions.some(s => !s)) throw new Error("PWA_SUBSCRIPTION_INVALID");
  const webpush = library ?? createRequire(import.meta.url)("web-push");
  const unique = [...new Map(subscriptions.map(s => [s.endpoint, s])).values()];
  return { configured: unique.length > 0, count: unique.length, async send(payload, context) {
    let failed = false;
    for (const s of unique) {
      const id = createHash("sha256").update(s.endpoint).digest("hex");
      if (context.delivered.includes(id)) continue;
      try {
        const addresses = await resolveHost(new URL(s.endpoint).hostname);
        if (!addresses.length || addresses.some(a => !publicAddress(a.address))) throw new Error();
        const request = webpush.generateRequestDetails(s, JSON.stringify(payload), { vapidDetails: { subject: env.VAPID_SUBJECT, publicKey: env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY }, TTL: 300, urgency: "high", topic: context.eventKey.slice(0, 32) });
        const r = await deliver(request.endpoint, { method: "POST", redirect: "error", signal: AbortSignal.timeout(5000), headers: request.headers, body: request.body });
        await r.body?.cancel(); if (!r.ok) throw new Error();
        context.markDelivered(id);
      } catch { failed = true; }
    }
    if (failed) throw new Error("PWA_PUSH_DELIVERY_FAILED");
  } };
}
