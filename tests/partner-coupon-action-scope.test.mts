import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const actionsSourcePromise = readFile(
  new URL(
    "../src/app/partner/companies/[companyId]/services/[partnerId]/coupon-actions.ts",
    import.meta.url,
  ),
  "utf8",
);

test("파트너 코드 풀 업로드는 coupon 조회 전에 회사·계정·제휴처 소유권을 확인한다", async () => {
  const source = await actionsSourcePromise;
  const uploadAction = source.slice(
    source.indexOf("export async function uploadPartnerCouponCodesAction"),
  );

  const companyAccessIndex = uploadAction.indexOf(
    "assertPartnerPortalCompanyAccess(session, companyId)",
  );
  const partnerAccessIndex = uploadAction.indexOf(
    "getPartnerChangeRequestContext(",
  );
  const couponLookupIndex = uploadAction.indexOf(
    "listActiveCouponsForPartner(partnerId)",
  );
  const codeInsertIndex = uploadAction.indexOf("addCouponCodes");

  assert.ok(companyAccessIndex >= 0);
  assert.ok(partnerAccessIndex > companyAccessIndex);
  assert.ok(couponLookupIndex > partnerAccessIndex);
  assert.ok(codeInsertIndex > couponLookupIndex);
  assert.match(
    uploadAction,
    /getPartnerChangeRequestContext\(\s*\[scope\.id\],\s*partnerId,\s*session\.accountId,?\s*\)/,
  );
  assert.match(
    uploadAction,
    /if \(!context\) throw new Error\("제휴처 권한을 확인할 수 없습니다\."\);/,
  );
});
