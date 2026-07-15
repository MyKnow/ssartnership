import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

type PreviewSyncStorageModule =
  typeof import("../scripts/supabase-sync-preview-storage.mjs");

const previewSyncStoragePromise = import(
  new URL("../scripts/supabase-sync-preview-storage.mjs", import.meta.url).href
) as Promise<PreviewSyncStorageModule>;

test("member profile image Storage 동기화 실패는 Preview 성공으로 숨기지 않는다", async () => {
  const {
    isPreviewRequiredStorageBucket,
    shouldAbortPreviewStorageObjectSync,
  } = await previewSyncStoragePromise;

  assert.equal(isPreviewRequiredStorageBucket("member-profile-images"), true);
  assert.equal(isPreviewRequiredStorageBucket("graduate-certificates"), false);
  assert.equal(
    shouldAbortPreviewStorageObjectSync("member-profile-images"),
    true,
  );
  assert.equal(
    shouldAbortPreviewStorageObjectSync("graduate-certificates"),
    false,
  );
});

test("required profile image object failure aborts the Preview sync", async () => {
  const script = await readFile(
    new URL("../scripts/supabase-sync-preview.mjs", import.meta.url),
    "utf8",
  );

  assert.match(script, /shouldAbortPreviewStorageObjectSync\(bucketName\)/);
  assert.match(
    script,
    /Preview required object \$\{bucketName\}\/\$\{objectPath\} could not be synchronized/,
  );
  assert.match(
    script,
    /Preview required bucket \$\{bucketName\} is missing \$\{missingPaths\.length\} synchronized object\(s\)/,
  );
});

test("isRetryableStorageError treats 5xx storage failures as retryable", async () => {
  const { isRetryableStorageError } = await previewSyncStoragePromise;

  assert.equal(
    isRetryableStorageError({
      message: "Bad Gateway",
      status: 502,
    }),
    true,
  );

  assert.equal(
    isRetryableStorageError({
      message: "Service Unavailable",
      status: 503,
    }),
    true,
  );
});

test("isRetryableStorageError ignores permanent storage failures", async () => {
  const { isRetryableStorageError } = await previewSyncStoragePromise;

  assert.equal(
    isRetryableStorageError({
      message: "permission denied",
      status: 403,
    }),
    false,
  );
});
