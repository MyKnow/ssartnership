import assert from "node:assert/strict";
import test from "node:test";

type SuggestValidationModule = typeof import("../src/lib/suggest-validation.ts");

const suggestValidationPromise = import(
  new URL("../src/lib/suggest-validation.ts", import.meta.url).href,
) as Promise<SuggestValidationModule>;

const validInput = {
  companyName: "싸트너십 카페",
  businessArea: "역삼역 인근 베이커리 카페",
  partnershipConditions: "SSAFY 인증 화면 제시 시 전 메뉴 10% 할인",
  contactName: "김담당",
  contactRole: "매니저",
  contactEmail: "manager@example.com",
  companyUrl: "https://example.com",
};

test("suggest validation rejects missing required fields with field errors", async () => {
  const { validateSuggestPayload } = await suggestValidationPromise;

  const result = validateSuggestPayload({
    ...validInput,
    companyName: " ",
    contactEmail: "",
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "suggest_missing_required");
    assert.equal(result.message, "필수 항목이 누락되었습니다.");
    assert.equal(result.fieldErrors.companyName, "업체명을 입력해 주세요.");
    assert.equal(result.fieldErrors.contactEmail, "담당자 이메일을 입력해 주세요.");
  }
});

test("suggest validation rejects non-object payloads as missing required fields", async () => {
  const { validateSuggestPayload } = await suggestValidationPromise;

  const result = validateSuggestPayload(null);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "suggest_missing_required");
    assert.equal(result.fieldErrors.companyName, "업체명을 입력해 주세요.");
  }
});

test("suggest validation rejects invalid contact email", async () => {
  const { validateSuggestPayload } = await suggestValidationPromise;

  const result = validateSuggestPayload({
    ...validInput,
    contactEmail: "not-an-email",
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "suggest_invalid_email");
    assert.equal(result.message, "이메일 형식이 올바르지 않습니다.");
    assert.equal(result.fieldErrors.contactEmail, "이메일 형식을 확인해 주세요.");
  }
});

test("suggest validation rejects unsafe company URL", async () => {
  const { validateSuggestPayload } = await suggestValidationPromise;

  const result = validateSuggestPayload({
    ...validInput,
    companyUrl: "javascript:alert(1)",
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "suggest_invalid_company_url");
    assert.equal(result.message, "회사 사이트 URL 형식이 올바르지 않습니다.");
    assert.equal(result.fieldErrors.companyUrl, "회사 사이트 URL 형식을 확인해 주세요.");
  }
});

test("suggest validation normalizes valid input and sanitizes company URL", async () => {
  const { validateSuggestPayload } = await suggestValidationPromise;

  const result = validateSuggestPayload({
    ...validInput,
    companyName: "  싸트너십 카페  ",
    companyUrl: " https://example.com/partner ",
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.values.companyName, "싸트너십 카페");
    assert.equal(result.safeCompanyUrl, "https://example.com/partner");
  }
});
