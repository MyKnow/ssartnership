import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);

async function read(path: string) {
  return readFile(new URL(path, root), "utf8");
}

test("admin 파트너 생성 흐름은 공용 branch link helper를 사용한다", async () => {
  const source = await read(
    "src/app/admin/(protected)/_actions/partner-actions/create.ts",
  );

  assert.match(source, /persistPartnerBranchLinks/);
  assert.doesNotMatch(source, /from\("partner_company_branches"\)/);
  assert.doesNotMatch(source, /from\("partner_offer_branches"\)/);
});

test("등록 요청 승인 흐름은 공용 branch link helper를 사용한다", async () => {
  const source = await read(
    "src/app/admin/(protected)/partner-registrations/actions.ts",
  );

  assert.match(source, /persistPartnerBranchLinks/);
  assert.doesNotMatch(source, /from\("partner_company_branches"\)/);
  assert.doesNotMatch(source, /from\("partner_offer_branches"\)/);
});
