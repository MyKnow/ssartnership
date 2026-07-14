import ExcelJS from "exceljs";
import {
  MANUAL_MEMBER_IMPORT_HEADERS,
  MANUAL_MEMBER_IMPORT_LIMITS,
  type ManualMemberImportRawRow,
} from "./shared";

const SHEET_NAME = "회원 가져오기";

function getCellText(cell: ExcelJS.Cell) {
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text.trim();
    if ("result" in value) return String(value.result ?? "").trim();
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((item) => item.text).join("").trim();
    }
  }
  return String(value).trim();
}

function rowHasValue(row: ExcelJS.Row) {
  return MANUAL_MEMBER_IMPORT_HEADERS.some((_, index) =>
    Boolean(getCellText(row.getCell(index + 1))),
  );
}

export async function createManualMemberImportTemplate() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SSARTNERSHIP";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(SHEET_NAME);
  sheet.addRow([...MANUAL_MEMBER_IMPORT_HEADERS]);
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1428A0" },
  };
  sheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };
  sheet.getRow(1).height = 24;
  sheet.columns = [
    { width: 10 },
    { width: 18 },
    { width: 18 },
    { width: 24 },
    { width: 32 },
    { width: 28 },
  ];
  sheet.autoFilter = { from: "A1", to: "F1" };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  const guide = workbook.addWorksheet("작성 가이드");
  guide.columns = [{ width: 20 }, { width: 72 }];
  guide.addRows([
    ["항목", "안내"],
    ["기수", "운영진은 0, 그 외에는 1~현재 기수(현재 16)를 입력합니다."],
    ["MM ID", "SSAFY Verify 조회가 활성화된 기수만 입력할 수 있습니다. 현재 기본값은 14·15기입니다."],
    ["이메일", "MM ID 또는 이메일 중 하나는 필수입니다. 이메일 전용 회원은 이름·캠퍼스도 필수입니다."],
    ["사진 파일명", "선택 입력입니다. 기재하면 사진 ZIP의 같은 파일명과 정확히 일치해야 합니다. JPEG/PNG/WebP, 5MB 이하만 허용합니다."],
    ["비밀번호 설정", "MM 알림을 우선 보내며 실패 또는 미지원 시 이메일로 한 번만 대체 발송합니다."],
  ]);
  guide.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  guide.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1428A0" },
  };
  guide.getColumn(2).alignment = { wrapText: true, vertical: "top" };

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function parseManualMemberImportWorkbook(buffer: Buffer) {
  if (buffer.length === 0 || buffer.length > MANUAL_MEMBER_IMPORT_LIMITS.xlsxBytes) {
    throw new Error("XLSX 파일은 1MB 이하만 업로드할 수 있습니다.");
  }
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.getWorksheet(SHEET_NAME) ?? workbook.worksheets[0];
  if (!sheet) throw new Error("회원 가져오기 시트를 찾지 못했습니다.");

  const headers = MANUAL_MEMBER_IMPORT_HEADERS.map((_, index) =>
    getCellText(sheet.getRow(1).getCell(index + 1)),
  );
  if (headers.some((header, index) => header !== MANUAL_MEMBER_IMPORT_HEADERS[index])) {
    throw new Error(`XLSX 첫 행은 ${MANUAL_MEMBER_IMPORT_HEADERS.join(", ")} 순서여야 합니다.`);
  }

  const rows: ManualMemberImportRawRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 1 || !rowHasValue(row)) return;
    rows.push({
      rowNumber,
      generation: getCellText(row.getCell(1)),
      name: getCellText(row.getCell(2)),
      campus: getCellText(row.getCell(3)),
      mmId: getCellText(row.getCell(4)),
      email: getCellText(row.getCell(5)),
      photoFilename: getCellText(row.getCell(6)),
    });
  });

  return rows;
}
