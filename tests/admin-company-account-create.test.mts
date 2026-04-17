import assert from "node:assert/strict";
import test from "node:test";

type SharedParsersModule =
  typeof import("../src/app/admin/(protected)/_actions/shared-parsers.ts");

const sharedParsersPromise = import(
  new URL(
    "../src/app/admin/(protected)/_actions/shared-parsers.ts",
    import.meta.url,
  ).href,
) as Promise<SharedParsersModule>;

test("partner account create parser normalizes required fields", async () => {
  const { parsePartnerAccountCreatePayload } = await sharedParsersPromise;
  const formData = new FormData();
  formData.set("loginId", "Partner@Example.com");
  formData.set("displayName", "박지수");
  formData.set("companyId", "company-123");
  formData.set("isActive", "true");

  const payload = parsePartnerAccountCreatePayload(formData);

  assert.equal(payload.loginId, "partner@example.com");
  assert.equal(payload.displayName, "박지수");
  assert.equal(payload.companyId, "company-123");
  assert.equal(payload.isActive, true);
});

test("partner account create parser rejects missing company", async () => {
  const { parsePartnerAccountCreatePayload } = await sharedParsersPromise;
  const formData = new FormData();
  formData.set("loginId", "partner@example.com");
  formData.set("displayName", "박지수");

  assert.throws(() => parsePartnerAccountCreatePayload(formData), {
    message: "partner_account_company_missing",
  });
});
