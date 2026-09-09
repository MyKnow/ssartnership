import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

test("파트너 알림센터는 계정-회사 운영 로그를 회사 범위로 DB에서 먼저 제한한다", () => {
  const source = read("src/lib/partner-notifications.ts");

  assert.match(source, /queryPartnerAccountCompanyAuditLogs/);
  assert.match(source, /\.contains\("properties",\s*params\.propertiesContains\)/);
  assert.match(
    source,
    /propertiesContains:\s*params\.accountId\s*\?\s*\{\s*accountId:\s*params\.accountId,\s*companyId\s*\}\s*:\s*\{\s*companyId\s*\}/,
  );
  assert.doesNotMatch(
    source,
    /targetType:\s*"partner_account_company"[\s\S]{0,200}actions:\s*\["partner_account_company_update"\][\s\S]{0,120}limit:\s*20,\s*\}\)/,
  );
});
