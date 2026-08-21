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
    /Preview required object in \$\{bucketName\} could not be synchronized/,
  );
  assert.doesNotMatch(script, /(?:Downloading|Uploading|Skipping object).*\$\{objectPath\}/);
  assert.doesNotMatch(script, /could not be synchronized[^\n]*\$\{objectPath\}/);
  assert.match(
    script,
    /Preview required bucket \$\{bucketName\} is missing \$\{missingPaths\.length\} synchronized object\(s\)/,
  );
});

test("storage diagnostics retain status and code without private object paths", async () => {
  const { createSafeStorageOperationError, formatStorageError } =
    await previewSyncStoragePromise;
  const formatted = formatStorageError({
    message: "failed member-profile-images/private/member-id/photo.webp",
    status: 504,
    code: "gateway_timeout",
  });

  assert.equal(formatted, "status=504,code_present=true");
  assert.doesNotMatch(formatted, /member|private|photo\.webp/);
  assert.equal(
    formatStorageError({ message: "private/path.webp", code: "unsafe/path" }),
    "code_present=true",
  );

  const wrapped = createSafeStorageOperationError(
    "Preview member profile image storage could not be synchronized",
    {
      message: "failed member-profile-images/private/member-id/photo.webp",
      status: 504,
      code: "gateway_timeout",
    },
  );
  assert.equal(
    wrapped.message,
    "Preview member profile image storage could not be synchronized: status=504,code_present=true",
  );
  assert.equal(formatStorageError(wrapped), "status=504,code_present=true");
  assert.doesNotMatch(wrapped.stack ?? "", /private|photo\.webp/);

  const wrappedAgain = createSafeStorageOperationError(
    "Preview member profile image storage could not be synchronized",
    wrapped,
  );
  assert.equal(
    formatStorageError(wrappedAgain),
    "status=504,code_present=true",
  );
  assert.doesNotMatch(wrappedAgain.stack ?? "", /private|photo\.webp/);
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

test("withStorageRetry retries a transient 504 with bounded exponential backoff", async (t) => {
  const { withStorageRetry } = await previewSyncStoragePromise;
  let attempts = 0;
  const retryDiagnostics: string[] = [];
  t.mock.method(console, "warn", (message: unknown) => {
    retryDiagnostics.push(String(message));
  });

  const result = await withStorageRetry(
    "Listing production objects in member-profile-images",
    async () => {
      attempts += 1;
      if (attempts < 5) {
        throw { message: "Gateway Timeout", status: 504 };
      }
      return "synced";
    },
    { baseDelayMs: 1 },
  );

  assert.equal(result, "synced");
  assert.equal(attempts, 5);
  assert.deepEqual(
    retryDiagnostics.map((diagnostic) => diagnostic.match(/Retrying in (\d+)ms/)?.[1]),
    ["1", "2", "4", "8"],
  );
});

test("withStorageRetry does not retry a permanent 4xx storage failure", async () => {
  const { withStorageRetry } = await previewSyncStoragePromise;
  let attempts = 0;

  await assert.rejects(
    withStorageRetry(
      "Listing production objects in member-profile-images",
      async () => {
        attempts += 1;
        throw { message: "permission denied", status: 403 };
      },
      { baseDelayMs: 0 },
    ),
  );

  assert.equal(attempts, 1);
});
