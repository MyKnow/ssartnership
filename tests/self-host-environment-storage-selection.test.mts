import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

type StorageSelectionModule =
  typeof import("../scripts/self-host-environments/storage-selection.mjs");

const previewSyncStoragePromise = import(
  new URL("../scripts/self-host-environments/storage-selection.mjs", import.meta.url).href
) as Promise<StorageSelectionModule>;

test("member profile image 버킷만 Preview 복제의 필수 비공개 버킷이다", async () => {
  const { isPreviewRequiredStorageBucket } = await previewSyncStoragePromise;

  assert.equal(isPreviewRequiredStorageBucket("member-profile-images"), true);
  assert.equal(isPreviewRequiredStorageBucket("graduate-certificates"), false);
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

test("원본 Preview 복제는 이동한 버킷 선택 모듈을 사용하고 폐기된 sync:preview 도구는 남지 않는다", async () => {
  const copySource = await readFile(
    new URL("../scripts/self-host-environments/copy.mjs", import.meta.url),
    "utf8",
  );
  const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  ) as { scripts?: Record<string, string> };

  assert.match(copySource, /from "\.\/storage-selection\.mjs"/u);
  assert.match(copySource, /filter\(shouldSyncPreviewStorageBucket\)/u);
  assert.equal(packageJson.scripts?.["sync:preview"], undefined);
  for (const retired of [
    "supabase-sync-preview.mjs",
    "supabase-sync-preview-lib.mjs",
    "supabase-sync-preview-dump-lib.mjs",
    "supabase-sync-preview-storage.mjs",
    "supabase-db-health-lib.mjs",
    "preview-credential-seed-lib.mjs",
  ]) {
    assert.equal(
      existsSync(new URL(`../scripts/${retired}`, import.meta.url)),
      false,
      `scripts/${retired} must stay retired`,
    );
  }
});
