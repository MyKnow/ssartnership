import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

/**
 * Files that may still mention Vercel. Each entry is a known, owned removal
 * rather than a supported platform path:
 * - client IP trust contract: `client-ip.ts`, the partner setup request id, and
 *   the matching `VERCEL` legacy entry in the env manifest;
 * - self-hosted runtime settings: the non-standalone build comment in
 *   `next.config.ts`.
 * The list may only shrink; removing a mention keeps this test green.
 */
const PENDING_VERCEL_REFERENCES = new Set([
  "next.config.ts",
  "scripts/lib/env-manifest.mjs",
  "src/app/api/partner/setup/[token]/route.ts",
  "src/lib/client-ip.ts",
]);

function trackedFiles(prefixes: string[]) {
  return execFileSync("git", ["ls-files", "-z", "--", ...prefixes], {
    cwd: repositoryRoot,
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean);
}

test("런타임·스크립트·배포·워크플로에는 승인된 제거 대상 외 Vercel 분기가 없다", () => {
  const offenders = trackedFiles(["src", "scripts", "deploy", ".github", "next.config.ts", "Dockerfile"])
    .filter((path) => /\.(?:[cm]?[jt]sx?|ya?ml|json|Caddyfile|conf|service|sh|py)$|Dockerfile$/u.test(path))
    .filter((path) => /vercel/iu.test(readFileSync(new URL(`../${path}`, import.meta.url), "utf8")))
    .filter((path) => !PENDING_VERCEL_REFERENCES.has(path));

  assert.deepEqual(offenders, []);
});

test("vercel.app 기본 주소는 코드와 스토리에서 사라졌다", () => {
  const offenders = trackedFiles(["src", "scripts", "deploy"])
    .filter((path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8").includes("ssartnership.vercel.app"));

  assert.deepEqual(offenders, []);
});
