import assert from "node:assert/strict";
import test from "node:test";

const parserModulePromise = import(
  new URL(
    "../src/app/admin/(protected)/_actions/shared-parsers.ts",
    import.meta.url,
  ).href,
);

function createPartnerFormData({
  serviceMode,
  location,
}: {
  serviceMode?: string;
  location?: string;
}) {
  const formData = new FormData();
  formData.set("name", "테스트 제휴처");
  formData.set("categoryId", "category-1");
  if (serviceMode !== undefined) {
    formData.set("serviceMode", serviceMode);
  }
  if (location !== undefined) {
    formData.set("location", location);
  }
  formData.set("campusSlugs", "seoul");
  formData.set("appliesTo", "student");
  formData.set("benefitActionType", "none");
  formData.set("visibility", "public");
  formData.set("benefitVisibility", "public");
  return formData;
}

test("admin partner parser persists the selected online service mode canonically", async () => {
  const { parsePartnerPayload } = await parserModulePromise;

  const payload = parsePartnerPayload(
    createPartnerFormData({
      serviceMode: "online",
      location: "기존 오프라인 위치",
    }),
  );

  assert.equal(payload.serviceMode, "online");
  assert.equal(payload.location, "온라인");
});

test("admin partner parser keeps the selected offline location", async () => {
  const { parsePartnerPayload } = await parserModulePromise;

  const payload = parsePartnerPayload(
    createPartnerFormData({
      serviceMode: "offline",
      location: "서울 강남구 테헤란로 212",
    }),
  );

  assert.equal(payload.serviceMode, "offline");
  assert.equal(payload.location, "서울 강남구 테헤란로 212");
});

test("admin partner parser rejects an invalid service mode at the server boundary", async () => {
  const { parsePartnerPayload } = await parserModulePromise;

  assert.throws(
    () =>
      parsePartnerPayload(
        createPartnerFormData({
          serviceMode: "unexpected",
          location: "서울 강남구 테헤란로 212",
        }),
      ),
    { message: "partner_form_invalid_service_mode" },
  );
});
