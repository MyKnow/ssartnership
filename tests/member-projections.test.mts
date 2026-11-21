import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import * as projections from "../src/lib/members/projections.ts";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

function listSourceFiles(directory: string): string[] {
  const absolute = join(repoRoot, directory);
  return readdirSync(absolute).flatMap((entry) => {
    const path = join(absolute, entry);
    if (statSync(path).isDirectory()) {
      return listSourceFiles(relative(repoRoot, path));
    }
    return /\.(ts|tsx)$/.test(entry) ? [relative(repoRoot, path)] : [];
  });
}

const selectConstants = Object.entries(
  projections as Record<string, unknown>,
).filter(
  (entry): entry is [string, string] =>
    entry[0].endsWith("_SELECT") && typeof entry[1] === "string",
);

test("회원 프로젝션 상수는 컬럼 목록이 서로 겹치지 않고 비어 있지 않다", () => {
  assert.ok(selectConstants.length >= 6);
  const values = selectConstants.map(([, value]) => value);
  assert.equal(new Set(values).size, values.length);
  for (const [name, value] of selectConstants) {
    assert.match(value, /^id(,[a-z_]+)+$/, name);
    assert.doesNotMatch(value, /\*/, name);
  }
  assert.equal(
    projections.MEMBER_EMAIL_RECOVERY_SELECT,
    `${projections.MEMBER_LOGIN_SELECT},auth_session_version`,
  );
});

test("회원 프로젝션 문자열은 projections.ts 밖에서 다시 선언하지 않는다", () => {
  const sources = listSourceFiles("src").filter(
    (path) => path !== "src/lib/members/projections.ts",
  );
  for (const [name, value] of selectConstants) {
    const duplicates = sources.filter((path) =>
      readFileSync(join(repoRoot, path), "utf8").includes(`"${value}"`),
    );
    assert.deepEqual(duplicates, [], `${name} literal must come from projections.ts`);
  }
});
