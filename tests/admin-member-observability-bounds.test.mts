import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const adminMembersPagePath = new URL(
  "../src/app/admin/(protected)/members/page.tsx",
  import.meta.url,
);
const adminMembersManagerPath = new URL(
  "../src/components/admin/AdminMemberManager.tsx",
  import.meta.url,
);
const adminMemberDetailPagePath = new URL(
  "../src/app/admin/(protected)/members/[memberId]/page.tsx",
  import.meta.url,
);
const adminMemberSecurityLogExplorerPath = new URL(
  "../src/components/admin/member-detail/AdminMemberSecurityLogExplorer.tsx",
  import.meta.url,
);

test("admin members list removes 500 row page size and bounds trend rows", async () => {
  const [serverSource, clientSource] = await Promise.all([
    readFile(adminMembersPagePath, "utf8"),
    readFile(adminMembersManagerPath, "utf8"),
  ]);

  assert.doesNotMatch(serverSource, /MEMBER_PAGE_SIZE_OPTIONS = \[[^\]]*500/);
  assert.doesNotMatch(clientSource, /MEMBER_PAGE_SIZE_OPTIONS = \[[^\]]*500/);
  assert.match(serverSource, /ADMIN_MEMBER_TREND_MAX_ROWS = 5000/);
  assert.match(serverSource, /\.gte\("created_at", trendStartIso\)/);
  assert.match(serverSource, /\.limit\(ADMIN_MEMBER_TREND_MAX_ROWS\)/);
  assert.doesNotMatch(serverSource, /from\("members"\)\.select\("year,campus"\)/);
});

test("admin member detail security logs are server paginated", async () => {
  const [pageSource, explorerSource] = await Promise.all([
    readFile(adminMemberDetailPagePath, "utf8"),
    readFile(adminMemberSecurityLogExplorerPath, "utf8"),
  ]);

  assert.doesNotMatch(pageSource, /\.range\(0,\s*4999\)/);
  assert.match(pageSource, /parseSecurityLogPageSize/);
  assert.match(
    pageSource,
    /securityLogQuery\.range\(securityLogFrom,\s*securityLogFrom \+ securityLogPageSize - 1\)/,
  );
  assert.match(explorerSource, /logPage/);
  assert.match(explorerSource, /pagination\.totalCount/);
});
