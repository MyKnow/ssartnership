import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const listRoutes = [
  {
    label: "회원 목록",
    page: "../src/app/admin/(protected)/members/page.tsx",
    content: "AdminMembersContent",
    fallback: "AdminMembersSkeletonContent",
  },
  {
    label: "제휴처 목록",
    page: "../src/app/admin/(protected)/partners/page.tsx",
    content: "AdminPartnersContent",
    fallback: "AdminPartnersSkeletonContent",
  },
  {
    label: "변경 요청 목록",
    page: "../src/app/admin/(protected)/partner-requests/page.tsx",
    content: "AdminPartnerRequestsContent",
    fallback: "AdminPartnerRequestsSkeletonContent",
  },
  {
    label: "제휴처 상세",
    page: "../src/app/admin/(protected)/partners/[partnerId]/page.tsx",
    content: "AdminPartnerDetailContent",
    fallback: "AdminPartnerDetailSkeletonContent",
  },
  {
    label: "리뷰 관리",
    page: "../src/app/admin/(protected)/reviews/page.tsx",
    content: "AdminReviewsContent",
    fallback: "AdminReviewsSkeletonContent",
  },
  {
    label: "파트너사 관리",
    page: "../src/app/admin/(protected)/companies/page.tsx",
    content: "AdminCompaniesContent",
    fallback: "AdminCompaniesSkeletonContent",
  },
  {
    label: "카테고리 관리",
    page: "../src/app/admin/(protected)/categories/page.tsx",
    content: "AdminCategoriesContent",
    fallback: "AdminCategoriesSkeletonContent",
  },
];

test("대표 관리자 목록은 셸과 read model 콘텐츠를 분리해 스트리밍한다", async () => {
  for (const route of listRoutes) {
    const pageSource = await readFile(new URL(route.page, import.meta.url), "utf8");

    assert.match(pageSource, /<AdminShell/);
    assert.match(
      pageSource,
      new RegExp(`<Suspense fallback=\\{<${route.fallback} \/>\\}>`),
      route.label,
    );
    assert.match(pageSource, new RegExp(`async function ${route.content}`), route.label);
  }
});
