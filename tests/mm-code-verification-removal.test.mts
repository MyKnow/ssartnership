import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = new URL("..", import.meta.url).pathname;

function repoPath(path: string) {
  return join(repoRoot, path);
}

test("legacy MM signup verification endpoints are removed", () => {
  const removedPaths = [
    "src/app/api/mm/request-code/route.ts",
    "src/app/api/mm/verify-code/route.ts",
    "src/app/api/mm/_shared/request-code.ts",
    "src/app/api/mm/_shared/verify-code.ts",
    "src/app/api/mm/_shared/request-code-delivery.ts",
    "src/app/api/mm/_shared/verify-code-member.ts",
  ];

  for (const path of removedPaths) {
    assert.equal(existsSync(repoPath(path)), false, `${path} should be removed`);
  }
});

test("MM signup verification storage and secret are no longer documented", () => {
  const envExample = readFileSync(repoPath(".env.example"), "utf8");
  const schema = readFileSync(repoPath("supabase/schema.sql"), "utf8");

  assert.equal(envExample.includes("MM_VERIFICATION_SECRET"), false);
  assert.equal(schema.includes("create table if not exists mm_verification_codes"), false);
  assert.equal(schema.includes("create table if not exists mm_verification_attempts"), false);
});

test("SSAFY Verify transition TODOs preserve unresolved decisions", () => {
  const todo = readFileSync(repoPath("docs/product/todo.md"), "utf8");

  assert.match(todo, /SSAFY Verify 전환 후속/);
  assert.match(todo, /members\.mm_user_id/);
  assert.match(todo, /Mattermost 알림/);
});
