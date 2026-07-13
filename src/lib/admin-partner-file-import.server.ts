import ExcelJS from "exceljs";
import { isPartnerBenefitActionType } from "@/lib/partner-benefit-action";
import { ONLINE_PARTNER_LOCATION } from "@/lib/partner-service-mode";
import {
  isValidEmail,
  sanitizeHttpUrl,
  sanitizePartnerLinkValue,
  validateDateRange,
} from "@/lib/validation";
import {
  ADMIN_PARTNER_FILE_BENEFIT_ACTION_LABELS,
  ADMIN_PARTNER_FILE_MAX_BYTES,
  ADMIN_PARTNER_FILE_SERVICE_MODE_LABELS,
  ADMIN_PARTNER_FILE_TEMPLATE_VERSION,
  getAdminPartnerFileInputHeaders,
  type AdminPartnerFileCategory,
  type AdminPartnerFileCompany,
  type AdminPartnerFileParseResult,
  type AdminPartnerFileTemplateOptions,
} from "@/lib/admin-partner-file-import";

const INPUT_SHEET_NAME = "입력";
const GUIDE_SHEET_NAME = "작성 가이드";
const LIST_SHEET_NAME = "목록";
const META_SHEET_NAME = "_meta";
const INPUT_HEADER_ROW = 1;
const FIRST_INPUT_ROW = 2;
const INPUT_FIELD_COLUMN = 1;
const INPUT_EXAMPLE_COLUMN = 2;
const INPUT_VALUE_COLUMN = 3;
const SSAFY_BLUE = "1428A0";
const SSAFY_SKY = "00AEEF";
const SSAFY_NAVY = "0B1B3F";
const SSAFY_SOFT = "EAF4FF";
const SSAFY_LINE = "B8CCE8";
const REQUIRED_INPUT_HEADERS = new Set(["제휴처명", "카테고리"]);
const LEGACY_INPUT_HEADER_ALIASES: Readonly<Record<string, string>> = {
  브랜드명: "제휴처명",
  "브랜드 전화번호": "제휴처 전화번호",
  협력사명: "파트너사명",
  "협력사 설명": "파트너사 설명",
};
const URL_INPUT_HEADERS = new Set([
  "문의 링크",
  "지도 URL",
  "사이트 링크",
  "혜택 이용 링크",
]);

const SAMPLE_GUIDE_ROWS = [
  ["제휴처명", "필수", "사용자에게 노출되는 서비스 또는 매장 이름"],
  ["카테고리", "필수", "드롭다운에서 선택하거나 새 카테고리명을 직접 입력"],
  ["제휴처 전화번호", "선택", "파트너사 담당자 번호가 아닌 제휴처/지점 연락처"],
  ["상세 설명", "선택", "구성원이 제휴처를 이해할 수 있도록 1200자 이내로 입력"],
  ["혜택", "선택", "여러 개면 | 로 구분. 예: 아메리카노 할인|베이커리 할인"],
  ["이용 조건", "선택", "여러 개면 | 로 구분. 예: 싸트너십 인증|현장 제시"],
  ["태그", "선택", "여러 개면 | 로 구분. 예: 카페|역삼"],
  ["이미지", "폼에서 등록", "파일 값 반영 후 단건 추가 폼에서 직접 등록합니다."],
  [
    "노출 상태 / 혜택 공개 범위 / 노출 캠퍼스 / 적용 대상",
    "폼에서 지정",
    "파일에는 넣지 않습니다. 업로드 후 단건 추가 폼에서 관리자가 직접 지정합니다.",
  ],
] as const;

function normalizeKey(value: string) {
  return value.trim().toLowerCase();
}

function getCellString(cell: ExcelJS.Cell) {
  const value = cell.value;
  if (value === null || value === undefined) {
    return "";
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") {
      return value.text.trim();
    }
    if ("result" in value) {
      return String(value.result ?? "").trim();
    }
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((item) => item.text).join("").trim();
    }
    if ("hyperlink" in value && typeof value.hyperlink === "string") {
      return value.hyperlink.trim();
    }
  }
  return String(value).trim();
}

function getLayoutHeaders(sheet: ExcelJS.Worksheet) {
  const row = sheet.getRow(INPUT_HEADER_ROW);
  return [
    getCellString(row.getCell(1)),
    getCellString(row.getCell(2)),
    getCellString(row.getCell(3)),
  ];
}

function hasVisibleRowValue(row: ExcelJS.Row) {
  return Array.isArray(row.values)
    ? row.values.some(
        (value, index) =>
          index > 0 &&
          value !== null &&
          value !== undefined &&
          String(value).trim() !== "",
      )
    : row.actualCellCount > 0;
}

function mapVerticalInputRows(sheet: ExcelJS.Worksheet, maxInputRow: number) {
  const mapped = new Map<string, string>();
  const outOfRangeRows: number[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber < FIRST_INPUT_ROW) {
      return;
    }
    if (rowNumber > maxInputRow) {
      if (hasVisibleRowValue(row)) {
        outOfRangeRows.push(rowNumber);
      }
      return;
    }
    const field = getCellString(row.getCell(INPUT_FIELD_COLUMN));
    if (!field) {
      return;
    }
    const canonicalField = LEGACY_INPUT_HEADER_ALIASES[field] ?? field;
    mapped.set(canonicalField, getCellString(row.getCell(INPUT_VALUE_COLUMN)));
  });

  return { mapped, outOfRangeRows };
}

function getValue(row: Map<string, string>, header: string) {
  return row.get(header)?.trim() ?? "";
}

function resolveCategory(value: string, categories: AdminPartnerFileCategory[]) {
  const normalized = normalizeKey(value);
  return (
    categories.find(
      (category) =>
        category.id === value ||
        normalizeKey(category.key ?? "") === normalized ||
        category.label.trim() === value,
    ) ?? null
  );
}

function resolveCompanyByName(value: string, companies: AdminPartnerFileCompany[]) {
  const normalized = normalizeKey(value);
  if (!normalized) {
    return null;
  }
  const matched = companies.filter(
    (company) => normalizeKey(company.name) === normalized,
  );
  return matched.length === 1 ? matched[0] : null;
}

function parseDelimitedValues(value: string) {
  return Array.from(
    new Set(
      value
        .split("|")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function toColumnName(index: number) {
  let remaining = index;
  let name = "";
  while (remaining > 0) {
    const modulo = (remaining - 1) % 26;
    name = String.fromCharCode(65 + modulo) + name;
    remaining = Math.floor((remaining - modulo) / 26);
  }
  return name;
}

function cellAddress(columnIndex: number, rowNumber = FIRST_INPUT_ROW) {
  return `${toColumnName(columnIndex)}${rowNumber}`;
}

function requiredFormula(address: string) {
  return `LEN(TRIM(${address}))>0`;
}

function optionalUrlFormula(address: string) {
  return `OR(LEN(TRIM(${address}))=0,LEFT(LOWER(TRIM(${address})),7)="http://",LEFT(LOWER(TRIM(${address})),8)="https://")`;
}

function optionalEmailFormula(address: string) {
  return `OR(LEN(TRIM(${address}))=0,AND(ISNUMBER(FIND("@",${address})),ISNUMBER(FIND(".",${address})),LEN(TRIM(${address}))<=254))`;
}

function optionalDateFormula(address: string) {
  return `OR(LEN(TRIM(${address}))=0,ISNUMBER(${address}))`;
}

function delimitedTextFormula(address: string) {
  return `LEN(${address})<=1000`;
}

function getInputExample(
  header: string,
  options: AdminPartnerFileTemplateOptions,
) {
  const examples: Record<string, string> = {
    제휴처명: "카페 싸피 역삼본점",
    카테고리: "카페",
    시작일: "2026-05-01",
    종료일: "2026-12-31",
    "문의 링크": "https://pf.kakao.com/_cafessafy",
    "제휴처 전화번호": "02-3429-5100",
    "상세 설명": "SSAFY 서울캠퍼스 인근에서 이용하기 좋은 가상의 프랜차이즈 카페입니다.",
    파트너사명: "카페 싸피",
    담당자명: "김싸피",
    "담당자 이메일": "partner@cafessafy.example",
    "담당자 전화번호": "010-1500-1234",
    "파트너사 설명": "여러 지점을 운영하는 가상의 프랜차이즈 카페",
    혜택: "아메리카노 10% 할인|시그니처 라떼 500원 할인",
    "이용 조건": "싸트너십 인증|현장 제시",
    태그: "카페|역삼|프랜차이즈",
    위치: "서울 강남구 테헤란로 212 1층",
    "지도 URL": "https://map.naver.com/v5/search/카페%20싸피%20역삼본점",
    "사이트 링크": "https://cafessafy.example.com",
    "혜택 이용 링크": "https://cafessafy.example.com/coupon",
  };

  if (header === "혜택 이용 링크" && options.benefitActionType !== "external_link") {
    return "";
  }
  return examples[header] ?? "";
}

function getInputGuide(header: string, options: AdminPartnerFileTemplateOptions) {
  const guides: Record<string, string> = {
    제휴처명: "필수. 사용자에게 노출되는 서비스 또는 매장 이름입니다.",
    카테고리:
      "필수. 드롭다운에서 선택합니다. 목록에 없으면 새 카테고리명을 직접 입력합니다.",
    시작일: "선택. YYYY-MM-DD 형식으로 입력합니다.",
    종료일: "선택. YYYY-MM-DD 형식으로 입력합니다.",
    "문의 링크": "선택. 문의 채널 URL을 입력합니다.",
    "제휴처 전화번호": "선택. 파트너사 담당자 번호와 다른 제휴처/지점 연락처입니다.",
    "상세 설명": "선택. 상세 페이지에 표시할 제휴처 설명입니다. 1200자 이내로 입력합니다.",
    파트너사명: "선택. 기존 파트너사명과 정확히 같으면 자동 연결됩니다.",
    담당자명: "선택. 파트너사 담당자 이름입니다.",
    "담당자 이메일": "선택. 이메일 형식으로 입력합니다.",
    "담당자 전화번호": "선택. 연락 가능한 번호입니다.",
    "파트너사 설명": "선택. 파트너사 내부 설명입니다.",
    혜택: "선택. 여러 개면 | 로 구분합니다.",
    "이용 조건": "선택. 여러 개면 | 로 구분합니다.",
    태그: "선택. 여러 개면 | 로 구분합니다.",
    위치: "오프라인 서비스 필수. 사용자에게 보일 위치입니다.",
    "지도 URL": "선택. 지도 또는 위치 URL입니다.",
    "사이트 링크": "온라인 서비스용 링크입니다.",
    "혜택 이용 링크":
      options.benefitActionType === "external_link"
        ? "필수. 혜택 이용을 위해 이동할 URL입니다."
        : "현재 혜택 이용 방식에서는 사용하지 않습니다.",
  };
  return guides[header] ?? "선택 입력값입니다.";
}

function applyInputValidation(
  input: ExcelJS.Worksheet,
  header: string,
  rowNumber: number,
) {
  const address = cellAddress(INPUT_VALUE_COLUMN, rowNumber);
  const cell = input.getCell(rowNumber, INPUT_VALUE_COLUMN);

  if (REQUIRED_INPUT_HEADERS.has(header)) {
    cell.dataValidation = {
      type: "custom",
      allowBlank: false,
      formulae: [requiredFormula(address)],
      showErrorMessage: true,
      errorTitle: "필수 입력",
      error: `${header} 값을 입력해 주세요.`,
      showInputMessage: true,
      promptTitle: header,
      prompt: "필수 입력값입니다.",
    };
    return;
  }

  if (header === "담당자 이메일") {
    cell.dataValidation = {
      type: "custom",
      allowBlank: true,
      formulae: [optionalEmailFormula(address)],
      showErrorMessage: true,
      errorTitle: "이메일 확인",
      error: "이메일 형식으로 입력해 주세요. 예: partner@example.com",
      showInputMessage: true,
      promptTitle: "담당자 이메일",
      prompt: "선택 입력값입니다. 입력한다면 이메일 형식을 사용해 주세요.",
    };
    return;
  }

  if (header === "시작일" || header === "종료일") {
    cell.dataValidation = {
      type: "custom",
      allowBlank: true,
      formulae: [optionalDateFormula(address)],
      showErrorMessage: true,
      errorTitle: "날짜 확인",
      error: "날짜 형식으로 입력해 주세요. 예: 2026-05-01",
      showInputMessage: true,
      promptTitle: header,
      prompt: "선택 입력값입니다. 날짜 형식으로 입력해 주세요.",
    };
    cell.numFmt = "yyyy-mm-dd";
    return;
  }

  if (URL_INPUT_HEADERS.has(header)) {
    cell.dataValidation = {
      type: "custom",
      allowBlank: true,
      formulae: [optionalUrlFormula(address)],
      showErrorMessage: true,
      errorTitle: "URL 확인",
      error: "http:// 또는 https:// 로 시작하는 URL을 입력해 주세요.",
      showInputMessage: true,
      promptTitle: header,
      prompt: "http:// 또는 https:// 로 시작하는 URL을 입력해 주세요.",
    };
    return;
  }

  if (header === "혜택" || header === "이용 조건" || header === "태그") {
    cell.dataValidation = {
      type: "custom",
      allowBlank: true,
      formulae: [delimitedTextFormula(address)],
      showErrorMessage: true,
      errorTitle: "입력 길이 확인",
      error: "1000자 이하로 입력해 주세요. 여러 개면 | 로 구분합니다.",
      showInputMessage: true,
      promptTitle: header,
      prompt: "여러 개면 | 로 구분합니다.",
    };
  }
}

function styleInputSheet(input: ExcelJS.Worksheet, fieldCount: number) {
  input.views = [{ state: "frozen", ySplit: 1 }];
  input.columns = [
    { key: "field", width: 22 },
    { key: "example", width: 42 },
    { key: "value", width: 52 },
    { key: "guide", width: 58 },
  ];
  input.getRow(INPUT_HEADER_ROW).height = 30;
  input.getRow(INPUT_HEADER_ROW).font = {
    bold: true,
    color: { argb: "FFFFFFFF" },
  };
  input.getRow(INPUT_HEADER_ROW).alignment = {
    vertical: "middle",
    horizontal: "center",
  };

  for (let column = 1; column <= 4; column += 1) {
    const cell = input.getRow(INPUT_HEADER_ROW).getCell(column);
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: `FF${SSAFY_BLUE}` },
    };
    cell.border = {
      top: { style: "thin", color: { argb: `FF${SSAFY_BLUE}` } },
      left: { style: "thin", color: { argb: `FF${SSAFY_BLUE}` } },
      bottom: { style: "thin", color: { argb: `FF${SSAFY_BLUE}` } },
      right: { style: "thin", color: { argb: `FF${SSAFY_BLUE}` } },
    };
  }

  for (let rowNumber = FIRST_INPUT_ROW; rowNumber < FIRST_INPUT_ROW + fieldCount; rowNumber += 1) {
    const row = input.getRow(rowNumber);
    row.height = 28;
    row.alignment = { vertical: "middle", wrapText: true };
    row.getCell(INPUT_FIELD_COLUMN).font = {
      bold: true,
      color: { argb: `FF${SSAFY_NAVY}` },
    };
    row.getCell(INPUT_EXAMPLE_COLUMN).font = {
      color: { argb: "FF6B7A90" },
    };
    row.getCell(INPUT_VALUE_COLUMN).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFFFFF" },
    };
    row.getCell(INPUT_VALUE_COLUMN).border = {
      top: { style: "thin", color: { argb: `FF${SSAFY_SKY}` } },
      left: { style: "thin", color: { argb: `FF${SSAFY_SKY}` } },
      bottom: { style: "thin", color: { argb: `FF${SSAFY_SKY}` } },
      right: { style: "thin", color: { argb: `FF${SSAFY_SKY}` } },
    };
    row.getCell(4).font = { color: { argb: "FF496178" } };
    for (let column = 1; column <= 4; column += 1) {
      const cell = row.getCell(column);
      cell.border = {
        ...cell.border,
        bottom: { style: "thin", color: { argb: `FF${SSAFY_LINE}` } },
      };
      if (column !== INPUT_VALUE_COLUMN) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: column === INPUT_FIELD_COLUMN ? `FF${SSAFY_SOFT}` : "FFF8FBFF" },
        };
      }
    }
  }
}

function addMetaSheet(
  workbook: ExcelJS.Workbook,
  options: AdminPartnerFileTemplateOptions,
) {
  const sheet = workbook.addWorksheet(META_SHEET_NAME);
  sheet.state = "veryHidden";
  sheet.addRows([
    ["version", ADMIN_PARTNER_FILE_TEMPLATE_VERSION],
    ["serviceMode", options.serviceMode],
    ["benefitActionType", options.benefitActionType],
  ]);
}

function readMetaOptions(workbook: ExcelJS.Workbook) {
  const sheet = workbook.getWorksheet(META_SHEET_NAME);
  if (!sheet) {
    return null;
  }
  const values = new Map<string, string>();
  sheet.eachRow((row) => {
    values.set(getCellString(row.getCell(1)), getCellString(row.getCell(2)));
  });
  const version = values.get("version");
  const serviceMode = values.get("serviceMode");
  const benefitActionType = values.get("benefitActionType");
  if (
    version !== ADMIN_PARTNER_FILE_TEMPLATE_VERSION ||
    (serviceMode !== "offline" && serviceMode !== "online") ||
    !benefitActionType ||
    !(benefitActionType in ADMIN_PARTNER_FILE_BENEFIT_ACTION_LABELS)
  ) {
    return null;
  }
  return { serviceMode, benefitActionType } as AdminPartnerFileTemplateOptions;
}

export async function createAdminPartnerXlsxTemplate(
  options: AdminPartnerFileTemplateOptions,
  categories: AdminPartnerFileCategory[] = [],
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ssartnership";
  workbook.created = new Date();

  const input = workbook.addWorksheet(INPUT_SHEET_NAME, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  const headers = getAdminPartnerFileInputHeaders(options);
  input.addRow(["항목", "예시", "입력값", "작성 안내"]);
  for (const header of headers) {
    input.addRow([
      header,
      getInputExample(header, options),
      "",
      getInputGuide(header, options),
    ]);
  }
  styleInputSheet(input, headers.length);
  input.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 4 },
  };

  headers.forEach((header, index) => {
    applyInputValidation(input, header, FIRST_INPUT_ROW + index);
  });

  if (options.serviceMode === "offline") {
    const locationRowNumber = FIRST_INPUT_ROW + headers.indexOf("위치");
    if (locationRowNumber >= FIRST_INPUT_ROW) {
      const address = cellAddress(INPUT_VALUE_COLUMN, locationRowNumber);
      input.getCell(locationRowNumber, INPUT_VALUE_COLUMN).dataValidation = {
        type: "custom",
        allowBlank: false,
        formulae: [requiredFormula(address)],
        showErrorMessage: true,
        errorTitle: "위치 확인",
        error: "오프라인 서비스는 위치를 입력해야 합니다.",
      };
    }
  }

  if (options.benefitActionType === "external_link") {
    const benefitActionLinkRowNumber =
      FIRST_INPUT_ROW + headers.indexOf("혜택 이용 링크");
    if (benefitActionLinkRowNumber >= FIRST_INPUT_ROW) {
      const address = cellAddress(INPUT_VALUE_COLUMN, benefitActionLinkRowNumber);
      input.getCell(benefitActionLinkRowNumber, INPUT_VALUE_COLUMN).dataValidation = {
        type: "custom",
        allowBlank: false,
        formulae: [
          `AND(${requiredFormula(address)},${optionalUrlFormula(address)})`,
        ],
        showErrorMessage: true,
        errorTitle: "혜택 이용 링크 확인",
        error:
          "외부 링크 이용 방식은 http:// 또는 https:// 로 시작하는 혜택 이용 링크가 필요합니다.",
      };
    }
  }

  const categoryRowNumber = FIRST_INPUT_ROW + headers.indexOf("카테고리");
  if (categoryRowNumber >= FIRST_INPUT_ROW && categories.length > 0) {
    input.getCell(categoryRowNumber, INPUT_VALUE_COLUMN).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: [`='${LIST_SHEET_NAME}'!$A$2:$A$${categories.length + 1}`],
      showErrorMessage: false,
      showInputMessage: true,
      promptTitle: "카테고리",
      prompt: "드롭다운에서 선택하거나, 목록에 없으면 새 카테고리명을 직접 입력해 주세요.",
    };
  }

  const guide = workbook.addWorksheet(GUIDE_SHEET_NAME);
  guide.addRow(["선택 기준", "값"]);
  guide.addRow(["서비스 형태", ADMIN_PARTNER_FILE_SERVICE_MODE_LABELS[options.serviceMode]]);
  guide.addRow([
    "혜택 이용 방식",
    ADMIN_PARTNER_FILE_BENEFIT_ACTION_LABELS[options.benefitActionType],
  ]);
  guide.addRow([]);
  guide.addRow(["필드", "필수 여부", "작성 방법"]);
  guide.addRows(SAMPLE_GUIDE_ROWS.map((row) => [...row]));
  guide.columns = [
    { width: 22 },
    { width: 16 },
    { width: 54 },
  ];
  guide.getRow(1).font = { bold: true };
  guide.getRow(5).font = { bold: true };

  const list = workbook.addWorksheet(LIST_SHEET_NAME);
  list.state = "veryHidden";
  list.addRow(["카테고리"]);
  list.addRows(categories.map((category) => [category.label]));
  addMetaSheet(workbook, options);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function parseAdminPartnerXlsxDraft({
  fileBuffer,
  categories,
  companies,
}: {
  fileBuffer: Buffer;
  categories: AdminPartnerFileCategory[];
  companies: AdminPartnerFileCompany[];
}): Promise<AdminPartnerFileParseResult> {
  if (fileBuffer.byteLength > ADMIN_PARTNER_FILE_MAX_BYTES) {
    return { ok: false, errors: ["XLSX 파일은 1MB 이하만 업로드할 수 있습니다."] };
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(
      fileBuffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
    );
  } catch {
    return { ok: false, errors: ["XLSX 파일을 읽지 못했습니다."] };
  }

  const options = readMetaOptions(workbook);
  if (!options) {
    return {
      ok: false,
      errors: ["싸트너십 템플릿 파일이 아니거나 템플릿 버전이 올바르지 않습니다."],
    };
  }

  const input = workbook.getWorksheet(INPUT_SHEET_NAME);
  if (!input) {
    return { ok: false, errors: ["입력 시트를 찾을 수 없습니다."] };
  }

  const expectedHeaders = getAdminPartnerFileInputHeaders(options) as string[];
  const layoutHeaders = getLayoutHeaders(input);
  const { mapped: inputRows, outOfRangeRows } = mapVerticalInputRows(
    input,
    FIRST_INPUT_ROW + expectedHeaders.length - 1,
  );
  const rowLabels = Array.from(inputRows.keys());
  const unknownHeaders = rowLabels.filter((header) => !expectedHeaders.includes(header));
  const missingHeaders = expectedHeaders.filter((header) => !inputRows.has(header));
  const errors: string[] = [];

  if (
    layoutHeaders[0] !== "항목" ||
    layoutHeaders[1] !== "예시" ||
    layoutHeaders[2] !== "입력값"
  ) {
    errors.push("입력 시트는 항목, 예시, 입력값 구조여야 합니다.");
  }
  if (unknownHeaders.length > 0) {
    errors.push(`현재 템플릿에서 지원하지 않는 항목: ${unknownHeaders.join(", ")}`);
  }
  if (missingHeaders.length > 0) {
    errors.push(`필수 항목이 없습니다: ${missingHeaders.join(", ")}`);
  }
  if (outOfRangeRows.length > 0) {
    errors.push("입력 시트에는 템플릿 항목 범위 밖의 값을 넣을 수 없습니다.");
  }
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const hasData = expectedHeaders.some((header) => Boolean(inputRows.get(header)));
  if (!hasData) {
    return { ok: false, errors: ["XLSX 입력 시트에 입력값이 필요합니다."] };
  }

  const row = inputRows;
  const name = getValue(row, "제휴처명");
  const categoryLabelRaw = getValue(row, "카테고리");
  const category = resolveCategory(categoryLabelRaw, categories);
  const periodStart = getValue(row, "시작일");
  const periodEnd = getValue(row, "종료일");
  const brandPhoneRaw = getValue(row, "제휴처 전화번호");
  const inquiryLinkRaw = getValue(row, "문의 링크") || brandPhoneRaw;
  const detailDescription = getValue(row, "상세 설명");
  const companyNameRaw = getValue(row, "파트너사명");
  const company = resolveCompanyByName(companyNameRaw, companies);
  const location =
    options.serviceMode === "online" ? ONLINE_PARTNER_LOCATION : getValue(row, "위치");
  const mapUrlRaw =
    options.serviceMode === "online"
      ? getValue(row, "사이트 링크")
      : getValue(row, "지도 URL");
  const benefitActionLinkRaw =
    options.benefitActionType === "external_link"
      ? getValue(row, "혜택 이용 링크")
      : "";

  if (!name) {
    errors.push("제휴처명이 필요합니다.");
  }
  if (!categoryLabelRaw) {
    errors.push("카테고리가 필요합니다.");
  }
  if (detailDescription.length > 1200) {
    errors.push("상세 설명은 1,200자 이내로 입력해 주세요.");
  }
  if (options.serviceMode === "offline" && !location) {
    errors.push("오프라인 서비스는 위치가 필요합니다.");
  }
  if (validateDateRange(periodStart, periodEnd)) {
    errors.push("제휴 기간 형식이 올바르지 않습니다.");
  }
  const mapUrl = sanitizeHttpUrl(mapUrlRaw);
  if (mapUrlRaw && !mapUrl) {
    errors.push(
      options.serviceMode === "online"
        ? "사이트 링크 URL이 올바르지 않습니다."
        : "지도 URL이 올바르지 않습니다.",
    );
  }
  const benefitActionLink = sanitizePartnerLinkValue(benefitActionLinkRaw);
  if (options.benefitActionType === "external_link" && !benefitActionLink) {
    errors.push("외부 링크 이용 방식에는 혜택 이용 링크가 필요합니다.");
  }
  const inquiryLink = sanitizePartnerLinkValue(inquiryLinkRaw);
  if (inquiryLinkRaw && !inquiryLink) {
    errors.push("문의 링크가 올바르지 않습니다.");
  }
  const brandPhone = sanitizePartnerLinkValue(brandPhoneRaw);
  if (brandPhoneRaw && !brandPhone) {
    errors.push("제휴처 전화번호가 올바르지 않습니다.");
  }
  const companyContactEmail = getValue(row, "담당자 이메일");
  if (!company && companyContactEmail && !isValidEmail(companyContactEmail)) {
    errors.push("담당자 이메일이 올바르지 않습니다.");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const benefitActionType = isPartnerBenefitActionType(options.benefitActionType)
    ? options.benefitActionType
    : "none";

  return {
    ok: true,
    draft: {
      categoryId: category?.id ?? "",
      categoryLabel: category?.label ?? categoryLabelRaw,
      partner: {
        name,
        visibility: "public",
        benefitVisibility: "public",
        location,
        detailDescription,
        campusSlugs: [],
        mapUrl: mapUrl ?? "",
        brandPhone: brandPhone ?? "",
        benefitActionType,
        benefitActionLink: benefitActionLink ?? "",
        reservationLink: benefitActionLink ?? "",
        inquiryLink: inquiryLink ?? "",
        period: {
          start: periodStart,
          end: periodEnd,
        },
        conditions: parseDelimitedValues(getValue(row, "이용 조건")),
        benefits: parseDelimitedValues(getValue(row, "혜택")),
        appliesTo: [],
        thumbnail: null,
        images: [],
        tags: parseDelimitedValues(getValue(row, "태그")),
        company: {
          ...(company ? { id: company.id, name: company.name } : {}),
          name: company?.name ?? companyNameRaw,
          contactName: getValue(row, "담당자명"),
          contactEmail: companyContactEmail,
          contactPhone: getValue(row, "담당자 전화번호"),
          description: getValue(row, "파트너사 설명"),
        },
      },
    },
  };
}
