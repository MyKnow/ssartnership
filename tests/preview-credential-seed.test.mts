import assert from "node:assert/strict";
import test from "node:test";
import {
  hashPreviewSeedPassword,
  isValidPreviewSeedPassword,
  resolvePreviewMemberCredentialSeedConfig,
} from "../scripts/preview-credential-seed-lib.mjs";

test("preview credential seed config is optional", () => {
  assert.equal(resolvePreviewMemberCredentialSeedConfig({}), null);
});

test("preview credential seed config requires username and password together", () => {
  assert.throws(
    () =>
      resolvePreviewMemberCredentialSeedConfig({
        PREVIEW_TEST_MEMBER_USERNAME: "ssafy15",
      }),
    /must be provided together/,
  );
  assert.throws(
    () =>
      resolvePreviewMemberCredentialSeedConfig({
        PREVIEW_TEST_MEMBER_PASSWORD: "Strong!123",
      }),
    /must be provided together/,
  );
});

test("preview credential seed config normalizes username", () => {
  assert.deepEqual(
    resolvePreviewMemberCredentialSeedConfig({
      PREVIEW_TEST_MEMBER_USERNAME: "  SSAFY15.User  ",
      PREVIEW_TEST_MEMBER_PASSWORD: "Strong!123",
    }),
    {
      username: "ssafy15.user",
      password: "Strong!123",
    },
  );
});

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
