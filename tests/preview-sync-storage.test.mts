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

test("Preview Storage 복사는 공개 버킷과 비공개 프로필 이미지 버킷에만 도달한다", async () => {
  const {
    getPreviewStorageBucketName,
    shouldSyncPreviewStorageBucket,
  } = await previewSyncStoragePromise;
  const discoveredBuckets = [
    { id: "review-media", name: "review-media", public: true },
    { id: "partner-media", name: "partner-media", public: true },
    {
      id: "member-profile-images",
      name: "member-profile-images",
      public: false,
    },
    {
      id: "graduate-certificates",
      name: "graduate-certificates",
      public: false,
    },
    {
      id: "manual-member-import-staging",
      name: "manual-member-import-staging",
      public: false,
    },
    {
      id: "image-upload-staging",
      name: "image-upload-staging",
      public: false,
    },
    { id: "unknown-private-bucket", public: false },
  ];
  const reachedCopyOperations = discoveredBuckets
    .filter(shouldSyncPreviewStorageBucket)
    .map(getPreviewStorageBucketName);

  assert.deepEqual(reachedCopyOperations, [
    "review-media",
    "partner-media",
    "member-profile-images",
  ]);
  for (const excludedBucket of [
    "graduate-certificates",
    "manual-member-import-staging",
    "image-upload-staging",
    "unknown-private-bucket",
  ]) {
    assert.equal(reachedCopyOperations.includes(excludedBucket), false);
  }
});

test("Preview Storage 선택은 알 수 없거나 비정상인 버킷 메타데이터를 거부한다", async () => {
  const {
    isInvalidPreviewRequiredStorageBucket,
    shouldSyncPreviewStorageBucket,
  } = await previewSyncStoragePromise;

  assert.equal(shouldSyncPreviewStorageBucket(null), false);
  assert.equal(shouldSyncPreviewStorageBucket({}), false);
  assert.equal(
    shouldSyncPreviewStorageBucket({
      id: "unknown-private-bucket",
      public: false,
    }),
    false,
  );
  assert.equal(
    shouldSyncPreviewStorageBucket({
      id: "promotion-slides",
      public: "true",
    }),
    false,
  );
  assert.equal(
    shouldSyncPreviewStorageBucket({
      id: "member-profile-images",
      public: true,
    }),
    false,
  );
  assert.equal(
    isInvalidPreviewRequiredStorageBucket({
      id: "member-profile-images",
      public: true,
    }),
    true,
  );
  assert.equal(
    isInvalidPreviewRequiredStorageBucket({
      id: "member-profile-images",
      name: "different-bucket",
      public: false,
    }),
    true,
  );
  assert.equal(
    isInvalidPreviewRequiredStorageBucket({
      id: "member-profile-images",
      name: "member-profile-images",
      public: false,
    }),
    false,
  );
  assert.equal(
    shouldSyncPreviewStorageBucket({
      id: "review-media",
      name: "different-bucket",
      public: true,
    }),
    false,
  );
});

test("Preview Storage 선택은 모든 버킷 작업보다 먼저 적용된다", async () => {
  const script = await readFile(
    new URL("../scripts/supabase-sync-preview.mjs", import.meta.url),
    "utf8",
  );
  const syncStart = script.indexOf("async function syncStorageBuckets");
  const syncEnd = script.indexOf("async function main", syncStart);
  const syncStorageSource = script.slice(syncStart, syncEnd);
  const selectionIndex = syncStorageSource.indexOf(
    "filter(shouldSyncPreviewStorageBucket)",
  );
  const bucketLoopIndex = syncStorageSource.indexOf("for (const bucket of buckets)");

  assert.notEqual(selectionIndex, -1);
  assert.notEqual(bucketLoopIndex, -1);
  assert.ok(selectionIndex < bucketLoopIndex);
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
