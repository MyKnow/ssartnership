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
  {
    label: "운영 로그",
    page: "../src/app/admin/(protected)/logs/page.tsx",
    content: "AdminLogsContent",
    fallback: "AdminLogsSkeletonContent",
  },
  {
    label: "발송 관리",
    page: "../src/app/admin/(protected)/push/page.tsx",
    content: "AdminPushContent",
    fallback: "AdminPushSkeletonContent",
  },
  {
    label: "내 알림",
    page: "../src/app/admin/(protected)/notifications/page.tsx",
    content: "AdminNotificationsContent",
    fallback: "AdminNotificationsSkeletonContent",
  },
  {
    label: "홈 광고 관리",
    page: "../src/app/admin/(protected)/advertisement/page.tsx",
    content: "AdminAdvertisementContent",
    fallback: "AdminAdvertisementSkeletonContent",
  },
  {
    label: "기수 관리",
    page: "../src/app/admin/(protected)/cycle/page.tsx",
    content: "AdminCycleContent",
    fallback: "AdminCycleSkeletonContent",
  },
  {
    label: "이벤트 관리",
    page: "../src/app/admin/(protected)/event/page.tsx",
    content: "AdminEventContent",
    fallback: "AdminEventSkeletonContent",
  },
  {
    label: "제휴 등록 신청",
    page: "../src/app/admin/(protected)/partner-registrations/page.tsx",
    content: "AdminPartnerRegistrationsContent",
    fallback: "AdminPartnerRegistrationsSkeletonContent",
  },
  {
    label: "수료생 인증",
    page: "../src/app/admin/(protected)/graduate-verifications/page.tsx",
    content: "AdminGraduateVerificationsContent",
    fallback: "AdminGraduateVerificationsSkeletonContent",
  },
  {
    label: "프로필 사진",
    page: "../src/app/admin/(protected)/profile-photos/page.tsx",
    content: "AdminProfilePhotosContent",
    fallback: "AdminProfilePhotosSkeletonContent",
  },
  {
    label: "회원 상세",
    page: "../src/app/admin/(protected)/members/[memberId]/page.tsx",
    content: "AdminMemberDetailContent",
    fallback: "AdminMemberDetailSkeletonContent",
  },
  {
    label: "가입 승인",
    page: "../src/app/admin/(protected)/member-signup-requests/page.tsx",
    content: "AdminMemberSignupRequestsContent",
    fallback: "AdminMemberSignupRequestsSkeletonContent",
  },
  {
    label: "관리자 관리",
    page: "../src/app/admin/(protected)/admins/page.tsx",
    content: "AdminAccountsContent",
    fallback: "AdminAccountsSkeletonContent",
  },
  {
    label: "알림 템플릿",
    page: "../src/app/admin/(protected)/notification-templates/page.tsx",
    content: "AdminNotificationTemplatesContent",
    fallback: "AdminNotificationTemplatesSkeletonContent",
  },
  {
    label: "통합 검색",
    page: "../src/app/admin/(protected)/search/page.tsx",
    content: "AdminGlobalSearchContent",
    fallback: "AdminGlobalSearchSkeletonContent",
  },
  {
    label: "제휴처 추가",
    page: "../src/app/admin/(protected)/partners/new/page.tsx",
    content: "AdminPartnerNewContent",
    fallback: "AdminPartnerNewSkeletonContent",
  },
  {
    label: "이벤트 상세",
    page: "../src/app/admin/(protected)/event/[slug]/page.tsx",
    content: "AdminEventDetailContent",
    fallback: "AdminEventDetailSkeletonContent",
  },
  {
    label: "가입 승인 상세",
    page: "../src/app/admin/(protected)/member-signup-requests/[requestId]/page.tsx",
    content: "AdminMemberSignupRequestDetailContent",
    fallback: "AdminMemberSignupRequestDetailSkeletonContent",
  },
];

test("대표 관리자 목록은 셸과 read model 콘텐츠를 분리해 스트리밍한다", async () => {
  for (const route of listRoutes) {
    const pageSource = await readFile(new URL(route.page, import.meta.url), "utf8");

    assert.match(pageSource, /<AdminShell/);
    if (pageSource.includes("showHeader={false}")) {
      assert.match(pageSource, /showHeader=\{false\}/, route.label);
      assert.match(pageSource, new RegExp(`async function ${route.content}`), route.label);
      continue;
    }
    assert.match(
      pageSource,
      new RegExp(`<Suspense fallback=\\{<${route.fallback} \/>\\}>`),
      route.label,
    );
    assert.match(pageSource, new RegExp(`async function ${route.content}`), route.label);
  }
});
