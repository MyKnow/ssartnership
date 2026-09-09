import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);

test("파트너 지점 연결은 공용 청크 저장 경로를 사용한다", async () => {
  const [helper, adminCreate, registrationApproval] = await Promise.all([
    readFile(new URL("src/lib/partner-branch-links.server.ts", root), "utf8"),
    readFile(
      new URL(
        "src/app/admin/(protected)/_actions/partner-actions/create.ts",
        root,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "src/app/admin/(protected)/partner-registrations/actions.ts",
        root,
      ),
      "utf8",
    ),
  ]);

  assert.match(helper, /PARTNER_BRANCH_WRITE_BATCH_SIZE = 100/);
  assert.match(helper, /\.in\("branch_key", branchKeys\)/);
  assert.match(helper, /missingBranches\.map/);
  assert.match(helper, /partner_offer_branches/);
  assert.match(helper, /error\.code !== "23505"/);
  assert.match(helper, /attempt < 3/);

  for (const source of [adminCreate, registrationApproval]) {
    assert.match(source, /persistPartnerBranchLinks/);
  }
  assert.doesNotMatch(adminCreate, /persistAdminPartnerBranchLinks/);
  assert.doesNotMatch(
    registrationApproval,
    /for \(const branch of groupBranches\)/,
  );
});
