import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

describe("admin member detail selectors", () => {
  it("delegates member detail queries and safe recovery to a server read-model", async () => {
    const [pageSource, readModelSource, deferredSource] = await Promise.all([
      readFile(
        new URL("../src/app/admin/(protected)/members/[memberId]/page.tsx", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../src/lib/admin-member-detail.server.ts", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../src/components/admin/AdminMemberDetailDeferredPanels.tsx", import.meta.url),
        "utf8",
      ),
    ]);

    assert.match(pageSource, /getAdminMemberDetailCoreReadModel/);
    assert.doesNotMatch(pageSource, /getSupabaseAdminClient/);
    assert.match(pageSource, /AdminStatePanel/);
    assert.match(deferredSource, /일부 회원 운영 정보를 불러오지 못했습니다/);
    assert.match(readModelSource, /\.from\("push_preferences"\)/);
    assert.match(readModelSource, /\.from\("push_subscriptions"\)/);
    assert.match(readModelSource, /\.from\("member_policy_consents"\)/);
    assert.match(readModelSource, /\.eq\("event_name", "member_policy_consent"\)/);
    assert.match(readModelSource, /getMemberCanonicalProfile/);
    assert.doesNotMatch(readModelSource, /Error\.message/);
  });

  it("renders the core member profile before deferred operational panels", async () => {
    const [pageSource, readModelSource, deferredSource] = await Promise.all([
      readFile(
        new URL("../src/app/admin/(protected)/members/[memberId]/page.tsx", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../src/lib/admin-member-detail.server.ts", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../src/components/admin/AdminMemberDetailDeferredPanels.tsx", import.meta.url),
        "utf8",
      ),
    ]);

    assert.match(readModelSource, /getAdminMemberDetailCoreReadModel/);
    assert.match(readModelSource, /getAdminMemberDetailOperationalReadModel/);
    assert.match(pageSource, /const operationalPromise/);
    assert.match(pageSource, /await getAdminMemberDetailCoreReadModel/);
    assert.match(pageSource, /<Suspense/);
    assert.match(pageSource, /deferredOperationalPanels/);
    assert.match(deferredSource, /await operational/);
    assert.match(deferredSource, /AdminMemberSecurityLogExplorer/);
  });

  it("does not present deferred operational values as core profile facts", async () => {
    const source = await readFile(
      new URL(
        "../src/components/admin/AdminMemberDetailView.tsx",
        import.meta.url,
      ),
      "utf8",
    );

    assert.doesNotMatch(source, /activeDeviceCount === null/);
    assert.doesNotMatch(source, /보안 로그.*securityLogPagination\.totalCount/);
    assert.match(source, /deferredOperationalPanels/);
  });
});
