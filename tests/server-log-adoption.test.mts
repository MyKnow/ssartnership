import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.(ts|tsx)$/u.test(name) && !/\.(test|stories)\.tsx?$/u.test(name) ? [path] : [];
  });
}

// Raw error objects, provider error messages and caught values must go through
// logServerError so Docker logs keep one sanitized JSON line per failure.
// An error-like value is a bare caught name (`error`, `err`, `e`, `cause`, ...)
// or a name ending in Error/Failure, optionally reached by member access
// (`result.error`). Object arguments must not carry `error` or a `.message`
// read from such a value.
const ERROR_NAME = String.raw`(?:[A-Za-z_$][\w$]*(?:Error|Errors|Failure|Failures)|e|err|error|errors|reason|failure|failures|cause|caught)`;
const ERROR_VALUE = String.raw`(?:[A-Za-z_$][\w$]*\??\.)*${ERROR_NAME}`;
const LOG_LABEL = String.raw`(?:"[^"]*"|'[^']*'|\x60[^\x60]*\x60)`;
const RAW_ERROR_CONSOLE = new RegExp(
  String.raw`console\.(?:error|warn)\(\s*(?:${LOG_LABEL}\s*,\s*)?(?:${ERROR_VALUE}(?:\??\.message)?\s*[,)]|[A-Za-z_$][\w$]* instanceof Error \?|\{[^{}]*(?:\berror\b\s*(?:[,:]|(?=\}))|${ERROR_VALUE}\??\.message\b)[^{}]*\})`,
  "u",
);

test("the raw error log pattern flags caught values and provider messages only", () => {
  const raw = [
    `console.error("[x] failed", error);`,
    `console.error("[x] failed", err);`,
    `console.warn("[x] failed", e, { id });`,
    `console.error(error);`,
    `console.error("[x] failed", upsertError);`,
    `console.error("[x] failed", result.error);`,
    `console.error("[x] failed", error.message);`,
    `console.error("[x] failed", error instanceof Error ? error.message : error);`,
    `console.error("[x] failed", { error });`,
    `console.error("[x] failed", { accountId, message: error.message });`,
    `console.error("[x] failed", {\n  partnerError: partnerResult.error?.message ?? null,\n});`,
    `console.error("[x] failed", { message: error instanceof Error ? error.message : "unknown" });`,
  ];
  const safe = [
    `console.error("[x] failed");`,
    `console.error("[x] failed", { code: error.code });`,
    `console.error("[x] failed", { name: error instanceof Error ? error.name : "unknown" });`,
    `console.error("[x] failed", { errorCode, reasonCode: "query_failed" });`,
    `console.error("[x] failed", errors.length);`,
    `console.error("[x] failed", diagnostic);`,
    `console.error("[x] failed", toEmailDeliveryConfigErrorLog(error));`,
  ];
  for (const sample of raw) assert.match(sample, RAW_ERROR_CONSOLE, sample);
  for (const sample of safe) assert.doesNotMatch(sample, RAW_ERROR_CONSOLE, sample);
});

test("server code never logs raw error objects or provider messages directly", () => {
  const offenders: string[] = [];
  for (const file of walk(join(root, "src"))) {
    const source = readFileSync(file, "utf8");
    if (/^["']use client["'];?/mu.test(source.slice(0, 200))) continue;
    const pattern = new RegExp(RAW_ERROR_CONSOLE.source, "gu");
    for (const match of source.matchAll(pattern)) {
      const line = source.slice(0, match.index).split("\n").length;
      offenders.push(`${relative(root, file)}:${line}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test("the admin edge guard logs only a masked client network", () => {
  const proxy = readFileSync(join(root, "src/proxy.ts"), "utf8");
  assert.doesNotMatch(proxy, /ipAddress: clientIp\b/u);
  assert.equal(proxy.match(/ipAddress: maskIpAddressForLog\(clientIp\)/gu)?.length, 2);
});

test("partner setup failures never log the setup token or provider details", () => {
  const setup = readFileSync(join(root, "src/lib/partner-auth/setup.ts"), "utf8");
  assert.doesNotMatch(setup, /maskPartnerSetupToken|errorDetails|errorHint/u);
});
