import assert from "node:assert/strict";
import test from "node:test";
import {
  addManualMemberImportEditableRow,
  appendManualMemberImportWorkbookRows,
  toManualMemberImportRawRows,
} from "@/lib/member-manual-import/rows";

test("수동 회원 행은 빈 행을 추가하고 입력 순서를 안정적으로 유지한다", () => {
  const first = addManualMemberImportEditableRow([]);
  const second = addManualMemberImportEditableRow(first);

  assert.deepEqual(first, [
    {
      rowNumber: 2,
      generation: "",
      name: "",
      campus: "",
      mmId: "",
      email: "",
      photoFilename: "",
    },
  ]);
  assert.equal(second.length, 2);
  assert.equal(second[1]?.rowNumber, 3);
  assert.deepEqual(toManualMemberImportRawRows(second), second);
});

test("XLSX 행 업로드는 기존 입력을 유지한 채 편집 가능한 행으로 자동 추가한다", () => {
  const existing = addManualMemberImportEditableRow([]);
  const imported = appendManualMemberImportWorkbookRows(existing, [
    {
      rowNumber: 2,
      generation: "15",
      name: "홍길동",
      campus: "서울",
      mmId: "hong",
      email: "hong@example.com",
      photoFilename: "hong.webp",
    },
    {
      rowNumber: 3,
      generation: "16",
      name: "김싸피",
      campus: "서울",
      mmId: "",
      email: "kim@example.com",
      photoFilename: "",
    },
  ]);

  assert.equal(imported.rows.length, 3);
  assert.equal(imported.appendedCount, 2);
  assert.equal(imported.rows[1]?.rowNumber, 3);
  assert.equal(imported.rows[1]?.name, "홍길동");
  assert.equal(imported.rows[2]?.rowNumber, 4);
  assert.deepEqual(existing, addManualMemberImportEditableRow([]));
});

test("XLSX 행 업로드와 수동 행 추가는 배치 최대 20명을 넘기지 않는다", () => {
  const full = Array.from({ length: 20 }, (_, index) => ({
    rowNumber: index + 2,
    generation: "16",
    name: `회원 ${index + 1}`,
    campus: "서울",
    mmId: "",
    email: `member${index + 1}@example.com`,
    photoFilename: "",
  }));
  const imported = appendManualMemberImportWorkbookRows(full, [
    {
      rowNumber: 2,
      generation: "16",
      name: "초과 회원",
      campus: "서울",
      mmId: "",
      email: "overflow@example.com",
      photoFilename: "",
    },
  ]);

  assert.equal(addManualMemberImportEditableRow(full).length, 20);
  assert.equal(imported.rows.length, 20);
  assert.equal(imported.appendedCount, 0);
  assert.equal(imported.skippedCount, 1);
});
