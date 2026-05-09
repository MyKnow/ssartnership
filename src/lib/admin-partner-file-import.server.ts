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
const MAX_DATA_ROW = 2;

const SAMPLE_GUIDE_ROWS = [
  ["브랜드명", "필수", "사용자에게 노출되는 브랜드 이름"],
  ["카테고리", "필수", "카테고리 이름을 그대로 입력"],
  ["혜택", "선택", "여러 개면 | 로 구분. 예: 아메리카노 할인|베이커리 할인"],
  ["이용 조건", "선택", "여러 개면 | 로 구분. 예: 싸트너십 인증|현장 제시"],
  ["태그", "선택", "여러 개면 | 로 구분. 예: 카페|역삼"],
  ["이미지 URL", "선택", "여러 개면 | 로 구분. 예: https://.../1.jpg|https://.../2.jpg"],
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

function getRowValues(sheet: ExcelJS.Worksheet, rowNumber: number) {
  const row = sheet.getRow(rowNumber);
  return Array.from({ length: sheet.columnCount }, (_, index) =>
    getCellString(row.getCell(index + 1)),
  );
}

function mapInputRow(headers: string[], values: string[]) {
  const mapped = new Map<string, string>();
  headers.forEach((header, index) => {
    mapped.set(header, values[index]?.trim() ?? "");
  });
  return mapped;
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
  input.addRow(headers);
  input.addRow(Array.from({ length: headers.length }, () => ""));
  input.getRow(1).font = { bold: true };
  input.getRow(1).height = 28;
  input.getRow(2).height = 24;
  input.columns = headers.map((header) => ({
    header,
    key: header,
    width: Math.min(Math.max(header.length + 6, 14), 24),
  }));
  input.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: headers.length },
  };

  const categoryColumnIndex = headers.indexOf("카테고리") + 1;
  if (categoryColumnIndex > 0 && categories.length > 0) {
    input.getCell(MAX_DATA_ROW, categoryColumnIndex).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: [`=${LIST_SHEET_NAME}!$A$2:$A$${categories.length + 1}`],
      showErrorMessage: true,
      errorTitle: "카테고리 확인",
      error: "목록 시트에 있는 카테고리 중 하나를 선택해 주세요.",
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
  const headers = getRowValues(input, 1).slice(0, expectedHeaders.length);
  const unknownHeaders = headers.filter((header) => !expectedHeaders.includes(header));
  const missingHeaders = expectedHeaders.filter((header) => !headers.includes(header));
  const errors: string[] = [];

  if (unknownHeaders.length > 0) {
    errors.push(`현재 템플릿에서 지원하지 않는 헤더: ${unknownHeaders.join(", ")}`);
  }
  if (missingHeaders.length > 0) {
    errors.push(`필수 헤더가 없습니다: ${missingHeaders.join(", ")}`);
  }
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const dataRowValues = getRowValues(input, MAX_DATA_ROW).slice(
    0,
    expectedHeaders.length,
  );
  const hasData = dataRowValues.some(Boolean);
  if (!hasData) {
    return { ok: false, errors: ["XLSX 입력 시트에 입력 행이 필요합니다."] };
  }

  for (let rowNumber = MAX_DATA_ROW + 1; rowNumber <= input.rowCount; rowNumber += 1) {
    if (getRowValues(input, rowNumber).some(Boolean)) {
      return {
        ok: false,
        errors: ["XLSX는 한 브랜드, 한 행만 업로드할 수 있습니다."],
      };
    }
  }

  const row = mapInputRow(headers, dataRowValues);
  const name = getValue(row, "브랜드명");
  const category = resolveCategory(getValue(row, "카테고리"), categories);
  const periodStart = getValue(row, "시작일");
  const periodEnd = getValue(row, "종료일");
  const inquiryLinkRaw = getValue(row, "문의 링크");
  const thumbnailUrlRaw = getValue(row, "썸네일 URL");
  const imageUrls = parseDelimitedValues(getValue(row, "이미지 URL")).map(
    (item) => sanitizeHttpUrl(item) ?? "",
  );
  const companyNameRaw = getValue(row, "협력사명");
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
    errors.push("브랜드명이 필요합니다.");
  }
  if (!category) {
    errors.push("카테고리를 찾을 수 없습니다.");
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
  const thumbnail = sanitizeHttpUrl(thumbnailUrlRaw);
  if (thumbnailUrlRaw && !thumbnail) {
    errors.push("썸네일 URL이 올바르지 않습니다.");
  }
  if (imageUrls.some((item) => !item)) {
    errors.push("이미지 URL 목록에 올바르지 않은 URL이 있습니다.");
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
      partner: {
        name,
        visibility: "public",
        benefitVisibility: "public",
        location,
        campusSlugs: [],
        mapUrl: mapUrl ?? "",
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
        thumbnail,
        images: imageUrls.filter(Boolean),
        tags: parseDelimitedValues(getValue(row, "태그")),
        company: {
          ...(company ? { id: company.id, name: company.name } : {}),
          name: company?.name ?? companyNameRaw,
          contactName: getValue(row, "담당자명"),
          contactEmail: companyContactEmail,
          contactPhone: getValue(row, "담당자 전화번호"),
          description: getValue(row, "협력사 설명"),
        },
      },
    },
  };
}
