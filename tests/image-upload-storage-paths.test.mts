import assert from "node:assert/strict";
import test from "node:test";
import { buildStagingPath, buildProcessedPath } from "../src/lib/image-upload/storage-paths.ts";

test("staging stores only a normalized extension, never a user-supplied directory or name", () => {
  assert.equal(buildStagingPath("session", "../../private/PHOTO.PNG"), "staging/session.png");
  for (const name of ["photo", "photo.toolongextension", "photo.svg?key=private", "photo.日本語"]) {
    assert.equal(buildStagingPath("session", name), "staging/session.source");
  }
  assert.equal(buildProcessedPath("session"), "processed/session.webp");
});
