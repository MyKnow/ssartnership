import assert from "node:assert/strict";
import test from "node:test";

type PreviewSyncStorageModule =
  typeof import("../scripts/supabase-sync-preview-storage.mjs");

const previewSyncStoragePromise = import(
  new URL("../scripts/supabase-sync-preview-storage.mjs", import.meta.url).href,
) as Promise<PreviewSyncStorageModule>;

test("isPreviewRedactedStorageBucket identifies production profile-image storage", async () => {
  const { isPreviewRedactedStorageBucket, isPreviewRedactedStoragePath } =
    await previewSyncStoragePromise;

  assert.equal(isPreviewRedactedStorageBucket("member-profile-images"), true);
  assert.equal(isPreviewRedactedStorageBucket("graduate-certificates"), false);
  assert.equal(
    isPreviewRedactedStoragePath(
      "member-profile-images",
      "members/member-1/photo.webp",
    ),
    true,
  );
  assert.equal(
    isPreviewRedactedStoragePath(
      "member-profile-images",
      "graduate-requests/request-1/photo.webp",
    ),
    false,
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
