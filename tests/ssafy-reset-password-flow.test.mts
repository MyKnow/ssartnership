import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = new URL("..", import.meta.url).pathname;

function readRepoFile(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

test("reset password form starts SSAFY Verify directly", () => {
  const source = readRepoFile("src/components/auth/ResetPasswordForm.tsx");

  assert.match(source, /window\.ssafyVerify/);
  assert.match(source, /\/api\/ssafy\/reset-password/);
  assert.doesNotMatch(source, /\/api\/mm\/reset-password"/);
  assert.doesNotMatch(source, /\/api\/mm\/reset-password\/verify/);
  assert.doesNotMatch(source, /인증번호/);
});

test("reset password completion no longer depends on stored verification codes", () => {
  const source = readRepoFile("src/app/api/mm/_shared/reset-password-complete.ts");

  assert.doesNotMatch(source, /reset-password-code-store/);
  assert.doesNotMatch(source, /password_reset_codes/);
  assert.match(source, /memberUpdatedAt/);
});
