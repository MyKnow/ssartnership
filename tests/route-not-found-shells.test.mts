import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const adminNavigationModulePromise = import(
  new URL("../src/components/admin/admin-navigation.ts", import.meta.url).href
) as Promise<typeof import("../src/components/admin/admin-navigation.ts")>;

function read(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("관리자 404 복귀 목적지는 요청 경로가 속한 관리 목록이다", async () => {
  const { getAdminNotFoundRecovery } = await adminNavigationModulePromise;

  assert.deepEqual(getAdminNotFoundRecovery("/admin/members/missing?returnTo=%2Fadmin"), {
    href: "/admin/members",
    label: "회원 관리",
  });
  assert.deepEqual(getAdminNotFoundRecovery("/admin/partners/missing/edit#top"), {
    href: "/admin/partners",
    label: "제휴처",
  });
  assert.deepEqual(getAdminNotFoundRecovery("/admin/member-signup-requests/missing"), {
    href: "/admin/member-signup-requests",
    label: "가입 승인",
  });
  for (const path of [null, undefined, "", "/admin", "/admin/unknown-area/1", "/partners/1"]) {
    assert.deepEqual(getAdminNotFoundRecovery(path), {
      href: "/admin",
      label: "관리 홈",
    });
  }
});

test("관리자·파트너 notFound()는 각 셸 안의 404로 처리한다", async () => {
  const [adminNotFound, partnerNotFound] = await Promise.all([
    read("src/app/admin/(protected)/not-found.tsx"),
    read("src/app/partner/not-found.tsx"),
  ]);

  assert.match(adminNotFound, /<AdminShell\s/);
  assert.match(adminNotFound, /getAdminNotFoundRecovery\(/);
  assert.match(adminNotFound, /getForwardedRequestPath\(await headers\(\)\)/);
  assert.match(adminNotFound, /<p className="ui-kicker">404<\/p>/);

  // 파트너 레이아웃이 PartnerPortalShellView로 감싸므로 공개 헤더·푸터·main을 만들지 않는다.
  assert.doesNotMatch(partnerNotFound, /SiteHeader|Footer|<main/);
  assert.match(partnerNotFound, /href="\/partner"/);
  assert.match(partnerNotFound, /<p className="ui-kicker">404<\/p>/);
});

test("제휴처 상세 404는 (site) 레이아웃 Footer를 중복 렌더하지 않는다", async () => {
  const [detailNotFound, siteLayout] = await Promise.all([
    read("src/app/(site)/partners/[id]/not-found.tsx"),
    read("src/app/(site)/layout.tsx"),
  ]);

  assert.match(siteLayout, /<Footer \/>/);
  assert.doesNotMatch(detailNotFound, /Footer/);
  assert.match(detailNotFound, /<SiteHeader initialSession=\{headerSession\} \/>/);
  assert.match(detailNotFound, /<p className="ui-kicker">404<\/p>/);
  assert.doesNotMatch(detailNotFound, /Partner Detail/);
  assert.match(detailNotFound, /제휴처 목록 보기/);
});
