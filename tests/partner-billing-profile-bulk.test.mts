import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

process.env.NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE = "mock";

const billingProfilesModulePromise = import(
  new URL("../src/lib/partner-billing-profiles.ts", import.meta.url).href
);

test("bulk billing profile lookup returns account profiles once across companies", async () => {
  const {
    getPartnerBillingProfiles,
    getPartnerBillingProfilesForCompanies,
  } = await billingProfilesModulePromise;
  const accountId = "mock-partner-account-cafe-ssafy";
  const companyId = "mock-partner-company-cafe-ssafy";

  const bulkProfiles = await getPartnerBillingProfilesForCompanies({
    accountId,
    companyIds: [companyId, "mock-partner-company-urban-gym", companyId],
  });
  const singleCompanyProfiles = await getPartnerBillingProfiles({
    accountId,
    companyId,
  });

  assert.equal(bulkProfiles.length, 1);
  assert.equal(
    new Set(
      bulkProfiles.map((profile: { id: string }) => profile.id),
    ).size,
    1,
  );
  assert.deepEqual(singleCompanyProfiles, bulkProfiles);
});

test("bulk billing profile lookup skips data access for an empty company scope", async () => {
  const { getPartnerBillingProfilesForCompanies } =
    await billingProfilesModulePromise;

  assert.deepEqual(
    await getPartnerBillingProfilesForCompanies({
      accountId: "mock-partner-account-cafe-ssafy",
      companyIds: [],
    }),
    [],
  );
});

test("partner account loads billing profiles through one company-bulk query", () => {
  const serviceSource = readFileSync(
    new URL("../src/lib/partner-billing-profiles.ts", import.meta.url),
    "utf8",
  );
  const pageSource = readFileSync(
    new URL("../src/app/partner/account/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    serviceSource,
    /\.from\("partner_account_companies"\)[\s\S]*?\.in\("company_id", companyIds\)/,
  );
  assert.match(
    serviceSource,
    /\.eq\("account_id", input\.accountId\)[\s\S]*?\.in\("company_id", companyIds\)[\s\S]*?\.is\("account_id", null\)/,
  );
  assert.match(
    pageSource,
    /await getPartnerBillingProfilesForCompanies\(\{[\s\S]*?companyIds: companies\.map/,
  );
  assert.doesNotMatch(pageSource, /Promise\.all\(\s*companies\.map/);
});
