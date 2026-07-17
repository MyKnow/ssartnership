import assert from "node:assert/strict";
import test from "node:test";
import {
  getManualMemberImportRowReadiness,
  MANUAL_MEMBER_IMPORT_LIMITS,
  validateManualMemberImportPhotoManifest,
  validateManualMemberImportRows,
} from "@/lib/member-manual-import/shared";

const context = {
  currentGeneration: 16,
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

test("직접 Mattermost 조회 행도 외부 claim 없이 캠퍼스를 요구한다", () => {
  const result = validateManualMemberImportRows(
    [
      { rowNumber: 2, generation: "16", name: "", campus: "", mmId: "new-cohort", email: "", photoFilename: "" },
      { rowNumber: 3, generation: "13", name: "수료생", campus: "서울", mmId: "", email: "graduate@example.com", photoFilename: "" },
    ],
    context,
  );

  assert.equal(result.acceptedRows.length, 1);
  assert.deepEqual(result.errors.map((item) => [item.rowNumber, item.code]), [[2, "campus_required"]]);
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

test("생성 시작 전 행 완성도는 모든 필수 입력 규칙을 통과한 경우에만 준비 완료가 된다", () => {
  const empty = getManualMemberImportRowReadiness([], context);
  const incomplete = getManualMemberImportRowReadiness(
    [
      { rowNumber: 2, generation: "16", name: "", campus: "", mmId: "", email: "", photoFilename: "" },
    ],
    context,
  );
  const complete = getManualMemberImportRowReadiness(
    [
      { rowNumber: 2, generation: "16", name: "이메일 회원", campus: "서울", mmId: "", email: "member@example.com", photoFilename: "" },
    ],
    context,
  );
  const oneIncompleteAmongMultipleRows = getManualMemberImportRowReadiness(
    [
      { rowNumber: 2, generation: "15", name: "MM 회원", campus: "서울", mmId: "member-mm", email: "", photoFilename: "" },
      { rowNumber: 3, generation: "16", name: "", campus: "", mmId: "", email: "", photoFilename: "" },
    ],
    context,
  );

  assert.equal(empty.isComplete, false);
  assert.equal(incomplete.isComplete, false);
  assert.equal(oneIncompleteAmongMultipleRows.isComplete, false);
  assert.equal(complete.isComplete, true);
});

test("수동 회원 가져오기는 표준 캠퍼스만 허용하고 전체 이름은 저장용 라벨로 정규화한다", () => {
  const result = validateManualMemberImportRows(
    [
      { rowNumber: 2, generation: "16", name: "서울 회원", campus: "서울 캠퍼스", mmId: "", email: "seoul@example.com", photoFilename: "" },
      { rowNumber: 3, generation: "16", name: "잘못된 캠퍼스", campus: "어딘가", mmId: "", email: "unknown@example.com", photoFilename: "" },
    ],
    context,
  );

  assert.equal(result.acceptedRows.length, 1);
  assert.equal(result.acceptedRows[0]?.campus, "서울");
  assert.deepEqual(result.errors.map((item) => [item.rowNumber, item.code]), [[3, "campus_invalid"]]);
});

test("행 기반 입력은 유효하고 서로 다른 행 번호만 서버 준비 단계에 전달한다", () => {
  const result = validateManualMemberImportRows(
    [
      { rowNumber: 0, generation: "16", name: "첫 회원", campus: "서울", mmId: "", email: "first@example.com", photoFilename: "" },
      { rowNumber: 3, generation: "16", name: "둘째 회원", campus: "서울", mmId: "", email: "second@example.com", photoFilename: "" },
      { rowNumber: 3, generation: "16", name: "중복 회원", campus: "서울", mmId: "", email: "duplicate@example.com", photoFilename: "" },
    ],
    context,
  );

  assert.equal(result.acceptedRows.length, 1);
  assert.deepEqual(
    result.errors.map((item) => item.code),
    ["row_number_invalid", "row_number_duplicate"],
  );
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
