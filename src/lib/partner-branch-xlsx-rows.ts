/**
 * 지점 목록 XLSX의 헤더 정규화·셀 텍스트·행 매핑 규칙.
 *
 * 공개 제휴 등록 폼의 클라이언트 미리보기(PartnerBranchListEditor)와 서버 제출 검증
 * (partner-registration-submit.server)이 같은 규칙으로 행을 읽도록 이 모듈만 import한다.
 * ExcelJS 타입에 의존하지 않는 구조적 타입만 받아 클라이언트 번들에 exceljs를 끌어오지 않는다.
 */

export type PartnerBranchXlsxCellLike = {
  value?: unknown;
};

export type PartnerBranchXlsxRowLike = {
  eachCell: (
    callback: (cell: PartnerBranchXlsxCellLike, columnNumber: number) => void,
  ) => void;
};

export type PartnerBranchXlsxWorksheetLike = {
  getRow: (rowNumber: number) => PartnerBranchXlsxRowLike;
  eachRow: (
    callback: (row: PartnerBranchXlsxRowLike, rowNumber: number) => void,
  ) => void;
};

export type PartnerBranchXlsxField =
  | "benefitGroupLabel"
  | "branchName"
  | "address"
  | "branchCode"
  | "branchType"
  | "mapUrl"
  | "phone"
  | "memo";

/** 정규화된 헤더 별칭. 앞선 별칭이 우선한다(예: `직영/가맹`이 있으면 `지점유형`보다 먼저 쓴다). */
export const PARTNER_BRANCH_XLSX_HEADER_ALIASES = {
  benefitGroupLabel: ["혜택그룹"],
  branchName: ["지점명"],
  address: ["주소"],
  branchCode: ["지점코드"],
  branchType: ["직영/가맹", "지점유형"],
  mapUrl: ["지도URL"],
  phone: ["전화번호"],
  memo: ["메모", "운영메모"],
} as const satisfies Record<PartnerBranchXlsxField, readonly string[]>;

export type PartnerBranchXlsxRowValues = Partial<Record<PartnerBranchXlsxField, string>>;

export type PartnerBranchXlsxRow = {
  /** 워크시트 기준 1-based 행 번호(헤더가 1행). */
  rowNumber: number;
  values: PartnerBranchXlsxRowValues;
};

export function normalizePartnerBranchXlsxHeader(value: string) {
  return value.replace(/\s+/g, "");
}

function getObjectCellText(value: object) {
  const record = value as {
    text?: unknown;
    result?: unknown;
    richText?: unknown;
    hyperlink?: unknown;
  };
  if (typeof record.text === "string") {
    return record.text;
  }
  if ("result" in record) {
    const result = record.result;
    if (result instanceof Date) {
      return result.toISOString().slice(0, 10);
    }
    return result === null || result === undefined ? "" : String(result);
  }
  if (Array.isArray(record.richText)) {
    return record.richText
      .map((item) => (typeof item?.text === "string" ? item.text : ""))
      .join("");
  }
  if (typeof record.hyperlink === "string") {
    return record.hyperlink;
  }
  return null;
}

/**
 * ExcelJS 셀 값을 화면·검증에 쓰는 문자열로 바꾼다.
 * 날짜는 시간대와 무관한 `YYYY-MM-DD`, 하이퍼링크·수식·서식 텍스트는 표시 텍스트를 쓴다.
 */
export function getPartnerBranchXlsxCellText(cell: PartnerBranchXlsxCellLike) {
  const value = cell.value;
  if (value === null || value === undefined) {
    return "";
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "object") {
    const text = getObjectCellText(value);
    if (text !== null) {
      return text.trim();
    }
  }
  return String(value).trim();
}

function pickField(
  rowValues: Map<string, string>,
  field: PartnerBranchXlsxField,
) {
  for (const header of PARTNER_BRANCH_XLSX_HEADER_ALIASES[field]) {
    const value = rowValues.get(header);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

/**
 * 첫 행을 헤더로 읽고 값이 하나라도 있는 데이터 행만 필드 매핑해 돌려준다.
 * 알 수 없는 헤더 열은 무시한다. 필드 값의 의미 검증은 호출자(정규화·검증 규칙)가 한다.
 */
export function readPartnerBranchXlsxRows(
  worksheet: PartnerBranchXlsxWorksheetLike,
): PartnerBranchXlsxRow[] {
  const headerByColumn = new Map<number, string>();
  worksheet.getRow(1).eachCell((cell, columnNumber) => {
    const header = normalizePartnerBranchXlsxHeader(
      getPartnerBranchXlsxCellText(cell),
    );
    if (header) {
      headerByColumn.set(columnNumber, header);
    }
  });

  const rows: PartnerBranchXlsxRow[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }
    const rowValues = new Map<string, string>();
    row.eachCell((cell, columnNumber) => {
      const header = headerByColumn.get(columnNumber);
      if (!header) {
        return;
      }
      rowValues.set(header, getPartnerBranchXlsxCellText(cell));
    });
    if (!Array.from(rowValues.values()).some(Boolean)) {
      return;
    }
    const values: PartnerBranchXlsxRowValues = {};
    for (const field of Object.keys(
      PARTNER_BRANCH_XLSX_HEADER_ALIASES,
    ) as PartnerBranchXlsxField[]) {
      const value = pickField(rowValues, field);
      if (value !== undefined) {
        values[field] = value;
      }
    }
    rows.push({ rowNumber, values });
  });
  return rows;
}
