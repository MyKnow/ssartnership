import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = [
  "혜택 그룹",
  "지점명",
  "주소",
  "지점 코드",
  "직영/가맹",
  "지도 URL",
  "전화번호",
  "메모",
] as const;

const SAMPLE_ROWS = [
  [
    "기본 혜택",
    "역삼본점",
    "서울 강남구 테헤란로 212",
    "",
    "직영",
    "https://map.naver.com/...",
    "02-3429-5100",
    "직영점 일부 참여",
  ],
  [
    "평일 혜택",
    "강남점",
    "서울 강남구 강남대로 382",
    "",
    "가맹",
    "",
    "",
    "가맹점 개별 동의",
  ],
] as const;

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1428A0" },
  };
  row.alignment = { vertical: "middle", horizontal: "center" };
}

async function createBranchTemplateBuffer() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SSARTNERSHIP";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("지점 목록");
  sheet.addRow([...HEADERS]);
  styleHeader(sheet.getRow(1));
  for (const row of SAMPLE_ROWS) {
    sheet.addRow([...row]);
  }
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: HEADERS.length },
  };
  sheet.columns = [
    { width: 16 },
    { width: 18 },
    { width: 34 },
    { width: 16 },
    { width: 14 },
    { width: 30 },
    { width: 16 },
    { width: 24 },
  ];

  const guide = workbook.addWorksheet("작성 가이드");
  guide.addRows([
    ["필수 컬럼", "혜택 그룹, 지점명, 주소"],
    ["선택 컬럼", "지점 코드, 직영/가맹, 지도 URL, 전화번호, 메모"],
    ["지점 코드", "없어도 됩니다. 시스템이 내부 식별자를 자동 생성합니다."],
    ["직영/가맹", "직영, 가맹, 미정 중 하나를 입력합니다."],
    ["캠퍼스", "주소 기반으로 자동 추론합니다. 실패 시 관리자 검토 단계에서 보정합니다."],
  ]);
  guide.columns = [{ width: 18 }, { width: 70 }];
  styleHeader(guide.getRow(1));

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function GET() {
  const buffer = await createBranchTemplateBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="ssartnership-branch-list-template.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
