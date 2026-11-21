import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  hashPreviewSeedPassword,
  isValidPreviewSeedPassword,
} from "../scripts/self-host-environments/preview-credential.mjs";

test("preview credential seed password follows app password policy", () => {
  assert.equal(isValidPreviewSeedPassword("Strong!123"), true);
  assert.equal(isValidPreviewSeedPassword("short!1"), false);
  assert.equal(isValidPreviewSeedPassword("NoNumber!"), false);
  assert.equal(isValidPreviewSeedPassword("NoSymbol123"), false);
});

test("preview credential seed hash creates pbkdf2-shaped values", () => {
  const first = hashPreviewSeedPassword("Strong!123");
  const second = hashPreviewSeedPassword("Strong!123");

  assert.match(first.salt, /^[a-f0-9]{32}$/);
  assert.match(first.hash, /^[a-f0-9]{128}$/);
  assert.notEqual(first.salt, second.salt);
  assert.notEqual(first.hash, second.hash);
});

test("Preview 전용 회원 비밀번호 seed는 원본 Preview CLI에서만 쓰고 식별자를 출력하지 않는다", () => {
  const cliSource = readFileSync(
    new URL("../scripts/self-host-environments/cli.mjs", import.meta.url),
    "utf8",
  );

  assert.match(cliSource, /from "\.\/preview-credential\.mjs"/u);
  assert.match(cliSource, /seed-preview-member/u);
  assert.match(cliSource, /return \{ seeded: true, environment: "preview" \}/u);
  assert.doesNotMatch(cliSource, /PREVIEW_TEST_MEMBER_/u);
});
