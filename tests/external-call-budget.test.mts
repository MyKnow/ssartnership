import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { SELF_HOST_CRON_TIMEOUT_MS } from "../scripts/lib/self-host-cron.mjs";
import { SMTP_TIMEOUTS } from "../src/lib/smtp.ts";
import {
  DEFAULT_SUPABASE_FETCH_TIMEOUT_MS,
  DEFAULT_SUPABASE_STORAGE_FETCH_TIMEOUT_MS,
} from "../src/lib/supabase/timeout.ts";

function readProxyWriteTimeoutMs(path: string) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const match = /timeouts\s*\{[^}]*\bwrite\s+(\d+)s\b/u.exec(source);
  assert.ok(match, `${path} must declare a server write timeout`);
  return Number(match[1]) * 1_000;
}

// docs/operations/reliability.md "외부 호출 상한": a downstream call may not
// outlive the caller that waits for it.
test("downstream call budgets fit inside the cron client and public proxy budgets", () => {
  const proxyWriteMs = Math.min(
    readProxyWriteTimeoutMs("deploy/pve/edge.Caddyfile"),
    readProxyWriteTimeoutMs("deploy/pve/relay.Caddyfile"),
  );

  for (const [name, budgetMs] of [
    ["Supabase REST/RPC/Auth", DEFAULT_SUPABASE_FETCH_TIMEOUT_MS],
    ["Supabase Storage", DEFAULT_SUPABASE_STORAGE_FETCH_TIMEOUT_MS],
    [
      // One resolver try. The Node resolver's own retries are not configurable
      // through nodemailer; reliability.md records that worst case.
      "SMTP DNS try + connect + greeting",
      SMTP_TIMEOUTS.dnsTimeoutMs
        + SMTP_TIMEOUTS.connectionTimeoutMs
        + SMTP_TIMEOUTS.greetingTimeoutMs,
    ],
    ["SMTP idle socket", SMTP_TIMEOUTS.socketTimeoutMs],
  ] as const) {
    assert.ok(budgetMs <= SELF_HOST_CRON_TIMEOUT_MS, `${name} exceeds the cron client budget`);
    assert.ok(budgetMs < proxyWriteMs, `${name} exceeds the public proxy budget`);
  }

  assert.ok(
    DEFAULT_SUPABASE_FETCH_TIMEOUT_MS < DEFAULT_SUPABASE_STORAGE_FETCH_TIMEOUT_MS,
    "Storage transfers keep a longer budget than REST calls",
  );
});
