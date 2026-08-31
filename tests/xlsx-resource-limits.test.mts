import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ExcelJS from "exceljs";

import {
  SAFE_XLSX_ERROR_MESSAGE,
  XLSX_RESOURCE_LIMITS,
  XlsxResourceError,
  assertXlsxArchiveResourceLimits,
  assertXlsxWorkbookResourceLimits,
  loadXlsxWorkbookWithinResourceLimits,
} from "../src/lib/xlsx-resource-limits.server.ts";

const root = new URL("..", import.meta.url);

async function createWorkbookBuffer(configure?: (workbook: ExcelJS.Workbook) => void) {
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
  ]);
  sheet.addRow([
    "G01",
    "역삼본점",
    "서울 강남구 테헤란로 212",
    "",
    "직영",
    "https://map.example.com/branch",
    "02-3429-5100",
    "",
  ]);
  configure?.(workbook);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function findEndOfCentralDirectory(buffer: Buffer) {
  const minimumOffset = Math.max(0, buffer.length - 22 - 65_535);
  for (let offset = buffer.length - 22; offset >= minimumOffset; offset -= 1) {
    if (
      buffer.readUInt32LE(offset) === 0x06054b50 &&
      offset + 22 + buffer.readUInt16LE(offset + 20) === buffer.length
    ) {
      return offset;
    }
  }
  throw new Error("test fixture has no ZIP end record");
}

function getFirstCentralDirectoryEntry(buffer: Buffer) {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const centralOffset = buffer.readUInt32LE(eocdOffset + 16);
  assert.equal(buffer.readUInt32LE(centralOffset), 0x02014b50);
  const localOffset = buffer.readUInt32LE(centralOffset + 42);
  assert.equal(buffer.readUInt32LE(localOffset), 0x04034b50);
  return { centralOffset, localOffset };
}

function withEncryptedEntry(buffer: Buffer) {
  const mutated = Buffer.from(buffer);
  const { centralOffset, localOffset } = getFirstCentralDirectoryEntry(mutated);
  mutated.writeUInt16LE(mutated.readUInt16LE(centralOffset + 8) | 0x0001, centralOffset + 8);
  mutated.writeUInt16LE(mutated.readUInt16LE(localOffset + 6) | 0x0001, localOffset + 6);
  return mutated;
}

function withZip64Entry(buffer: Buffer) {
  const mutated = Buffer.from(buffer);
  const { centralOffset } = getFirstCentralDirectoryEntry(mutated);
  mutated.writeUInt32LE(0xffff_ffff, centralOffset + 24);
  return mutated;
}

function withExcessiveCompressionRatio(buffer: Buffer) {
  const mutated = Buffer.from(buffer);
  const { centralOffset, localOffset } = getFirstCentralDirectoryEntry(mutated);
  const compressedBytes = mutated.readUInt32LE(centralOffset + 20);
  const expandedBytes = Math.max(1, compressedBytes) * (XLSX_RESOURCE_LIMITS.maxCompressionRatio + 1);
  mutated.writeUInt32LE(expandedBytes, centralOffset + 24);
  if ((mutated.readUInt16LE(centralOffset + 8) & 0x0008) === 0) {
    mutated.writeUInt32LE(expandedBytes, localOffset + 22);
  }
  return mutated;
}

function withUnderreportedExpandedSize(buffer: Buffer) {
  const mutated = Buffer.from(buffer);
  const { centralOffset, localOffset } = getFirstCentralDirectoryEntry(mutated);
  const compressedBytes = mutated.readUInt32LE(centralOffset + 20);
  mutated.writeUInt32LE(compressedBytes, centralOffset + 24);
  if ((mutated.readUInt16LE(centralOffset + 8) & 0x0008) === 0) {
    mutated.writeUInt32LE(compressedBytes, localOffset + 22);
  }
  return mutated;
}

function expectSafeResourceFailure(run: () => unknown) {
  assert.throws(run, (error: unknown) => {
    assert.ok(error instanceof XlsxResourceError);
    assert.equal(error.message, SAFE_XLSX_ERROR_MESSAGE);
    assert.doesNotMatch(error.message, /zip64|encrypt|ratio|entry|offset/i);
    return true;
  });
}

test("XLSX 중앙 디렉터리는 ExcelJS 전에 암호화·ZIP64·과도한 압축률을 거부한다", async () => {
  const validBuffer = await createWorkbookBuffer();

  expectSafeResourceFailure(() => assertXlsxArchiveResourceLimits(withEncryptedEntry(validBuffer)));
  expectSafeResourceFailure(() => assertXlsxArchiveResourceLimits(withZip64Entry(validBuffer)));
  expectSafeResourceFailure(() =>
    assertXlsxArchiveResourceLimits(withExcessiveCompressionRatio(validBuffer)),
  );
  expectSafeResourceFailure(() =>
    assertXlsxArchiveResourceLimits(withUnderreportedExpandedSize(validBuffer)),
  );
});

test("XLSX 사전 검사는 실제 압축 폭탄 없이 항목 수와 총 확장 크기를 제한한다", async () => {
  const validBuffer = await createWorkbookBuffer();

  expectSafeResourceFailure(() =>
    assertXlsxArchiveResourceLimits(validBuffer, {
      ...XLSX_RESOURCE_LIMITS,
      maxEntries: 1,
    }),
  );
  expectSafeResourceFailure(() =>
    assertXlsxArchiveResourceLimits(validBuffer, {
      ...XLSX_RESOURCE_LIMITS,
      maxExpandedBytes: 1,
    }),
  );

  for (const limits of [
    { maxRowsPerWorksheet: 1 },
    { maxColumnsPerWorksheet: 1 },
    { maxCells: 1 },
    { maxXmlElements: 1 },
    { maxCellTextCharacters: 1 },
    { maxTextCharacters: 1 },
  ] as const) {
    expectSafeResourceFailure(() =>
      assertXlsxArchiveResourceLimits(validBuffer, {
        ...XLSX_RESOURCE_LIMITS,
        ...limits,
      }),
    );
  }

  const twoSheetBuffer = await createWorkbookBuffer((workbook) => {
    workbook.addWorksheet("추가 시트").addRow(["추가"]);
  });
  expectSafeResourceFailure(() =>
    assertXlsxArchiveResourceLimits(twoSheetBuffer, {
      ...XLSX_RESOURCE_LIMITS,
      maxWorksheets: 1,
    }),
  );
});

test("XLSX 로더는 정상 워크북을 유지하고 시트·행·열·셀·텍스트 한도를 적용한다", async () => {
  const validBuffer = await createWorkbookBuffer();
  const loaded = await loadXlsxWorkbookWithinResourceLimits(validBuffer);
  assert.equal(loaded.getWorksheet("지점 목록")?.getRow(2).getCell(2).text, "역삼본점");

  const workbook = new ExcelJS.Workbook();
  const first = workbook.addWorksheet("첫 시트");
  first.addRow(["가", "나다라"]);
  first.addRow(["두 번째 행"]);
  workbook.addWorksheet("두 번째 시트");

  for (const limits of [
    { maxWorksheets: 1 },
    { maxRowsPerWorksheet: 1 },
    { maxColumnsPerWorksheet: 1 },
    { maxCells: 1 },
    { maxCellTextCharacters: 1 },
    { maxTextCharacters: 1 },
  ] as const) {
    expectSafeResourceFailure(() =>
      assertXlsxWorkbookResourceLimits(workbook, {
        ...XLSX_RESOURCE_LIMITS,
        ...limits,
      }),
    );
  }
});

test("기존 관리자 템플릿과 공개 지점 워크북은 제한 안에서 계속 파싱된다", async () => {
  const { createAdminPartnerXlsxTemplate, parseAdminPartnerXlsxDraft } = await import(
    "../src/lib/admin-partner-file-import.server.ts"
  );

  const categories = [{ id: "cat-cafe", key: "cafe", label: "카페" }];
  const adminBuffer = await createAdminPartnerXlsxTemplate(
    { serviceMode: "offline", benefitActionType: "onsite" },
    categories,
  );
  const adminWorkbook = new ExcelJS.Workbook();
  await adminWorkbook.xlsx.load(adminBuffer as unknown as ExcelJS.Buffer);
  const input = adminWorkbook.getWorksheet("입력");
  assert.ok(input);
  for (let rowNumber = 2; rowNumber <= input.rowCount; rowNumber += 1) {
    const label = String(input.getRow(rowNumber).getCell(1).value ?? "");
    if (label === "제휴처명") input.getRow(rowNumber).getCell(3).value = "카페 싸피";
    if (label === "카테고리") input.getRow(rowNumber).getCell(3).value = "카페";
    if (label === "위치") input.getRow(rowNumber).getCell(3).value = "서울 강남구";
  }
  const parsedAdmin = await parseAdminPartnerXlsxDraft({
    fileBuffer: Buffer.from(await adminWorkbook.xlsx.writeBuffer()),
    categories,
    companies: [],
  });
  assert.equal(parsedAdmin.ok, true);

  const branchWorkbook = await loadXlsxWorkbookWithinResourceLimits(
    await createWorkbookBuffer(),
  );
  assert.equal(
    branchWorkbook.getWorksheet("지점 목록")?.getRow(2).getCell(2).text,
    "역삼본점",
  );
});

test("서버 XLSX 파서는 공용 제한 로더를 사용하고 실패 경로를 rate limit에 기록한다", async () => {
  const [
    adminSource,
    submitSource,
    actionSource,
    manualImportSource,
    couponSource,
  ] = await Promise.all([
    readFile(new URL("src/lib/admin-partner-file-import.server.ts", root), "utf8"),
    readFile(new URL("src/lib/partner-registration-submit.server.ts", root), "utf8"),
    readFile(new URL("src/app/(site)/partner-registration/actions.ts", root), "utf8"),
    readFile(new URL("src/lib/member-manual-import/xlsx.server.ts", root), "utf8"),
    readFile(new URL("src/lib/ad-coupon-code-import.server.ts", root), "utf8"),
  ]);

  assert.match(adminSource, /loadXlsxWorkbookWithinResourceLimits\(fileBuffer\)/);
  assert.match(submitSource, /loadXlsxWorkbookWithinResourceLimits\(fileBuffer\)/);
  assert.match(manualImportSource, /loadXlsxWorkbookWithinResourceLimits\(buffer\)/);
  assert.match(couponSource, /loadXlsxWorkbookWithinResourceLimits\(/);
  assert.doesNotMatch(adminSource, /workbook\.xlsx\.load\(/);
  assert.doesNotMatch(submitSource, /workbook\.xlsx\.load\(/);
  assert.doesNotMatch(manualImportSource, /workbook\.xlsx\.load\(/);
  assert.doesNotMatch(couponSource, /workbook\.xlsx\.load\(/);
  assert.match(
    actionSource,
    /catch \(error\) \{[\s\S]*?recordAttempt\(identifier, false, PARTNER_REGISTRATION_RATE_LIMIT\)[\s\S]*?\[partner-registration\] insert failed/,
  );
  assert.match(
    actionSource,
    /catch \(error\) \{[\s\S]*?recordAttempt\(identifier, false, PARTNER_REGISTRATION_RATE_LIMIT\)[\s\S]*?\[partner-registration:xlsx\] insert failed/,
  );
});
