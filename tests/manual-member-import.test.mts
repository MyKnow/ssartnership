import assert from "node:assert/strict";
import test from "node:test";
import {
  MANUAL_MEMBER_IMPORT_LIMITS,
  validateManualMemberImportPhotoManifest,
  validateManualMemberImportRows,
} from "@/lib/member-manual-import/shared";

const context = {
  currentGeneration: 16,
  mmLookupGenerations: [14, 15],
};

test("수동 회원 가져오기는 운영진부터 현재 기수까지 허용한다", () => {
  const result = validateManualMemberImportRows(
    [
      { rowNumber: 2, generation: "0", name: "운영진", campus: "서울", mmId: "staff-id", email: "", photoFilename: "staff.png" },
      { rowNumber: 3, generation: "16", name: "이메일 회원", campus: "서울", mmId: "", email: "member@example.com", photoFilename: "" },
    ],
    context,
  );

  assert.equal(result.acceptedRows.length, 2);
  assert.deepEqual(result.errors, []);
  assert.equal(result.acceptedRows[0]?.generation, 0);
  assert.equal(result.acceptedRows[1]?.email, "member@example.com");
});

test("MM 조회 미지원 기수에는 MM ID를 허용하지 않는다", () => {
  const result = validateManualMemberImportRows(
    [
      { rowNumber: 2, generation: "16", name: "", campus: "", mmId: "new-cohort", email: "", photoFilename: "" },
      { rowNumber: 3, generation: "13", name: "수료생", campus: "서울", mmId: "", email: "graduate@example.com", photoFilename: "" },
    ],
    context,
  );

  assert.equal(result.acceptedRows.length, 1);
  assert.deepEqual(result.errors.map((item) => [item.rowNumber, item.code]), [[2, "mm_generation_not_supported"]]);
});

test("MM 또는 이메일 하나는 필수이고, 이메일 전용 회원은 이름·캠퍼스를 필수로 받는다", () => {
  const result = validateManualMemberImportRows(
    [
      { rowNumber: 2, generation: "14", name: "", campus: "", mmId: "", email: "", photoFilename: "" },
      { rowNumber: 3, generation: "15", name: "", campus: "서울", mmId: "", email: "email-only@example.com", photoFilename: "" },
    ],
    context,
  );

  assert.equal(result.acceptedRows.length, 0);
  assert.deepEqual(result.errors.map((item) => item.code), ["contact_required", "name_required"]);
});

test("사진 매니페스트는 파일명 정확 일치·안전 경로·형식·크기·미참조 파일을 검증한다", () => {
  const result = validateManualMemberImportPhotoManifest(
    [
      { rowNumber: 2, photoFilename: "a.jpg" },
      { rowNumber: 3, photoFilename: "b.webp" },
    ],
    [
      { filename: "a.jpg", contentType: "image/jpeg", size: 1024 },
      { filename: "folder/b.webp", contentType: "image/webp", size: 1024 },
      { filename: "unused.png", contentType: "image/png", size: 1024 },
      { filename: "too-large.png", contentType: "image/png", size: MANUAL_MEMBER_IMPORT_LIMITS.imageBytes + 1 },
    ],
  );

  assert.deepEqual(result.errors.map((item) => item.code), ["photo_missing", "photo_path_unsafe", "photo_unreferenced", "photo_unreferenced", "photo_too_large"]);
});

test("가져오기 제한은 한 배치 20명, XLSX 1MB, ZIP 100MB, 사진 5MB로 고정한다", () => {
  assert.deepEqual(MANUAL_MEMBER_IMPORT_LIMITS, {
    maxRows: 20,
    xlsxBytes: 1 * 1024 * 1024,
    zipBytes: 100 * 1024 * 1024,
    imageBytes: 5 * 1024 * 1024,
  });
});
