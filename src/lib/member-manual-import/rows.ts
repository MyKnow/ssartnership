import {
  MANUAL_MEMBER_IMPORT_LIMITS,
  type ManualMemberImportRawRow,
} from "./shared";

export type ManualMemberImportEditableRow = {
  rowNumber: number;
  generation: string;
  name: string;
  campus: string;
  mmId: string;
  email: string;
  photoFilename: string;
};

function getNextRowNumber(rows: readonly ManualMemberImportEditableRow[]) {
  return Math.max(1, ...rows.map((row) => row.rowNumber)) + 1;
}

export function createManualMemberImportEditableRow(
  rowNumber: number,
  input: Partial<Omit<ManualMemberImportEditableRow, "rowNumber">> = {},
): ManualMemberImportEditableRow {
  return {
    rowNumber,
    generation: input.generation ?? "",
    name: input.name ?? "",
    campus: input.campus ?? "",
    mmId: input.mmId ?? "",
    email: input.email ?? "",
    photoFilename: input.photoFilename ?? "",
  };
}

export function addManualMemberImportEditableRow(
  rows: readonly ManualMemberImportEditableRow[],
) {
  if (rows.length >= MANUAL_MEMBER_IMPORT_LIMITS.maxRows) {
    return [...rows];
  }
  return [...rows, createManualMemberImportEditableRow(getNextRowNumber(rows))];
}

export function appendManualMemberImportWorkbookRows(
  rows: readonly ManualMemberImportEditableRow[],
  workbookRows: readonly ManualMemberImportRawRow[],
) {
  const capacity = Math.max(
    0,
    MANUAL_MEMBER_IMPORT_LIMITS.maxRows - rows.length,
  );
  const appendedRows = workbookRows.slice(0, capacity).map((row, index) =>
    createManualMemberImportEditableRow(getNextRowNumber(rows) + index, {
      generation: String(row.generation ?? "").trim(),
      name: String(row.name ?? "").trim(),
      campus: String(row.campus ?? "").trim(),
      mmId: String(row.mmId ?? "").trim(),
      email: String(row.email ?? "").trim(),
      photoFilename: String(row.photoFilename ?? "").trim(),
    }),
  );
  return {
    rows: [...rows, ...appendedRows],
    appendedCount: appendedRows.length,
    skippedCount: workbookRows.length - appendedRows.length,
  };
}

export function toManualMemberImportRawRows(
  rows: readonly ManualMemberImportEditableRow[],
): ManualMemberImportRawRow[] {
  return rows.map((row) => ({ ...row }));
}
