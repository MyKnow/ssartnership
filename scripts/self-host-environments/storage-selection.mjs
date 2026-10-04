/**
 * Storage bucket selection for the Production → original Preview copy
 * (`copy.mjs`). Public buckets are copied; private buckets are excluded except
 * the reviewed member profile image bucket, which must stay private.
 *
 * Moved from the retired cloud `sync:preview` tooling (RF-04, #537).
 */
const PREVIEW_REQUIRED_STORAGE_BUCKETS = new Set(["member-profile-images"]);

function readBucketIdentifier(bucket, field) {
  if (!bucket || typeof bucket !== "object") {
    return null;
  }

  const value = bucket[field];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

export function getPreviewStorageBucketName(bucket) {
  const id = readBucketIdentifier(bucket, "id");
  const name = readBucketIdentifier(bucket, "name");

  if (id && name && id !== name) {
    return null;
  }

  return id ?? name;
}

export function isPreviewRequiredStorageBucket(bucketName) {
  return PREVIEW_REQUIRED_STORAGE_BUCKETS.has(bucketName);
}

export function shouldSyncPreviewStorageBucket(bucket) {
  const bucketName = getPreviewStorageBucketName(bucket);
  if (!bucketName || typeof bucket.public !== "boolean") {
    return false;
  }

  if (isPreviewRequiredStorageBucket(bucketName)) {
    return bucket.public === false;
  }

  return bucket.public === true;
}

export function isInvalidPreviewRequiredStorageBucket(bucket) {
  const identifiers = [
    readBucketIdentifier(bucket, "id"),
    readBucketIdentifier(bucket, "name"),
  ];

  return (
    identifiers.some((identifier) =>
      isPreviewRequiredStorageBucket(identifier),
    ) && !shouldSyncPreviewStorageBucket(bucket)
  );
}
