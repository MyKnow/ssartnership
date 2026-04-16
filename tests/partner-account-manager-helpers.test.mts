import assert from "node:assert/strict";
import test from "node:test";

type AccountHelpersModule =
  typeof import("../src/components/admin/partner-account-manager/helpers.ts");

const accountHelpersPromise = import(
  new URL(
    "../src/components/admin/partner-account-manager/helpers.ts",
    import.meta.url,
  ).href,
) as Promise<AccountHelpersModule>;

test("partner account helper formats empty datetime consistently", async () => {
  const { formatPartnerAccountDateTime } = await accountHelpersPromise;

  assert.equal(formatPartnerAccountDateTime(null), "없음");
});

test("partner account helper builds initial setup URL with fallback host", async () => {
  const { buildPartnerInitialSetupUrl } = await accountHelpersPromise;

  assert.equal(
    buildPartnerInitialSetupUrl("token-123"),
    "https://ssartnership.vercel.app/partner/setup/token-123",
  );
  assert.equal(
    buildPartnerInitialSetupUrl("token-123", "https://ssartnership.myknow.xyz"),
    "https://ssartnership.myknow.xyz/partner/setup/token-123",
  );
});
