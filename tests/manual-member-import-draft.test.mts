import assert from "node:assert/strict";
import test from "node:test";

const draftPromise = import("@/lib/member-manual-import/draft");
const imageDraftPromise = import("@/lib/image-upload/draft");

test("수동 회원 등록 Draft는 행, 편집된 사진 메타데이터, 업로드 ID와 준비 배치를 복원한다", async () => {
  const [{ createManualMemberImportDraftValues, readManualMemberImportDraftSnapshot }, { createImageUploadDraft }] = await Promise.all([
    draftPromise,
    imageDraftPromise,
  ]);
  const values = createManualMemberImportDraftValues({
    rows: [{
      rowNumber: 2,
      generation: "15",
      name: "홍길동",
      campus: "seoul",
      mmId: "hong",
      email: "hong@example.com",
      photoFilename: "hong.webp",
    }],
    photos: [{
      clientId: "manual-row-2",
      source: "row",
      rowNumber: 2,
      filename: "hong.webp",
      contentType: "image/webp",
      sourceName: "홍길동.HEIC",
      uploadId: "03f5459b-dfee-4558-907a-509a396312f5",
    }],
    ignoredZipPhotoFilenames: ["unused.png"],
    batch: {
      batchId: "b0b491e3-9ef2-4e22-b51a-90c604e3d96f",
      expiresAt: "2026-07-18T14:00:00.000Z",
    },
  });
  const imageDraft = createImageUploadDraft({
    formKey: "admin-manual-member-import",
    values,
    manifests: [{
      uploadId: "03f5459b-dfee-4558-907a-509a396312f5",
      role: "profile",
      order: 0,
    }],
    now: new Date("2026-07-18T12:00:00.000Z").getTime(),
  });
  const restored = readManualMemberImportDraftSnapshot(
    imageDraft.values,
    new Date("2026-07-18T12:30:00.000Z").getTime(),
  );

  assert.equal(restored?.rows[0]?.name, "홍길동");
  assert.equal(restored?.photos[0]?.source, "row");
  assert.equal(restored?.photos[0]?.uploadId, "03f5459b-dfee-4558-907a-509a396312f5");
  assert.deepEqual(restored?.ignoredZipPhotoFilenames, ["unused.png"]);
  assert.equal(restored?.batch?.batchId, "b0b491e3-9ef2-4e22-b51a-90c604e3d96f");
});

test("수동 회원 등록 Draft는 만료된 준비 배치만 버리고 편집된 사진 정보는 유지한다", async () => {
  const { createManualMemberImportDraftValues, readManualMemberImportDraftSnapshot } = await draftPromise;
  const values = createManualMemberImportDraftValues({
    rows: [],
    photos: [],
    ignoredZipPhotoFilenames: [],
    batch: {
      batchId: "b0b491e3-9ef2-4e22-b51a-90c604e3d96f",
      expiresAt: "2026-07-18T12:00:00.000Z",
    },
  });
  const restored = readManualMemberImportDraftSnapshot(
    values,
    new Date("2026-07-18T12:00:01.000Z").getTime(),
  );

  assert.deepEqual(restored, {
    rows: [],
    photos: [],
    ignoredZipPhotoFilenames: [],
    batch: null,
  });
});
