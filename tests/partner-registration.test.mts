import assert from "node:assert/strict";
import test from "node:test";

const modulePromise = import("../src/lib/partner-registration.ts");

test("partner registration validation accepts offline external link submission", async () => {
  const {
    validatePartnerRegistrationInput,
    hasPartnerRegistrationFieldErrors,
    resolvePartnerRegistrationCategory,
  } = await modulePromise;

  const formData = new FormData();
  formData.set("serviceMode", "offline");
  formData.set("benefitActionType", "external_link");
  formData.set("brandName", "카페 싸피 역삼본점");
  formData.set("categoryLabel", "카페");
  formData.set("location", "서울 강남구 테헤란로 212 1층");
  formData.set("mapUrl", "https://map.naver.com/v5/search/cafe");
  formData.set("benefitActionLink", "https://cafessafy.example.com/coupon");
  formData.set("benefits", "아메리카노 10% 할인|시그니처 라떼 500원 할인");
  formData.set("conditions", "싸트너십 인증\n현장 제시");
  formData.set("brandPhone", "02-3429-5100");
  formData.set("companyName", "카페 싸피");
  formData.set("contactName", "김싸피");
  formData.set("contactEmail", "partner@cafessafy.example");

  const result = validatePartnerRegistrationInput(formData);

  assert.equal(hasPartnerRegistrationFieldErrors(result.fieldErrors), false);
  assert.equal(result.values.location, "서울 강남구 테헤란로 212 1층");
  assert.equal(result.values.safeMapUrl, "https://map.naver.com/v5/search/cafe");
  assert.deepStrictEqual(result.values.parsedBenefits, [
    "아메리카노 10% 할인",
    "시그니처 라떼 500원 할인",
  ]);
  assert.deepStrictEqual(result.values.parsedConditions, [
    "싸트너십 인증",
    "현장 제시",
  ]);
  assert.equal(
    resolvePartnerRegistrationCategory("카페", [
      { id: "cat-cafe", key: "cafe", label: "카페" },
    ])?.id,
    "cat-cafe",
  );
});

test("partner registration validation requires online site and contact email", async () => {
  const { validatePartnerRegistrationInput } = await modulePromise;

  const result = validatePartnerRegistrationInput({
    serviceMode: "online",
    benefitActionType: "none",
    brandName: "카페 싸피 멤버십몰",
    categoryLabel: "멤버십 커머스",
    benefits: "온라인 쿠폰",
    conditions: "로그인 후 이용",
    companyName: "카페 싸피",
    contactName: "김싸피",
    contactEmail: "not-email",
  });

  assert.equal(result.fieldErrors.siteLink, "온라인 브랜드는 사이트 링크를 입력해 주세요.");
  assert.equal(result.fieldErrors.contactEmail, "이메일 형식을 확인해 주세요.");
});

test("partner registration template href normalizes selected options", async () => {
  const { getPartnerRegistrationTemplateHref } = await modulePromise;

  assert.equal(
    getPartnerRegistrationTemplateHref({
      serviceMode: "offline",
      benefitActionType: "certification",
    }),
    "/partner-registration/template?serviceMode=offline&benefitActionType=certification",
  );
});
