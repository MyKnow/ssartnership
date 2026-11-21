import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import {
  buildServerLogEntry,
  describeServerError,
  logServerError,
  logServerWarning,
  maskIpAddressForLog,
  redactServerErrorMessage,
} from "../src/lib/server-log.ts";
import { sanitizeLogProperties } from "../src/lib/log-sanitization.ts";

test("server error summaries keep name/code/status and drop provider details", () => {
  const postgrestError = {
    name: "PostgrestError",
    code: "23505",
    message: 'duplicate key value violates unique constraint "members_email_key"',
    details: "Key (email)=(private@example.test) already exists.",
    hint: "private hint",
  };
  assert.deepEqual(describeServerError(postgrestError), {
    name: "PostgrestError",
    code: "23505",
    message: 'duplicate key value violates unique constraint "members_email_key"',
  });
  const error = Object.assign(new Error("upstream failed"), { status: 503, digest: "123abc" });
  assert.deepEqual(describeServerError(error), {
    name: "Error",
    status: 503,
    digest: "123abc",
    message: "upstream failed",
  });
  assert.deepEqual(describeServerError("plain failure"), { message: "plain failure" });
  assert.deepEqual(describeServerError(42), { name: "number" });
  assert.deepEqual(describeServerError(null), {});
  assert.deepEqual(describeServerError({ name: "bad name with spaces", code: "not a safe code!" }), {});
});

test("error messages redact echoed values, credentials, URLs and long numbers", () => {
  const redacted = redactServerErrorMessage(
    'invalid input syntax for type uuid: "member-123" Key (email)=(private@example.test) Bearer abc.def https://storage.example/object?token=x 01012345678 eyJhbGciOi.payload.sig',
  );
  assert.doesNotMatch(redacted, /member-123|private@example|abc\.def|token=x|01012345678|payload\.sig/u);
  assert.match(redacted, /uuid: "\[value\]"/u);
  assert.match(redacted, /Key \(email\)=\(\[value\]\)/u);
  assert.match(redacted, /Bearer \[redacted\]/u);
  assert.ok(redactServerErrorMessage("x".repeat(1000)).length <= 300);
  assert.equal(redactServerErrorMessage("line\nbreak\u0000"), "line break");
});

test("error messages redact credential assignments as well as bearer material", () => {
  const assignments = [
    ["token", "=", "fixture-token"], ["password", ":", "fixture-password"],
    ["api_key", "=", '"fixture-api key"'], ["client-secret", "=", "'fixture-client secret'"],
    ["authorization", "=", "Basic fixture-basic"], ["cookie", "=", "fixture-cookie"],
  ].map((parts) => parts.join(""));
  for (const assignment of assignments) {
    assert.doesNotMatch(redactServerErrorMessage(`failed; ${assignment}; retry later`), /fixture-/);
  }
  assert.equal(redactServerErrorMessage(`fetch failed; ${assignments[0]}`), "fetch failed; token=[redacted]");
});

test("log entries are one sanitized JSON object with bounded event labels", () => {
  const entry = buildServerLogEntry(
    "error",
    "[partner-detail] favorite count fetch failed\nforged",
    new Error("boom"),
    { memberId: "member-1", token: randomUUID(), nested: { password: "x" } },
    new Date("2026-10-05T00:00:00.000Z"),
  );
  assert.deepEqual(entry, {
    level: "error",
    event: "[partner-detail] favorite count fetch failed forged",
    time: "2026-10-05T00:00:00.000Z",
    error: { name: "Error", message: "boom" },
    properties: { memberId: "member-1", token: "[redacted]", nested: { password: "[redacted]" } },
  });
  assert.equal(buildServerLogEntry("warn", "", undefined, null).event, "server_log");
  assert.equal(buildServerLogEntry("warn", "a".repeat(400)).event.length, 160);
  assert.equal("error" in buildServerLogEntry("warn", "x"), false);
  assert.equal("properties" in buildServerLogEntry("warn", "x", undefined, {}), false);
});

test("logServerError writes exactly one JSON line and never throws", (t) => {
  const lines: string[] = [];
  t.mock.method(console, "error", (line: unknown) => { lines.push(String(line)); });
  t.mock.method(console, "warn", (line: unknown) => { lines.push(`warn:${String(line)}`); });
  logServerError("[scope] failed", { code: "PGRST116", message: "x", details: "private" }, { count: 2 });
  logServerWarning("[scope] degraded", { reasonCode: "fallback" });
  const hostile = {} as Record<string, unknown>;
  Object.defineProperty(hostile, "message", { get() { throw new Error("getter"); } });
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  assert.doesNotThrow(() => logServerError("[scope] hostile", hostile, circular));
  assert.equal(lines.length, 3);
  const parsed = JSON.parse(lines[0]);
  assert.equal(parsed.level, "error");
  assert.deepEqual(parsed.error, { code: "PGRST116", message: "x" });
  assert.deepEqual(parsed.properties, { count: 2 });
  assert.doesNotMatch(lines[0], /private/u);
  assert.match(lines[1], /^warn:\{"level":"warn"/u);
  assert.equal(lines[1].includes("\n"), false);
});

test("IP addresses are masked to their network prefix", () => {
  assert.equal(maskIpAddressForLog("203.0.113.77"), "203.0.113.0");
  assert.equal(maskIpAddressForLog("2001:db8:1:2:3:4:5:6"), "2001:db8:1::");
  assert.equal(maskIpAddressForLog("2001:db8::1"), "2001:db8::");
  assert.equal(maskIpAddressForLog("::1"), "0::");
  assert.equal(maskIpAddressForLog(null), null);
  assert.equal(maskIpAddressForLog("not-an-ip"), "[invalid]");
});

test("log sanitizer keeps aggregate boolean flags on sensitive-looking keys", () => {
  assert.deepEqual(
    sanitizeLogProperties({ assignedCode: true, hasPassword: false, code: "123456", sessionToken: "x" }),
    { assignedCode: true, hasPassword: false, code: "[redacted]", sessionToken: "[redacted]" },
  );
});
