import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");

test("광고 관리는 캠페인 조회를 공유하고 제휴처 선택지는 lean query로 읽는다", async () => {
  const [page, view, adRepository, partnerContract, partnerRepository] = await Promise.all([
    read("src/app/admin/(protected)/advertisement/page.tsx"),
    read("src/components/admin/AdminAdvertisementView.tsx"),
    read("src/lib/repositories/ad-package-repository.ts"),
    read("src/lib/repositories/partner-repository.ts"),
    read("src/lib/repositories/supabase/partner-repository.supabase.ts"),
  ]);

  assert.equal(
    page.match(/adPackageRepository\.prepareAdminCampaigns\(\)/g)?.length,
    1,
  );
  assert.doesNotMatch(page, /listAdminCampaignOptions/);
  assert.doesNotMatch(adRepository, /listAdminCampaignOptions/);
  assert.match(
    page,
    /const campaignPreparationPromise = adPackageRepository\.prepareAdminCampaigns\(\)/,
  );
  assert.match(
    page,
    /campaignPreparationPromise\.then\(\(\{ campaigns \}\) => campaigns\)/,
  );
  assert.match(
    page,
    /const campaignManagerPromise = Promise\.all\([\s\S]*?\.catch\(\(\) => \(\{ status: "error" as const \}\)\)/,
  );
  const eagerLoad = page.slice(page.indexOf("try {"), page.indexOf("} catch"));
  assert.match(eagerLoad, /campaignPreparationPromise/);
  assert.doesNotMatch(eagerLoad, /preparedCampaigns\.campaigns/);
  assert.match(page, /adCampaignOptions=\{preparedCampaigns\.options\}/);
  assert.match(
    adRepository,
    /campaign\.sponsorLabel\.trim\(\) \|\| campaign\.partnerName\.trim\(\) \|\| "제휴처"/,
  );
  assert.match(page, /partnerRepository\.listAdminPartnerOptions\(\)/);
  assert.doesNotMatch(page, /partnerRepository\.getPartners\(/);
  assert.match(view, /<Suspense/);
  assert.match(view, /await campaignsPromise/);
  assert.match(view, /AdminAdPackageManager/);
  assert.match(partnerContract, /listAdminPartnerOptions\(\): Promise<AdminPartnerOption\[\]>/);
  assert.match(
    partnerRepository,
    /async listAdminPartnerOptions\(\)[\s\S]*?\.from\("partners"\)[\s\S]*?\.select\("id,name"\)/,
  );
});
