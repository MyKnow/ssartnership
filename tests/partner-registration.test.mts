import assert from "node:assert/strict";
import test from "node:test";

const modulePromise = import("../src/lib/partner-registration.ts");
const couponOnlyModulePromise = import("../src/lib/partner-coupon-only.ts");

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

test("partner registration validation accepts coupon-only brand defaults", async () => {
  const { validatePartnerRegistrationInput, hasPartnerRegistrationFieldErrors } =
    await modulePromise;
  const { COUPON_ONLY_BENEFIT_TEXT, COUPON_ONLY_CONDITION_TEXT } =
    await couponOnlyModulePromise;

  const result = validatePartnerRegistrationInput({
    serviceMode: "offline",
    benefitActionType: "none",
    brandName: "쿠폰 싸피 역삼점",
    categoryLabel: "쿠폰",
    location: "서울 강남구 테헤란로 212",
    benefits: COUPON_ONLY_BENEFIT_TEXT,
    conditions: COUPON_ONLY_CONDITION_TEXT,
    companyName: "쿠폰 싸피",
    contactName: "김싸피",
    contactEmail: "coupon@ssafy.example",
  });

  assert.equal(hasPartnerRegistrationFieldErrors(result.fieldErrors), false);
  assert.deepStrictEqual(result.values.parsedBenefits, [COUPON_ONLY_BENEFIT_TEXT]);
  assert.deepStrictEqual(result.values.parsedConditions, [
    COUPON_ONLY_CONDITION_TEXT,
  ]);
});

test("coupon-only listing mode is restored from default benefit strings", async () => {
  const {
    COUPON_ONLY_BENEFIT_TEXT,
    COUPON_ONLY_CONDITION_TEXT,
    getBenefitListingMode,
    removeCouponOnlyDefaults,
  } = await couponOnlyModulePromise;

  assert.equal(
    getBenefitListingMode({
      benefits: [COUPON_ONLY_BENEFIT_TEXT],
      conditions: [COUPON_ONLY_CONDITION_TEXT],
    }),
    "coupon_only",
  );
  assert.deepStrictEqual(
    removeCouponOnlyDefaults([
      COUPON_ONLY_BENEFIT_TEXT,
      "아메리카노 10% 할인",
    ]),
    ["아메리카노 10% 할인"],
  );
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

test("partner registration image validation allows raster files only", async () => {
  const { validatePartnerRegistrationImageFile } = await modulePromise;

  const webp = new File(["image"], "thumbnail.webp", { type: "image/webp" });
  const svg = new File(["<svg />"], "icon.svg", { type: "image/svg+xml" });
  const noExtension = new File(["image"], "thumbnail", { type: "image/png" });

  assert.equal(validatePartnerRegistrationImageFile(webp), null);
  assert.equal(
    validatePartnerRegistrationImageFile(svg),
    "이미지는 JPG, PNG, WebP, AVIF 파일만 업로드할 수 있습니다.",
  );
  assert.equal(
    validatePartnerRegistrationImageFile(noExtension),
    "이미지는 JPG, PNG, WebP, AVIF 파일만 업로드할 수 있습니다.",
  );
});

test("partner registration draft conversion preserves online site link and brand phone", async () => {
  const {
    createPartnerRegistrationInputFromDraft,
    validatePartnerRegistrationInput,
  } = await modulePromise;

  const input = createPartnerRegistrationInputFromDraft({
    categoryId: "",
    categoryLabel: "카페",
    partner: {
      name: "카페 싸피 멤버십몰",
      visibility: "public",
      benefitVisibility: "public",
      location: "온라인",
      detailDescription: "온라인 쿠폰을 제공하는 카페 싸피 멤버십몰",
      campusSlugs: [],
      mapUrl: "https://cafessafy.example.com",
      brandPhone: "02-3429-5100",
      benefitActionType: "external_link",
      benefitActionLink: "https://cafessafy.example.com/coupon",
      reservationLink: "https://cafessafy.example.com/coupon",
      inquiryLink: "https://pf.kakao.com/_cafessafy",
      period: { start: "2026-05-01", end: "2026-12-31" },
      conditions: ["싸트너십 인증"],
      benefits: ["아메리카노 10% 할인"],
      appliesTo: [],
      thumbnail: null,
      images: [],
      tags: ["카페", "온라인"],
      company: {
        name: "카페 싸피",
        contactName: "김싸피",
        contactEmail: "partner@cafessafy.example",
      },
    },
  });

  assert.equal(input.serviceMode, "online");
  assert.equal(input.siteLink, "https://cafessafy.example.com");
  assert.equal(input.brandPhone, "02-3429-5100");

  const result = validatePartnerRegistrationInput(input);
  assert.equal(result.fieldErrors.siteLink, undefined);
  assert.equal(result.values.safeSiteLink, "https://cafessafy.example.com/");
});
