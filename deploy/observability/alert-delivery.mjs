import { createHash } from "node:crypto";

const EMAIL = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/u;

// Configuration is operator-owned and separate from the app's runtime secrets.
export function alertDeliveryConfiguration(env) {
  const emailKeys = ["OPS_ALERT_EMAIL_TO", "OPS_ALERT_EMAIL_FROM", "OPS_ALERT_RESEND_API_KEY"];
  if (emailKeys.some(key => env[key])) {
    if (env.OPS_ALERT_WEBHOOK_URL || !emailKeys.every(key => typeof env[key] === "string" && env[key].length <= 320)
      || !EMAIL.test(env.OPS_ALERT_EMAIL_TO) || !EMAIL.test(env.OPS_ALERT_EMAIL_FROM)
      || !/^re_[A-Za-z0-9_-]{16,}$/u.test(env.OPS_ALERT_RESEND_API_KEY)) return null;
    return { kind: "email", to: env.OPS_ALERT_EMAIL_TO, from: env.OPS_ALERT_EMAIL_FROM, key: env.OPS_ALERT_RESEND_API_KEY };
  }
  try {
    const url = new URL(env.OPS_ALERT_WEBHOOK_URL);
    if (url.protocol !== "https:" || url.username || url.password || url.hash) return null;
    return { kind: "webhook", url: url.href };
  } catch { return null; }
}

export async function deliverOperationalAlert(config, text, payload, deliver = fetch) {
  if (!config) throw new Error("ALERT_NOT_CONFIGURED");
  const headers = { "Content-Type": "application/json" };
  let url, body;
  if (config.kind === "email") {
    url = "https://api.resend.com/emails";
    headers.Authorization = `Bearer ${config.key}`;
    // Hash notification identity locally; arbitrary labels/annotations never leave.
    // Status and event time distinguish recovery and subsequent incidents.
    // Retries/repeated notifications for one event are deduplicated for 24h.
    const identity = JSON.stringify({ text, groupKey: payload.groupKey ?? "", alerts: payload.alerts.map(a => [a.startsAt ?? "", a.endsAt ?? ""]) });
    headers["Idempotency-Key"] = `ops-${createHash("sha256").update(identity).digest("hex")}`;
    body = { from: config.from, to: [config.to], subject: "[싸트너십] 운영 장애·복구 알림", text };
  } else { url = config.url; body = { text }; }
  const result = await deliver(url, { method: "POST", redirect: "error", signal: AbortSignal.timeout(5000), headers, body: JSON.stringify(body) });
  await result.body?.cancel();
  if (!result.ok) throw new Error("ALERT_DELIVERY_FAILED");
}
