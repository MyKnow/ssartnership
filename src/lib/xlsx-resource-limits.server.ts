import ExcelJS from "exceljs";
import { inflateRawSync } from "node:zlib";

const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_ENTRY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const ZIP64_EXTRA_FIELD_ID = 0x0001;
const ZIP64_UINT16_SENTINEL = 0xffff;
const ZIP64_UINT32_SENTINEL = 0xffff_ffff;
const ZIP_ENCRYPTED_FLAG = 0x0001;
const ZIP_DATA_DESCRIPTOR_FLAG = 0x0008;
const ZIP_STRONG_ENCRYPTION_FLAG = 0x0040;
const ZIP_MAX_COMMENT_BYTES = 65_535;
const END_OF_CENTRAL_DIRECTORY_BYTES = 22;
const CENTRAL_DIRECTORY_ENTRY_BYTES = 46;
const LOCAL_FILE_HEADER_BYTES = 30;

export const SAFE_XLSX_ERROR_MESSAGE =
  "XLSX 파일의 크기나 구조를 확인해 주세요.";

export type XlsxResourceLimits = Readonly<{
  maxArchiveBytes: number;
  maxEntries: number;
  maxExpandedBytes: number;
  maxEntryExpandedBytes: number;
  maxCompressionRatio: number;
  maxXmlElements: number;
  maxWorksheets: number;
  maxRowsPerWorksheet: number;
  maxColumnsPerWorksheet: number;
  maxCells: number;
  maxCellTextCharacters: number;
  maxTextCharacters: number;
}>;

export const XLSX_RESOURCE_LIMITS: XlsxResourceLimits = Object.freeze({
  maxArchiveBytes: 1 * 1024 * 1024,
  maxEntries: 256,
  maxExpandedBytes: 16 * 1024 * 1024,
  maxEntryExpandedBytes: 8 * 1024 * 1024,
  maxCompressionRatio: 100,
  maxXmlElements: 100_000,
  maxWorksheets: 8,
  maxRowsPerWorksheet: 5_000,
  maxColumnsPerWorksheet: 64,
  maxCells: 50_000,
  maxCellTextCharacters: 10_000,
  maxTextCharacters: 500_000,
});
export type XlsxResourceErrorCode =
  | "invalid_archive"
  | "resource_limit_exceeded"
  | "workbook_resource_limit_exceeded";

export class XlsxResourceError extends Error {
  readonly code: XlsxResourceErrorCode;

  constructor(code: XlsxResourceErrorCode) {
    super(SAFE_XLSX_ERROR_MESSAGE);
    this.name = "XlsxResourceError";
    this.code = code;
  }
}

function rejectXlsxResource(code: XlsxResourceErrorCode = "resource_limit_exceeded"): never {
  throw new XlsxResourceError(code);
}

function hasRange(buffer: Buffer, offset: number, length: number) {
  return (
    Number.isSafeInteger(offset) &&
    Number.isSafeInteger(length) &&
    offset >= 0 &&
    length >= 0 &&
    offset <= buffer.length - length
  );
}

function assertPositiveLimits(limits: XlsxResourceLimits) {
  if (
    Object.values(limits).some(
      (value) => !Number.isSafeInteger(value) || value <= 0,
    )
  ) {
    rejectXlsxResource();
  }
}

function findEndOfCentralDirectory(buffer: Buffer) {
  if (buffer.length < END_OF_CENTRAL_DIRECTORY_BYTES) {
    rejectXlsxResource("invalid_archive");
  }
  const minimumOffset = Math.max(
    0,
    buffer.length - END_OF_CENTRAL_DIRECTORY_BYTES - ZIP_MAX_COMMENT_BYTES,
  );
  for (
    let offset = buffer.length - END_OF_CENTRAL_DIRECTORY_BYTES;
    offset >= minimumOffset;
    offset -= 1
  ) {
    if (buffer.readUInt32LE(offset) !== END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
      continue;
    }
    const commentBytes = buffer.readUInt16LE(offset + 20);
    if (offset + END_OF_CENTRAL_DIRECTORY_BYTES + commentBytes === buffer.length) {
      return offset;
    }
  }
  rejectXlsxResource("invalid_archive");
}

function hasZip64ExtraField(buffer: Buffer, offset: number, length: number) {
  const end = offset + length;
  if (!hasRange(buffer, offset, length)) {
    rejectXlsxResource("invalid_archive");
  }
  let cursor = offset;
  while (cursor < end) {
    if (cursor > end - 4) {
      rejectXlsxResource("invalid_archive");
    }
    const fieldId = buffer.readUInt16LE(cursor);
    const fieldBytes = buffer.readUInt16LE(cursor + 2);
    cursor += 4;
    if (cursor > end - fieldBytes) {
      rejectXlsxResource("invalid_archive");
    }
    if (fieldId === ZIP64_EXTRA_FIELD_ID) {
      return true;
    }
    cursor += fieldBytes;
  }
  return false;
}

function assertSupportedEntry(input: {
  flags: number;
  method: number;
  compressedBytes: number;
  expandedBytes: number;
  limits: XlsxResourceLimits;
}) {
  if (
    (input.flags & (ZIP_ENCRYPTED_FLAG | ZIP_STRONG_ENCRYPTION_FLAG)) !== 0 ||
    (input.method !== 0 && input.method !== 8) ||
    input.compressedBytes === ZIP64_UINT32_SENTINEL ||
    input.expandedBytes === ZIP64_UINT32_SENTINEL ||
    input.expandedBytes > input.limits.maxEntryExpandedBytes ||
    (input.expandedBytes > 0 && input.compressedBytes === 0) ||
    (input.method === 0 && input.compressedBytes !== input.expandedBytes)
  ) {
    rejectXlsxResource();
  }
  const compressionRatio =
    input.expandedBytes / Math.max(1, input.compressedBytes);
  if (compressionRatio > input.limits.maxCompressionRatio) {
    rejectXlsxResource();
  }
}

function inflateEntryWithinLimits(input: {
  buffer: Buffer;
  dataOffset: number;
  compressedBytes: number;
  method: number;
  maxOutputBytes: number;
}) {
  const compressed = input.buffer.subarray(
    input.dataOffset,
    input.dataOffset + input.compressedBytes,
  );
  if (input.method === 0) {
    return compressed;
  }
  try {
    return inflateRawSync(compressed, {
      maxOutputLength: Math.max(1, input.maxOutputBytes + 1),
    });
  } catch {
    rejectXlsxResource();
  }
}

type ArchiveWorkbookResourceState = {
  xmlElements: number;
  worksheetEntries: number;
  declaredWorksheets: number;
  cells: number;
  textCharacters: number;
};

function getColumnNumber(columnName: string) {
  let columnNumber = 0;
  for (const character of columnName.toUpperCase()) {
    columnNumber = columnNumber * 26 + character.charCodeAt(0) - 64;
  }
  return columnNumber;
}

function countXmlElements(xml: string, pattern: RegExp, maximum: number) {
  let count = 0;
  for (let match = pattern.exec(xml); match; match = pattern.exec(xml)) {
    count += 1;
    if (count > maximum) {
      rejectXlsxResource("workbook_resource_limit_exceeded");
    }
  }
  return count;
}

function countXmlTextCharacters(
  xml: string,
  state: ArchiveWorkbookResourceState,
  limits: XlsxResourceLimits,
) {
  for (const tagName of ["t", "f", "v"] as const) {
    const pattern = new RegExp(
      `<(?:[a-z_][\\w.-]*:)?${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[a-z_][\\w.-]*:)?${tagName}>`,
      "giu",
    );
    for (let match = pattern.exec(xml); match; match = pattern.exec(xml)) {
      const characters = match[1]?.length ?? 0;
      if (characters > limits.maxCellTextCharacters) {
        rejectXlsxResource("workbook_resource_limit_exceeded");
      }
      state.textCharacters += characters;
      if (state.textCharacters > limits.maxTextCharacters) {
        rejectXlsxResource("workbook_resource_limit_exceeded");
      }
    }
  }
}

function assertXmlWorkbookResourceLimits(input: {
  entryName: string;
  expanded: Buffer;
  state: ArchiveWorkbookResourceState;
  limits: XlsxResourceLimits;
}) {
  const normalizedEntryName = input.entryName.toLowerCase();
  const isXml = normalizedEntryName.endsWith(".xml")
    || normalizedEntryName.endsWith(".rels");
  if (!isXml) {
    return;
  }

  const xml = input.expanded.toString("utf8");
  if (!Buffer.from(xml, "utf8").equals(input.expanded)) {
    rejectXlsxResource("invalid_archive");
  }
  if (/<!doctype\b|<!entity\b/iu.test(xml)) {
    rejectXlsxResource("invalid_archive");
  }
  input.state.xmlElements += countXmlElements(
    xml,
    /<(?:[a-z_][\w.-]*:)?[a-z_][\w.-]*(?:\s|\/?>)/giu,
    input.limits.maxXmlElements - input.state.xmlElements,
  );
  if (input.state.xmlElements > input.limits.maxXmlElements) {
    rejectXlsxResource("workbook_resource_limit_exceeded");
  }

  const isWorksheet = /^xl\/worksheets\/[^/]+\.xml$/iu.test(input.entryName);
  const containsCellText =
    isWorksheet ||
    normalizedEntryName === "xl/sharedstrings.xml" ||
    /^xl\/comments[^/]*\.xml$/iu.test(input.entryName);
  if (
    !isWorksheet &&
    !containsCellText &&
    input.entryName.toLowerCase() !== "xl/workbook.xml"
  ) {
    return;
  }

  if (normalizedEntryName === "xl/workbook.xml") {
    input.state.declaredWorksheets += countXmlElements(
      xml,
      /<(?:[a-z_][\w.-]*:)?sheet(?:\s|\/>)/giu,
      input.limits.maxWorksheets,
    );
    if (input.state.declaredWorksheets > input.limits.maxWorksheets) {
      rejectXlsxResource("workbook_resource_limit_exceeded");
    }
  }
  if (isWorksheet) {
    input.state.worksheetEntries += 1;
    if (input.state.worksheetEntries > input.limits.maxWorksheets) {
      rejectXlsxResource("workbook_resource_limit_exceeded");
    }
    countXmlElements(
      xml,
      /<(?:[a-z_][\w.-]*:)?row(?:\s|\/?>)/giu,
      input.limits.maxRowsPerWorksheet,
    );
    input.state.cells += countXmlElements(
      xml,
      /<(?:[a-z_][\w.-]*:)?c(?:\s|\/?>)/giu,
      input.limits.maxCells - input.state.cells,
    );
    if (input.state.cells > input.limits.maxCells) {
      rejectXlsxResource("workbook_resource_limit_exceeded");
    }

    const rowReferencePattern =
      /<(?:[a-z_][\w.-]*:)?row\b[^>]*\br=(?:"(\d+)"|'(\d+)')/giu;
    for (
      let match = rowReferencePattern.exec(xml);
      match;
      match = rowReferencePattern.exec(xml)
    ) {
      if (Number(match[1] ?? match[2]) > input.limits.maxRowsPerWorksheet) {
        rejectXlsxResource("workbook_resource_limit_exceeded");
      }
    }

    const cellReferencePattern =
      /<(?:[a-z_][\w.-]*:)?c\b[^>]*\br=(?:"([a-z]+)(\d+)"|'([a-z]+)(\d+)')/giu;
    for (
      let match = cellReferencePattern.exec(xml);
      match;
      match = cellReferencePattern.exec(xml)
    ) {
      const columnName = match[1] ?? match[3] ?? "";
      const rowNumber = match[2] ?? match[4];
      if (
        getColumnNumber(columnName) > input.limits.maxColumnsPerWorksheet ||
        Number(rowNumber) > input.limits.maxRowsPerWorksheet
      ) {
        rejectXlsxResource("workbook_resource_limit_exceeded");
      }
    }
  }
  if (containsCellText) {
    countXmlTextCharacters(xml, input.state, input.limits);
  }
}

export function assertXlsxArchiveResourceLimits(
  buffer: Buffer,
  limits: XlsxResourceLimits = XLSX_RESOURCE_LIMITS,
) {
  assertPositiveLimits(limits);
  if (buffer.length === 0 || buffer.length > limits.maxArchiveBytes) {
    rejectXlsxResource();
  }

  const endOffset = findEndOfCentralDirectory(buffer);
  const diskNumber = buffer.readUInt16LE(endOffset + 4);
  const centralDirectoryDisk = buffer.readUInt16LE(endOffset + 6);
  const entriesOnDisk = buffer.readUInt16LE(endOffset + 8);
  const entryCount = buffer.readUInt16LE(endOffset + 10);
  const centralDirectoryBytes = buffer.readUInt32LE(endOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(endOffset + 16);

  if (
    diskNumber !== 0 ||
    centralDirectoryDisk !== 0 ||
    entriesOnDisk !== entryCount ||
    entriesOnDisk === ZIP64_UINT16_SENTINEL ||
    entryCount === ZIP64_UINT16_SENTINEL ||
    centralDirectoryBytes === ZIP64_UINT32_SENTINEL ||
    centralDirectoryOffset === ZIP64_UINT32_SENTINEL ||
    entryCount === 0 ||
    entryCount > limits.maxEntries ||
    !hasRange(buffer, centralDirectoryOffset, centralDirectoryBytes) ||
    centralDirectoryOffset + centralDirectoryBytes !== endOffset
  ) {
    rejectXlsxResource("invalid_archive");
  }

  const centralDirectoryEnd = centralDirectoryOffset + centralDirectoryBytes;
  let cursor = centralDirectoryOffset;
  let totalExpandedBytes = 0;
  const workbookResourceState: ArchiveWorkbookResourceState = {
    xmlElements: 0,
    worksheetEntries: 0,
    declaredWorksheets: 0,
    cells: 0,
    textCharacters: 0,
  };

  for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
    if (
      !hasRange(buffer, cursor, CENTRAL_DIRECTORY_ENTRY_BYTES) ||
      cursor > centralDirectoryEnd - CENTRAL_DIRECTORY_ENTRY_BYTES ||
      buffer.readUInt32LE(cursor) !== CENTRAL_DIRECTORY_ENTRY_SIGNATURE
    ) {
      rejectXlsxResource("invalid_archive");
    }

    const flags = buffer.readUInt16LE(cursor + 8);
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedBytes = buffer.readUInt32LE(cursor + 20);
    const expandedBytes = buffer.readUInt32LE(cursor + 24);
    const filenameBytes = buffer.readUInt16LE(cursor + 28);
    const extraBytes = buffer.readUInt16LE(cursor + 30);
    const commentBytes = buffer.readUInt16LE(cursor + 32);
    const startingDisk = buffer.readUInt16LE(cursor + 34);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
    const entryBytes =
      CENTRAL_DIRECTORY_ENTRY_BYTES + filenameBytes + extraBytes + commentBytes;
    const filenameOffset = cursor + CENTRAL_DIRECTORY_ENTRY_BYTES;

    if (
      filenameBytes === 0 ||
      startingDisk !== 0 ||
      localHeaderOffset === ZIP64_UINT32_SENTINEL ||
      !hasRange(buffer, cursor, entryBytes) ||
      cursor + entryBytes > centralDirectoryEnd ||
      hasZip64ExtraField(
        buffer,
        cursor + CENTRAL_DIRECTORY_ENTRY_BYTES + filenameBytes,
        extraBytes,
      )
    ) {
      rejectXlsxResource("invalid_archive");
    }

    assertSupportedEntry({
      flags,
      method,
      compressedBytes,
      expandedBytes,
      limits,
    });
    totalExpandedBytes += expandedBytes;
    if (totalExpandedBytes > limits.maxExpandedBytes) {
      rejectXlsxResource();
    }

    if (
      !hasRange(buffer, localHeaderOffset, LOCAL_FILE_HEADER_BYTES) ||
      localHeaderOffset >= centralDirectoryOffset ||
      buffer.readUInt32LE(localHeaderOffset) !== LOCAL_FILE_HEADER_SIGNATURE
    ) {
      rejectXlsxResource("invalid_archive");
    }
    const localFlags = buffer.readUInt16LE(localHeaderOffset + 6);
    const localMethod = buffer.readUInt16LE(localHeaderOffset + 8);
    const localCompressedBytes = buffer.readUInt32LE(localHeaderOffset + 18);
    const localExpandedBytes = buffer.readUInt32LE(localHeaderOffset + 22);
    const localFilenameBytes = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraBytes = buffer.readUInt16LE(localHeaderOffset + 28);
    const localFilenameOffset = localHeaderOffset + LOCAL_FILE_HEADER_BYTES;
    const localDataOffset =
      localHeaderOffset + LOCAL_FILE_HEADER_BYTES + localFilenameBytes + localExtraBytes;

    if (
      localFlags !== flags ||
      localMethod !== method ||
      localFilenameBytes !== filenameBytes ||
      localCompressedBytes === ZIP64_UINT32_SENTINEL ||
      localExpandedBytes === ZIP64_UINT32_SENTINEL ||
      !hasRange(
        buffer,
        localHeaderOffset,
        LOCAL_FILE_HEADER_BYTES + localFilenameBytes + localExtraBytes,
      ) ||
      hasZip64ExtraField(
        buffer,
        localHeaderOffset + LOCAL_FILE_HEADER_BYTES + localFilenameBytes,
        localExtraBytes,
      ) ||
      localDataOffset > centralDirectoryOffset - compressedBytes
    ) {
      rejectXlsxResource("invalid_archive");
    }
    if (
      !buffer
        .subarray(filenameOffset, filenameOffset + filenameBytes)
        .equals(
          buffer.subarray(
            localFilenameOffset,
            localFilenameOffset + localFilenameBytes,
          ),
        )
    ) {
      rejectXlsxResource("invalid_archive");
    }
    if (
      (flags & ZIP_DATA_DESCRIPTOR_FLAG) === 0 &&
      (localCompressedBytes !== compressedBytes ||
        localExpandedBytes !== expandedBytes)
    ) {
      rejectXlsxResource("invalid_archive");
    }
    const expanded = inflateEntryWithinLimits({
      buffer,
      dataOffset: localDataOffset,
      compressedBytes,
      method,
      maxOutputBytes: Math.min(
        limits.maxEntryExpandedBytes,
        limits.maxExpandedBytes - (totalExpandedBytes - expandedBytes),
      ),
    });
    if (expanded.byteLength !== expandedBytes) {
      rejectXlsxResource("invalid_archive");
    }
    assertXmlWorkbookResourceLimits({
      entryName: buffer
        .subarray(filenameOffset, filenameOffset + filenameBytes)
        .toString("utf8"),
      expanded,
      state: workbookResourceState,
      limits,
    });

    cursor += entryBytes;
  }

  if (cursor !== centralDirectoryEnd) {
    rejectXlsxResource("invalid_archive");
  }
}

function getCellTextCharacterCount(cell: ExcelJS.Cell) {
  const value = cell.value;
  if (typeof value === "string") {
    return value.length;
  }
  if (!value || typeof value !== "object") {
    return 0;
  }

  let characters = 0;
  const objectValue = value as unknown as Record<string, unknown>;
  for (const field of Object.values(objectValue)) {
    if (typeof field === "string") {
      characters += field.length;
    }
  }
  if (Array.isArray(objectValue.richText)) {
    for (const part of objectValue.richText) {
      if (part && typeof part === "object" && "text" in part) {
        const text = (part as { text?: unknown }).text;
        if (typeof text === "string") {
          characters += text.length;
        }
      }
    }
  }
  return characters;
}

export function assertXlsxWorkbookResourceLimits(
  workbook: ExcelJS.Workbook,
  limits: XlsxResourceLimits = XLSX_RESOURCE_LIMITS,
) {
  try {
    assertPositiveLimits(limits);
  } catch {
    rejectXlsxResource("workbook_resource_limit_exceeded");
  }
  if (workbook.worksheets.length === 0 || workbook.worksheets.length > limits.maxWorksheets) {
    rejectXlsxResource("workbook_resource_limit_exceeded");
  }

  let cellCount = 0;
  let textCharacters = 0;
  for (const worksheet of workbook.worksheets) {
    if (
      worksheet.rowCount > limits.maxRowsPerWorksheet ||
      worksheet.columnCount > limits.maxColumnsPerWorksheet
    ) {
      rejectXlsxResource("workbook_resource_limit_exceeded");
    }
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      if (row.number > limits.maxRowsPerWorksheet) {
        rejectXlsxResource("workbook_resource_limit_exceeded");
      }
      row.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
        if (columnNumber > limits.maxColumnsPerWorksheet) {
          rejectXlsxResource("workbook_resource_limit_exceeded");
        }
        cellCount += 1;
        if (cellCount > limits.maxCells) {
          rejectXlsxResource("workbook_resource_limit_exceeded");
        }
        const cellTextCharacters = getCellTextCharacterCount(cell);
        if (cellTextCharacters > limits.maxCellTextCharacters) {
          rejectXlsxResource("workbook_resource_limit_exceeded");
        }
        textCharacters += cellTextCharacters;
        if (textCharacters > limits.maxTextCharacters) {
          rejectXlsxResource("workbook_resource_limit_exceeded");
        }
      });
    });
  }
}

export async function loadXlsxWorkbookWithinResourceLimits(buffer: Buffer) {
  assertXlsxArchiveResourceLimits(buffer);
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(
      buffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
    );
  } catch {
    rejectXlsxResource("invalid_archive");
  }
  assertXlsxWorkbookResourceLimits(workbook);
  return workbook;
}
