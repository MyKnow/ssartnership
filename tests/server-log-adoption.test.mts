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
const RAW_ERROR_CONSOLE = /console\.(?:error|warn)\(\s*(?:"[^"]*"|'[^']*'|`[^`]*`)\s*,\s*(?:[A-Za-z_$][\w$]*(?:\??\.[A-Za-z_$][\w$]*)*(?:[Ee]rror|[Ee]rrors|reason|failure|[Ff]ailures|cause|\.message)|[A-Za-z_$][\w$]* instanceof Error \?|\{[^{}]*\berror\b(?:\s*[,}]|\s*:)[^{}]*\})\s*,?\s*\)/u;

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
