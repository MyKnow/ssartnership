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
  const bulkLookup = serviceSource.slice(
    serviceSource.indexOf("export async function getPartnerBillingProfilesForCompanies"),
    serviceSource.indexOf("export async function createPartnerBillingProfile"),
  );
  assert.equal(
    bulkLookup.match(/\.from\("partner_billing_profiles"\)/g)?.length,
    1,
  );
  assert.match(
    bulkLookup,
    /\.or\(buildPartnerBillingProfileScopeFilter\(input\.accountId, companyIds\)\)[\s\S]*?\.is\("archived_at", null\)/,
  );
  assert.doesNotMatch(bulkLookup, /legacyCompanyProfilesResult/);
  assert.match(
    pageSource,
    /await getPartnerBillingProfilesForCompanies\(\{[\s\S]*?companyIds: companies\.map/,
  );
  assert.doesNotMatch(pageSource, /Promise\.all\(\s*companies\.map/);
});

test("billing profile scope filter covers own profiles and legacy company-level profiles", async () => {
  const { buildPartnerBillingProfileScopeFilter } = await billingProfilesModulePromise;
  const accountId = "4f1c2a9e-5b6d-4e7f-8a9b-0c1d2e3f4a5b";
  const companyA = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
  const companyB = "1b2c3d4e-5f6a-4b7c-9d8e-0f1a2b3c4d5e";

  assert.equal(
    buildPartnerBillingProfileScopeFilter(accountId, [companyA, companyB, companyA]),
    `account_id.eq.${accountId},and(account_id.is.null,company_id.in.(${companyA},${companyB}))`,
  );
});

test("billing profile scope filter rejects values that could alter filter syntax", async () => {
  const { buildPartnerBillingProfileScopeFilter } = await billingProfilesModulePromise;
  const accountId = "4f1c2a9e-5b6d-4e7f-8a9b-0c1d2e3f4a5b";
  const companyId = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

  for (const [candidateAccountId, candidateCompanyIds] of [
    ["mock-partner-account", [companyId]],
    [`${accountId},id.neq.0`, [companyId]],
    [accountId, []],
    [accountId, [`${companyId}),or(id.not.is.null`]],
  ] as const) {
    assert.throws(
      () => buildPartnerBillingProfileScopeFilter(candidateAccountId, [...candidateCompanyIds]),
      /파트너사 접근 권한이 없습니다/,
    );
  }
});
