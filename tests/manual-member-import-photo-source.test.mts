import assert from "node:assert/strict";
import test from "node:test";
import {
  getManualMemberImportSelectedPhotoFilename,
  prepareManualMemberImportRowPhoto,
} from "@/lib/member-manual-import/photo.client";

test("행별 사진은 원본 파일명을 쓰지 않고 행 번호와 실제 콘텐츠 형식으로 이름을 만든다", () => {
  assert.equal(
    getManualMemberImportSelectedPhotoFilename(2, "image/jpeg"),
    "manual-row-2.jpg",
  );
  assert.equal(
    getManualMemberImportSelectedPhotoFilename(3, "image/png"),
    "manual-row-3.png",
  );
  assert.equal(
    getManualMemberImportSelectedPhotoFilename(4, "image/webp"),
    "manual-row-4.webp",
  );
});

test("행별 사진 파일명 생성은 허용하지 않는 콘텐츠 형식과 행 번호를 거절한다", () => {
  assert.throws(
    () => getManualMemberImportSelectedPhotoFilename(1, "image/jpeg"),
    /행 번호/,
  );
  assert.throws(
    () => getManualMemberImportSelectedPhotoFilename(2, "image/svg\+xml"),
    /사진 형식/,
  );
});

test("행별 사진 선택은 원본 이름 대신 정규화된 행 전용 이름과 MIME을 전달한다", async () => {
  const prepared = await prepareManualMemberImportRowPhoto(
    new File(["source"], "이름이-긴-사진.png", { type: "image/png" }),
    2,
  );

  assert.equal(prepared.filename, "manual-row-2.png");
  assert.equal(prepared.file.name, "manual-row-2.png");
  assert.equal(prepared.contentType, "image/png");
  assert.equal(prepared.file.type, "image/png");
  assert.equal(prepared.sourceName, "이름이-긴-사진.png");
});
