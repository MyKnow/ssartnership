import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import {
  createManualMemberImportTemplate,
  parseManualMemberImportWorkbook,
} from "@/lib/member-manual-import/xlsx.server";

test("수동 회원 XLSX 템플릿은 고정 열과 빈 입력 행을 제공한다", async () => {
  const buffer = await createManualMemberImportTemplate();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.getWorksheet("회원 가져오기");
  assert.ok(sheet);
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6].map((column) => String(sheet!.getRow(1).getCell(column).value ?? "")),
    ["기수", "이름", "캠퍼스", "MM ID", "이메일", "사진 파일명"],
  );
  assert.equal(sheet!.getRow(2).actualCellCount, 0);
});

test("수동 회원 XLSX 파서는 고정 열 순서와 빈 행을 검증한다", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("회원 가져오기");
  sheet.addRow(["기수", "이름", "캠퍼스", "MM ID", "이메일", "사진 파일명"]);
  sheet.addRow([15, "홍길동", "서울", "hong", "hong@example.com", "hong.webp"]);
  sheet.addRow([]);
  const rows = await parseManualMemberImportWorkbook(
    Buffer.from(await workbook.xlsx.writeBuffer()),
  );
  assert.deepEqual(rows, [{
    rowNumber: 2,
    generation: "15",
    name: "홍길동",
    campus: "서울",
    mmId: "hong",
    email: "hong@example.com",
    photoFilename: "hong.webp",
  }]);
});
