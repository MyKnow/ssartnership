import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ExcelJS from "exceljs";
import {
  getPartnerBranchXlsxCellText,
  normalizePartnerBranchXlsxHeader,
  readPartnerBranchXlsxRows,
} from "../src/lib/partner-branch-xlsx-rows.ts";

const root = new URL("..", import.meta.url);

async function reloadWorksheet(workbook: ExcelJS.Workbook) {
  const buffer = await workbook.xlsx.writeBuffer();
  const loaded = new ExcelJS.Workbook();
  await loaded.xlsx.load(buffer as unknown as Parameters<typeof loaded.xlsx.load>[0]);
  const worksheet = loaded.worksheets[0];
  assert.ok(worksheet);
  return worksheet;
}

test("헤더 정규화는 공백만 제거해 템플릿의 띄어쓰기 라벨을 같은 키로 맞춘다", () => {
  assert.equal(normalizePartnerBranchXlsxHeader(" 혜택 그룹 "), "혜택그룹");
  assert.equal(normalizePartnerBranchXlsxHeader("지도 URL"), "지도URL");
  assert.equal(normalizePartnerBranchXlsxHeader("직영 / 가맹"), "직영/가맹");
});

test("셀 텍스트는 날짜·수식·서식·하이퍼링크 값을 표시 문자열로 바꾼다", () => {
  assert.equal(getPartnerBranchXlsxCellText({ value: null }), "");
  assert.equal(getPartnerBranchXlsxCellText({}), "");
  assert.equal(getPartnerBranchXlsxCellText({ value: "  역삼점 " }), "역삼점");
  assert.equal(getPartnerBranchXlsxCellText({ value: 212 }), "212");
  assert.equal(
    getPartnerBranchXlsxCellText({ value: new Date("2026-10-05T00:00:00.000Z") }),
    "2026-10-05",
  );
  assert.equal(
    getPartnerBranchXlsxCellText({ value: { formula: "A1", result: " 3 " } }),
    "3",
  );
  assert.equal(
    getPartnerBranchXlsxCellText({ value: { formula: "A1", result: undefined } }),
    "",
  );
  assert.equal(
    getPartnerBranchXlsxCellText({
      value: { richText: [{ text: "강남" }, { text: "점 " }] },
    }),
    "강남점",
  );
  assert.equal(
    getPartnerBranchXlsxCellText({
      value: { text: " 지도 ", hyperlink: "https://map.example.com" },
    }),
    "지도",
  );
  assert.equal(
    getPartnerBranchXlsxCellText({ value: { hyperlink: "https://map.example.com" } }),
    "https://map.example.com",
  );
});

test("공개 템플릿 헤더 워크북을 필드로 매핑하고 빈 행은 건너뛰되 알 수 없는 열 값만 있는 행은 검증에 넘긴다", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("지점 목록");
  sheet.addRow([
    "혜택 그룹",
    "지점명",
    "주소",
    "지점 코드",
    "직영/가맹",
    "지도 URL",
    "전화번호",
    "메모",
    "관리용 열",
  ]);
  sheet.addRow([
    "G01",
    "역삼본점",
    "서울 강남구 테헤란로 212",
    "",
    "직영",
    { text: "지도", hyperlink: "https://map.example.com/branch" },
    "02-0000-0000",
    { richText: [{ text: "직영점 " }, { text: "참여" }] },
    "무시",
  ]);
  sheet.addRow([]);
  sheet.addRow(["", "", "", "", "", "", "", "", "관리용만"]);
  sheet.addRow(["G02", "강남점", "서울 강남구 강남대로 382", "", "가맹"]);

  const rows = readPartnerBranchXlsxRows(await reloadWorksheet(workbook));

  assert.deepEqual(rows, [
    {
      rowNumber: 2,
      values: {
        benefitGroupLabel: "G01",
        branchName: "역삼본점",
        address: "서울 강남구 테헤란로 212",
        branchCode: "",
        branchType: "직영",
        mapUrl: "지도",
        phone: "02-0000-0000",
        memo: "직영점 참여",
      },
    },
    // 알려진 필드가 비어 있어도 행을 남겨 서버 정규화가 필수값 누락으로 알린다.
    {
      rowNumber: 4,
      values: {
        benefitGroupLabel: "",
        branchName: "",
        address: "",
        branchCode: "",
        branchType: "",
        mapUrl: "",
        phone: "",
        memo: "",
      },
    },
    {
      rowNumber: 5,
      values: {
        benefitGroupLabel: "G02",
        branchName: "강남점",
        address: "서울 강남구 강남대로 382",
        branchCode: "",
        branchType: "가맹",
      },
    },
  ]);
});

test("헤더 별칭은 앞선 별칭 셀을 우선하고 그 셀이 없을 때만 뒤 별칭을 쓴다", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("지점 목록");
  sheet.addRow(["지점명", "지점유형", "운영메모", "직영/가맹", "메모"]);
  sheet.addRow(["A점", "가맹", "운영", "직영", "메모"]);
  sheet.addRow(["B점", "가맹", "운영"]);
  sheet.addRow(["C점", "가맹", "운영", "", ""]);

  const rows = readPartnerBranchXlsxRows(await reloadWorksheet(workbook));

  assert.deepEqual(rows.map((row) => row.values), [
    { branchName: "A점", branchType: "직영", memo: "메모" },
    { branchName: "B점", branchType: "가맹", memo: "운영" },
    // 기존 FE/BE 파서와 같게 `??` 의미를 유지한다: 앞선 별칭 셀이 빈 문자열이면 뒤로 넘어가지 않는다.
    { branchName: "C점", branchType: "", memo: "" },
  ]);
});

test("클라이언트 미리보기와 서버 제출 검증은 같은 지점 XLSX 행 파서를 import한다", async () => {
  const [editor, submit] = await Promise.all([
    readFile(new URL("src/components/partner-branches/PartnerBranchListEditor.tsx", root), "utf8"),
    readFile(new URL("src/lib/partner-registration-submit.server.ts", root), "utf8"),
  ]);

  for (const source of [editor, submit]) {
    assert.match(source, /from "@\/lib\/partner-branch-xlsx-rows"/);
    assert.match(source, /readPartnerBranchXlsxRows\(worksheet\)/);
    assert.doesNotMatch(source, /function (?:normalizeHeader|getCellText)\(/);
  }
});
