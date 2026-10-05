import assert from "node:assert/strict";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { readSource } from "./support/read-source.ts";

/**
 * The partner portal modules moved from flat `src/lib/partner-portal*.ts`
 * files into `src/lib/partner-auth/portal*.ts`. A wrong import path fails the
 * type check, but a stale `vi.mock` key or module stub key does not: the
 * loader quietly resolves the real module and the test loses its isolation.
 */

const root = fileURLToPath(new URL("../", import.meta.url));

const MOVED_PORTAL_MODULES = [
  "portal",
  "portal-errors",
  "portal-layout",
  "portal-metric-access",
  "portal-paths",
  "portal-scope",
] as const;

// Matches the quoted alias of a pre-move flat module. The mock store under
// `src/lib/mock/partner-portal/` is a different module and does not match.
const PRE_MOVE_ALIAS_SPECIFIER = /["']@\/lib\/partner-portal(?:-[a-z-]+)?(?:\.ts)?["']/u;

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.(?:ts|tsx|mts)$/u.test(name) ? [path] : [];
  });
}

test("partner portal modules live only in the partner-auth directory", () => {
  for (const name of MOVED_PORTAL_MODULES) {
    assert.equal(existsSync(join(root, `src/lib/partner-auth/${name}.ts`)), true, name);
    assert.equal(existsSync(join(root, `src/lib/partner-${name}.ts`)), false, `partner-${name}`);
  }
});

test("no import, vi.mock key or module stub key names a pre-move partner portal path", () => {
  const offenders: string[] = [];
  for (const file of [...walk(join(root, "src")), ...walk(join(root, "tests"))]) {
    const path = relative(root, file);
    readSource(path)
      .split("\n")
      .forEach((line, index) => {
        if (PRE_MOVE_ALIAS_SPECIFIER.test(line)) {
          offenders.push(`${path}:${index + 1}`);
        }
      });
  }
  assert.deepEqual(offenders, []);
});
