import assert from "node:assert/strict";
import test from "node:test";

const parserModulePromise = import(
  new URL(
    "../src/app/admin/(protected)/_actions/shared-parsers.ts",
    import.meta.url,
  ).href,
);

test("admin partner parser honors an explicit blank benefit link over a stale reservation link", async () => {
  const { parsePartnerPayload } = await parserModulePromise;
  const formData = new FormData();
  formData.set("name", "테스트 제휴처");
  formData.set("categoryId", "category-1");
  formData.set("serviceMode", "offline");
  formData.set("location", "서울 강남구 테헤란로 212");
  formData.set("campusSlugs", "seoul");
  formData.set("appliesTo", "student");
  formData.set("benefitActionType", "external_link");
  formData.set("benefitActionLink", "");
  formData.set("reservationLink", "https://booking.example.com/stale");
  formData.set("visibility", "public");
  formData.set("benefitVisibility", "public");

  assert.throws(
    () => parsePartnerPayload(formData),
    { message: "partner_form_invalid_benefit_action_link" },
  );
});
