import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";

type SharedModule = typeof import("../src/lib/admin-partner-file-import.ts");
type ServerModule = typeof import("../src/lib/admin-partner-file-import.server.ts");

const sharedModulePromise = import(
  new URL("../src/lib/admin-partner-file-import.ts", import.meta.url).href
) as Promise<SharedModule>;
const serverModulePromise = import(
  new URL("../src/lib/admin-partner-file-import.server.ts", import.meta.url).href
) as Promise<ServerModule>;

const categories = [
  { id: "cat-cafe", key: "cafe", label: "카페" },
  { id: "cat-culture", key: "culture", label: "문화" },
];

const companies = [
  { id: "company-1", name: "샘플 협력사" },
];

async function loadTemplate(options: {
  serviceMode: "offline" | "online";
  benefitActionType: "external_link" | "certification" | "onsite" | "none";
}) {
  const { createAdminPartnerXlsxTemplate } = await serverModulePromise;
  const workbook = new ExcelJS.Workbook();
  const templateBuffer = await createAdminPartnerXlsxTemplate(options, categories);
  await workbook.xlsx.load(templateBuffer as unknown as ExcelJS.Buffer);
  return workbook;
}

function getHeaders(workbook: ExcelJS.Workbook) {
  const sheet = workbook.getWorksheet("입력");
  assert.ok(sheet);
  const headers: string[] = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const value = String(sheet.getRow(rowNumber).getCell(1).value ?? "");
    if (value) {
      headers.push(value);
    }
  }
  return headers;
}

function setInputValues(workbook: ExcelJS.Workbook, values: Record<string, string>) {
  const sheet = workbook.getWorksheet("입력");
  assert.ok(sheet);
  for (const [header, value] of Object.entries(values)) {
    let rowNumber = 0;
    for (let currentRow = 2; currentRow <= sheet.rowCount; currentRow += 1) {
      if (String(sheet.getRow(currentRow).getCell(1).value ?? "") === header) {
        rowNumber = currentRow;
        break;
      }
    }
    assert.notEqual(rowNumber, 0, `missing header: ${header}`);
    sheet.getRow(rowNumber).getCell(3).value = value;
  }
}

async function toBuffer(workbook: ExcelJS.Workbook) {
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

test("admin partner xlsx template branches headers and writes metadata", async () => {
  const offlineExternal = await loadTemplate({
    serviceMode: "offline",
    benefitActionType: "external_link",
  });
  const offlineHeaders = getHeaders(offlineExternal);
  assert.ok(offlineHeaders.includes("위치"));
  assert.ok(offlineHeaders.includes("지도 URL"));
  assert.ok(offlineHeaders.includes("혜택 이용 링크"));
  assert.equal(offlineHeaders.includes("사이트 링크"), false);
  assert.equal(offlineHeaders.includes("썸네일 URL"), false);
  assert.equal(offlineHeaders.includes("이미지 URL"), false);
  assert.ok(offlineHeaders.includes("혜택"));
  assert.ok(offlineHeaders.includes("이용 조건"));
  assert.equal(offlineHeaders.includes("노출 상태"), false);
  assert.equal(offlineHeaders.includes("혜택 공개 범위"), false);
  assert.equal(offlineHeaders.includes("노출 캠퍼스 - 전체"), false);
  assert.equal(offlineHeaders.includes("적용 대상 - 교육생"), false);
  const input = offlineExternal.getWorksheet("입력");
  assert.ok(input);
  assert.equal(input.getRow(1).getCell(1).value, "항목");
  assert.equal(input.getRow(1).getCell(2).value, "예시");
  assert.equal(input.getRow(1).getCell(3).value, "입력값");
  const categoryRow = offlineHeaders.indexOf("카테고리") + 2;
  assert.match(
    String(input.getRow(categoryRow).getCell(3).dataValidation?.formulae?.[0] ?? ""),
    /'목록'!\$A\$2:\$A\$3/,
  );
  const nameRow = offlineHeaders.indexOf("브랜드명") + 2;
  assert.equal(input.getRow(nameRow).getCell(3).dataValidation?.type, "custom");
  assert.match(
    String(input.getRow(nameRow).getCell(3).dataValidation?.formulae?.[0] ?? ""),
    /LEN\(TRIM/,
  );
  const emailRow = offlineHeaders.indexOf("담당자 이메일") + 2;
  assert.match(
    String(input.getRow(emailRow).getCell(3).dataValidation?.formulae?.[0] ?? ""),
    /FIND\("@"/,
  );
  const mapUrlRow = offlineHeaders.indexOf("지도 URL") + 2;
  assert.match(
    String(input.getRow(mapUrlRow).getCell(3).dataValidation?.formulae?.[0] ?? ""),
    /https:\/\//,
  );
  const benefitLinkRow = offlineHeaders.indexOf("혜택 이용 링크") + 2;
  assert.match(
    String(
      input.getRow(benefitLinkRow).getCell(3).dataValidation?.formulae?.[0] ?? "",
    ),
    /AND\(LEN\(TRIM/,
  );
  const benefitRow = offlineHeaders.indexOf("혜택") + 2;
  assert.match(
    String(input.getRow(benefitRow).getCell(3).dataValidation?.formulae?.[0] ?? ""),
    /<=1000/,
  );
  assert.equal(input.getRow(nameRow).getCell(1).fill.type, "pattern");
  assert.equal(input.getRow(nameRow).getCell(2).value, "레뽀드라라 역삼 GS타워점");
  const list = offlineExternal.getWorksheet("목록");
  assert.ok(list);
  assert.equal(list.getRow(2).getCell(1).value, "카페");
  assert.equal(list.getRow(3).getCell(1).value, "문화");

  const meta = offlineExternal.getWorksheet("_meta");
  assert.ok(meta);
  assert.equal(meta.getRow(2).getCell(2).value, "offline");
  assert.equal(meta.getRow(3).getCell(2).value, "external_link");

  const onlineCertification = await loadTemplate({
    serviceMode: "online",
    benefitActionType: "certification",
  });
  const onlineHeaders = getHeaders(onlineCertification);
  assert.ok(onlineHeaders.includes("사이트 링크"));
  assert.equal(onlineHeaders.includes("위치"), false);
  assert.equal(onlineHeaders.includes("혜택 이용 링크"), false);
});

test("admin partner xlsx draft parser accepts one Korean row and normalizes values", async () => {
  const { parseAdminPartnerXlsxDraft } = await serverModulePromise;
  const workbook = await loadTemplate({
    serviceMode: "offline",
    benefitActionType: "external_link",
  });
  setInputValues(workbook, {
    브랜드명: "레뽀드라라",
    카테고리: "카페",
    시작일: "2026-05-01",
    종료일: "2026-12-31",
    협력사명: "샘플 협력사",
    담당자명: "담당자",
    "담당자 이메일": "partner@example.com",
    위치: "서울 강남구",
    "지도 URL": "https://map.example.com",
    "혜택 이용 링크": "https://benefit.example.com",
    혜택: "아메리카노 할인|베이커리 할인",
    "이용 조건": "싸트너십 인증",
    태그: "카페",
  });

  const result = await parseAdminPartnerXlsxDraft({
    fileBuffer: await toBuffer(workbook),
    categories,
    companies,
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }
  assert.equal(result.draft.categoryId, "cat-cafe");
  assert.equal(result.draft.partner.name, "레뽀드라라");
  assert.equal(result.draft.partner.location, "서울 강남구");
  assert.deepStrictEqual(result.draft.partner.campusSlugs, []);
  assert.deepStrictEqual(result.draft.partner.appliesTo, []);
  assert.deepStrictEqual(result.draft.partner.benefits, [
    "아메리카노 할인",
    "베이커리 할인",
  ]);
  assert.equal(result.draft.partner.thumbnail, null);
  assert.deepStrictEqual(result.draft.partner.images, []);
  assert.equal(result.draft.partner.company?.id, "company-1");
  assert.equal(result.draft.partner.benefitActionType, "external_link");
  assert.equal(result.draft.partner.benefitActionLink, "https://benefit.example.com/");
});

test("admin partner xlsx draft parser rejects empty and invalid rows", async () => {
  const { parseAdminPartnerXlsxDraft } = await serverModulePromise;
  const emptyWorkbook = await loadTemplate({
    serviceMode: "online",
    benefitActionType: "none",
  });

  const emptyResult = await parseAdminPartnerXlsxDraft({
    fileBuffer: await toBuffer(emptyWorkbook),
    categories,
    companies,
  });
  assert.equal(emptyResult.ok, false);
  assert.match(emptyResult.ok ? "" : emptyResult.errors.join(" "), /입력값/);

  const invalidWorkbook = await loadTemplate({
    serviceMode: "online",
    benefitActionType: "none",
  });
  setInputValues(invalidWorkbook, {
    브랜드명: "온라인 브랜드",
    카테고리: "없는 카테고리",
    시작일: "2026-12-31",
    종료일: "2026-05-01",
    "사이트 링크": "not-a-url",
  });
  const invalidResult = await parseAdminPartnerXlsxDraft({
    fileBuffer: await toBuffer(invalidWorkbook),
    categories,
    companies,
  });
  assert.equal(invalidResult.ok, false);
  assert.match(
    invalidResult.ok ? "" : invalidResult.errors.join(" "),
    /카테고리|기간|사이트 링크/,
  );
});

test("admin partner xlsx draft parser rejects values outside the template range", async () => {
  const { parseAdminPartnerXlsxDraft } = await serverModulePromise;
  const workbook = await loadTemplate({
    serviceMode: "online",
    benefitActionType: "none",
  });
  setInputValues(workbook, {
    브랜드명: "온라인 브랜드",
    카테고리: "문화",
    "사이트 링크": "https://service.example.com",
  });
  const input = workbook.getWorksheet("입력");
  assert.ok(input);
  input.getRow(1_048_576).getCell(1).value = "범위 밖 입력";

  const result = await parseAdminPartnerXlsxDraft({
    fileBuffer: await toBuffer(workbook),
    categories,
    companies,
  });

  assert.equal(result.ok, false);
  assert.match(result.ok ? "" : result.errors.join(" "), /범위 밖/);
});

test("admin partner xlsx draft converts to form data compatible with partner parser", async () => {
  const { createPartnerFileDraftFormData } = await sharedModulePromise;
  const { parseAdminPartnerXlsxDraft } = await serverModulePromise;
  const { parsePartnerPayload, parsePartnerCompanyPayload } = await import(
    new URL(
      "../src/app/admin/(protected)/_actions/shared-parsers.ts",
      import.meta.url,
    ).href
  );
  const workbook = await loadTemplate({
    serviceMode: "online",
    benefitActionType: "certification",
  });
  setInputValues(workbook, {
    브랜드명: "온라인 브랜드",
    카테고리: "culture",
    "사이트 링크": "https://service.example.com",
    협력사명: "신규 협력사",
    담당자명: "담당자",
    "담당자 이메일": "new@example.com",
    "담당자 전화번호": "010-1111-2222",
    "협력사 설명": "설명",
    혜택: "로그인 후 조회 가능",
    태그: "온라인",
  });

  const result = await parseAdminPartnerXlsxDraft({
    fileBuffer: await toBuffer(workbook),
    categories,
    companies,
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  const formData = createPartnerFileDraftFormData({
    ...result.draft,
    partner: {
      ...result.draft.partner,
      campusSlugs: ["seoul", "daejeon"],
      appliesTo: ["staff", "student"],
    },
  });
  const payload = parsePartnerPayload(formData);
  const companyPayload = parsePartnerCompanyPayload(formData);

  assert.equal(payload.location, "온라인");
  assert.equal(payload.mapUrl, "https://service.example.com/");
  assert.equal(payload.benefitActionType, "certification");
  assert.equal(payload.benefitActionLink, null);
  assert.deepStrictEqual(payload.campusSlugs, ["seoul", "daejeon"]);
  assert.deepStrictEqual(payload.appliesTo, ["staff", "student"]);
  assert.equal(companyPayload.name, "신규 협력사");
  assert.equal(companyPayload.contactEmail, "new@example.com");
});
