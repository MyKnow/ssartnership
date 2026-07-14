import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sanitizationModulePromise = import(
  new URL("../src/lib/log-sanitization.ts", import.meta.url).href,
);
const productEventContractModulePromise = import(
  new URL("../src/lib/product-event-contract.ts", import.meta.url).href,
);
const requestBodyLimitModulePromise = import(
  new URL("../src/lib/request-body-limit.ts", import.meta.url).href,
);

const schemaSql = readFileSync(
  new URL("../supabase/schema.sql", import.meta.url),
  "utf8",
);
const activityLogsSource = readFileSync(
  new URL("../src/lib/activity-logs.ts", import.meta.url),
  "utf8",
);
const productEventRouteSource = readFileSync(
  new URL("../src/app/api/events/product/route.ts", import.meta.url),
  "utf8",
);

test("all log sinks recursively redact credentials while keeping stable reason codes", async () => {
  const { sanitizeLogProperties } = await sanitizationModulePromise;
  const credentialKey = ["pass", "word"].join("");

  assert.deepEqual(
    sanitizeLogProperties({
      [credentialKey]: "redaction-test-value",
      nested: {
        Authorization: "Bearer secret",
        clientSecret: "client-secret",
        reasonCode: "invalid_signature",
        errorCode: "invalid_payload",
        code: "one-time-code",
        callbackUrl: "https://ssartnership.example/partner/setup/one-time-token?code=secret",
      },
      sessions: [{ refresh_token: "refresh-token" }],
    }),
    {
      [credentialKey]: "[redacted]",
      nested: {
        Authorization: "[redacted]",
        clientSecret: "[redacted]",
        reasonCode: "invalid_signature",
        errorCode: "invalid_payload",
        code: "[redacted]",
        callbackUrl: "https://ssartnership.example/partner/setup/[token]",
      },
      sessions: "[redacted]",
    },
  );
});

test("log property truncation never exceeds its serialized byte ceiling", async () => {
  const { sanitizeLogProperties } = await sanitizationModulePromise;
  const properties = Object.fromEntries(
    Array.from({ length: 40 }, (_, index) => [
      `key${index}`,
      "x".repeat(199),
    ]),
  );

  const sanitized = sanitizeLogProperties(properties);
  assert.ok(
    new TextEncoder().encode(JSON.stringify(sanitized)).byteLength <= 8 * 1024,
  );
});

test("product event input accepts the versioned envelope and strips unapproved properties", async () => {
  const { parseProductEventRequest } = await productEventContractModulePromise;
  const credentialKey = ["pass", "word"].join("");

  const event = parseProductEventRequest({
    eventId: "d46d0f71-fb92-4a73-b0b6-40c44e5e18d6",
    schemaVersion: 1,
    occurredAt: "2026-07-14T12:44:03.000Z",
    eventName: "search_execute",
    sessionId: "39fc1e67-235e-48c8-9bd7-b9aa70a4cfbf",
    path: "/?token=do-not-store",
    referrer: "https://ssartnership.example/verify/secret?code=do-not-store",
    targetType: "partner_search",
    properties: {
      query: "private search text",
      queryLength: 19,
      categoryKey: "food",
      resultCount: 3,
      [credentialKey]: "redaction-test-value",
    },
  });

  assert.deepEqual(event.properties, {
    queryLength: 19,
    categoryKey: "food",
    resultCount: 3,
  });
  assert.equal(event.path, "/");
  assert.equal(event.referrer, "https://ssartnership.example/verify/[token]");
});

test("product event input rejects an unversioned or malformed idempotency envelope", async () => {
  const { parseProductEventRequest } = await productEventContractModulePromise;

  assert.throws(() =>
    parseProductEventRequest({
      eventName: "page_view",
      properties: { area: "site" },
    }),
  );
  assert.throws(() =>
    parseProductEventRequest({
      eventId: "not-a-uuid",
      schemaVersion: 1,
      occurredAt: "2026-07-14T12:44:03.000Z",
      eventName: "page_view",
      properties: { area: "site" },
    }),
  );
});

test("public product ingestion rejects server-only events and invalid target combinations", async () => {
  const { parseProductEventRequest } = await productEventContractModulePromise;
  const baseEvent = {
    eventId: "d46d0f71-fb92-4a73-b0b6-40c44e5e18d6",
    schemaVersion: 1,
    occurredAt: "2026-07-14T12:44:03.000Z",
    properties: {},
  };

  assert.throws(() =>
    parseProductEventRequest({
      ...baseEvent,
      eventName: "coupon_redeem",
    }),
  );
  assert.throws(() =>
    parseProductEventRequest({
      ...baseEvent,
      eventName: "page_view",
      targetType: "unapproved_target",
      targetId: "private-value",
    }),
  );
});

test("product event input accepts the repository's bounded mock partner identifiers", async () => {
  const { parseProductEventRequest } = await productEventContractModulePromise;

  const event = parseProductEventRequest({
    eventId: "d46d0f71-fb92-4a73-b0b6-40c44e5e18d6",
    schemaVersion: 1,
    occurredAt: "2026-07-14T12:44:03.000Z",
    eventName: "partner_card_click",
    targetType: "partner",
    targetId: "health-001",
    properties: { categoryKey: "health", source: "card_surface" },
  });

  assert.equal(event.targetId, "health-001");
});

test("product ingestion stops reading and cancels a streaming body above its byte limit", async () => {
  const { RequestBodyTooLargeError, readRequestBodyWithinLimit } =
    await requestBodyLimitModulePromise;
  const chunks = [new TextEncoder().encode("small"), new Uint8Array(12)];
  let nextChunk = 0;
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[nextChunk++];
      if (!chunk) {
        controller.close();
        return;
      }

      controller.enqueue(chunk);
    },
    cancel() {
      cancelled = true;
    },
  });

  await assert.rejects(
    readRequestBodyWithinLimit(body, 8),
    RequestBodyTooLargeError,
  );
  assert.equal(cancelled, true);
});

test("product endpoint uses the bounded stream reader instead of buffering request text", () => {
  assert.match(productEventRouteSource, /readRequestBodyWithinLimit\(\s*request\.body/);
  assert.doesNotMatch(productEventRouteSource, /request\.text\(\)/);
});

test("event logs retain an idempotency and correlation envelope", () => {
  assert.match(schemaSql, /event_id\s+uuid/i);
  assert.match(schemaSql, /schema_version\s+integer/i);
  assert.match(schemaSql, /occurred_at\s+timestamp\s+with\s+time\s+zone/i);
  assert.match(schemaSql, /recorded_at\s+timestamp\s+with\s+time\s+zone/i);
  assert.match(schemaSql, /request_id\s+text/i);
  assert.match(
    schemaSql,
    /create\s+unique\s+index\s+if\s+not\s+exists\s+event_logs_event_id_key[\s\S]*?on\s+(?:public\.)?event_logs\s*\(event_id\)[\s\S]*?where\s+event_id\s+is\s+not\s+null/i,
  );
  assert.match(
    schemaSql,
    /create\s+or\s+replace\s+function\s+public\.ingest_product_event\(/i,
  );
  assert.match(
    schemaSql,
    /on\s+conflict\s*\(event_id\)\s+where\s+event_id\s+is\s+not\s+null\s+do\s+nothing/i,
  );
});

test("product event persistence uses one atomic ingestion path without rollup fallback", () => {
  assert.match(activityLogsSource, /\.rpc\(['"]ingest_product_event['"]/);
  assert.doesNotMatch(activityLogsSource, /upsertPartnerMetricRollupsFromEventInput/);
  assert.doesNotMatch(activityLogsSource, /shouldRunPartnerMetricFallback/);
});
