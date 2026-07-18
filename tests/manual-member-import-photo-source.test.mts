import assert from "node:assert/strict";
import test from "node:test";
import {
  getManualMemberImportPhotoUploadClientId,
  getManualMemberImportSelectedPhotoFilename,
  prepareManualMemberImportRowPhoto,
} from "@/lib/member-manual-import/photo.client";
import { validateManualMemberImportPhotoManifest } from "@/lib/member-manual-import/shared";

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

test("행별 사진 파일명 생성은 지원 이미지 확장자를 허용하고 행 번호·비이미지를 거절한다", () => {
  assert.throws(
    () => getManualMemberImportSelectedPhotoFilename(1, "image/jpeg"),
    /행 번호/,
  );
  assert.throws(
    () => getManualMemberImportSelectedPhotoFilename(2, "application/pdf"),
    /사진 형식/,
  );
  assert.equal(
    getManualMemberImportSelectedPhotoFilename(2, "image/svg+xml"),
    "manual-row-2.svg",
  );
});

test("사진 업로드 clientId는 ZIP의 한글 원본 파일명과 무관하게 API 안전 형식이다", () => {
  assert.equal(getManualMemberImportPhotoUploadClientId(0), "manual-photo-0");
  assert.match(getManualMemberImportPhotoUploadClientId(19), /^[a-z0-9-]+$/);
  assert.throws(
    () => getManualMemberImportPhotoUploadClientId(-1),
    /업로드 순서/,
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

test("서버 수동 회원 가져오기는 공통 이미지 업로드 ID 없는 사진 manifest를 거절한다", () => {
  const rows = [{ rowNumber: 2, photoFilename: "manual-row-2.webp" }];
  const files = [{
    filename: "manual-row-2.webp",
    contentType: "image/webp",
    size: 128,
  }];

  assert.equal(
    validateManualMemberImportPhotoManifest(rows, files).errors.length,
    0,
  );
  assert.match(
    validateManualMemberImportPhotoManifest(rows, files, {
      requireUploadIds: true,
    }).errors[0]?.message ?? "",
    /업로드 정보/,
  );
});
