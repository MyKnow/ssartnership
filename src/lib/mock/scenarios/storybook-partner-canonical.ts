import type { AdminPartnerFileCategory } from "@/lib/admin-partner-file-import";
import type { PartnerBillingProfileRecord } from "@/lib/partner-billing-profiles";
import type { PartnerBankTransferAccount } from "@/lib/partner-billing-config";
import type { PartnerChangeRequestContext } from "@/lib/partner-change-requests";
import type { PartnerPortalServiceMetrics } from "@/lib/partner-dashboard";
import type { PartnerMetricTimeseriesSnapshot } from "@/lib/partner-metric-timeseries";
import type { PartnerNotificationPreferenceState } from "@/lib/partner-notification-routing";
import type { PartnerNotificationCenterData } from "@/lib/partner-notifications";
import type { PartnerPlanPortalData } from "@/lib/partner-plan-service";
import type { PartnerReview, PartnerReviewSummary } from "@/lib/partner-reviews";
import type { PartnerSession } from "@/lib/partner-session";

export const PARTNER_CANONICAL_STORY_COMPANY_ID =
  "mock-partner-company-cafe-ssafy";
export const PARTNER_CANONICAL_STORY_PARTNER_ID =
  "mock-partner-service-cafe-ssafy-yeoksam";

const createdAt = "2026-07-05T09:30:00.000+09:00";

export const partnerCanonicalStorySession = {
  accountId: "mock-partner-account-cafe-ssafy",
  loginId: "partner@cafessafy.example",
  displayName: "김도연",
  companyIds: [PARTNER_CANONICAL_STORY_COMPANY_ID],
  mustChangePassword: false,
  issuedAt: 1_783_210_200,
  expiresAt: 1_783_296_600,
} satisfies PartnerSession;

export const partnerCanonicalBillingProfiles = [
  {
    id: "mock-billing-profile-cafe-ssafy",
    companyId: PARTNER_CANONICAL_STORY_COMPANY_ID,
    accountId: partnerCanonicalStorySession.accountId,
    label: "카페 싸피 본점",
    payerName: "카페싸피 운영팀",
    businessRegistrationNumber: "2208162517",
    businessName: "카페싸피",
    representativeName: "김싸피",
    businessAddress: "서울 강남구 테헤란로 212 멀티캠퍼스 역삼 1층",
    businessType: "음식점업",
    businessItem: "커피 및 디저트",
    taxInvoiceEmail: "tax@cafessafy.example",
    taxDocumentType: "tax_invoice",
    isDefault: true,
    lastUsedAt: createdAt,
    archivedAt: null,
    createdAt,
    updatedAt: createdAt,
  },
] satisfies PartnerBillingProfileRecord[];

export const partnerCanonicalBankTransferAccount = {
  bankName: "싸피은행",
  accountNumber: "1002-000-123456",
  accountHolder: "싸트너십",
  configured: true,
} satisfies PartnerBankTransferAccount;

export const partnerCanonicalPlanData = {
  brands: [
    {
      id: PARTNER_CANONICAL_STORY_PARTNER_ID,
      name: "카페 싸피 역삼본점",
      companyId: PARTNER_CANONICAL_STORY_COMPANY_ID,
      companyName: "카페 싸피",
      companySlug: "cafe-ssafy",
      location: "서울 강남구 역삼로 123",
      visibility: "public",
      periodStart: "2026-03-01",
      periodEnd: "2026-08-31",
      planTier: "basic",
      planStartedAt: "2026-03-01T00:00:00.000Z",
      planExpiresAt: "2026-08-31T23:59:59.000Z",
      planUpdatedAt: createdAt,
    },
    {
      id: "mock-partner-service-cafe-ssafy-samseong",
      name: "카페 싸피 삼성점",
      companyId: PARTNER_CANONICAL_STORY_COMPANY_ID,
      companyName: "카페 싸피",
      companySlug: "cafe-ssafy",
      location: "서울 강남구 영동대로 513",
      visibility: "public",
      periodStart: "2026-03-01",
      periodEnd: "2026-12-31",
      planTier: "boost",
      planStartedAt: "2026-06-01T00:00:00.000Z",
      planExpiresAt: "2026-12-31T23:59:59.000Z",
      planUpdatedAt: createdAt,
    },
  ],
  requests: [],
  events: [],
} satisfies PartnerPlanPortalData;

export const partnerCanonicalServiceContext = {
  companyId: PARTNER_CANONICAL_STORY_COMPANY_ID,
  companyName: "카페 싸피",
  companySlug: "cafe-ssafy",
  brandPlanTier: "basic",
  partnerId: PARTNER_CANONICAL_STORY_PARTNER_ID,
  partnerName: "카페 싸피 역삼본점",
  partnerLocation: "서울 강남구 역삼로 123",
  detailDescription:
    "역삼역 인근에서 커피와 작업 좌석을 함께 제공하는 카페 싸피 대표 제휴처입니다.",
  partnerCreatedAt: "2026-03-01T00:00:00.000Z",
  categoryLabel: "카페",
  categoryColor: "#38bdf8",
  visibility: "public",
  periodStart: "2026-03-01",
  periodEnd: "2026-08-31",
  thumbnail: null,
  images: [],
  tags: ["작업", "디저트"],
  mapUrl: "https://map.naver.com/",
  benefitActionType: "external_link",
  benefitActionLink: "https://booking.naver.com/",
  reservationLink: "https://booking.naver.com/",
  inquiryLink: "02-555-8123",
  currentConditions: ["SSAFY 구성원 인증", "매장 주문 시 적용"],
  currentDetailDescription:
    "역삼역 인근에서 커피와 작업 좌석을 함께 제공하는 카페 싸피 대표 제휴처입니다.",
  currentBenefits: ["아메리카노 20% 할인", "디저트 세트 1,500원 할인"],
  currentAppliesTo: ["staff", "student"],
  currentTags: ["작업", "디저트"],
  currentCampusSlugs: ["seoul"],
  currentThumbnail: null,
  currentImages: [],
  currentReservationLink: "https://booking.naver.com/",
  currentInquiryLink: "02-555-8123",
  currentPeriodStart: "2026-03-01",
  currentPeriodEnd: "2026-08-31",
  pendingRequest: null,
  requestHistory: [],
} satisfies PartnerChangeRequestContext;

export const partnerCanonicalServiceMetrics = {
  favoriteCount: 124,
  detailViews: 1_240,
  detailUv: 0,
  cardClicks: 360,
  mapClicks: 58,
  reservationClicks: 81,
  inquiryClicks: 26,
  reviewCount: 24,
  totalClicks: 525,
} satisfies PartnerPortalServiceMetrics;

export const partnerCanonicalMetricTimeseries = {
  periodLabel: "최근 30일",
  hour: {
    granularity: "hour",
    labels: ["10시", "11시", "12시"],
    points: [
      {
        label: "10시",
        denominator: 30,
        pvTotal: 150,
        uvTotal: 90,
        ctaTotal: 18,
        pv: 5,
        uv: 3,
        cta: 0.6,
      },
      {
        label: "11시",
        denominator: 30,
        pvTotal: 240,
        uvTotal: 150,
        ctaTotal: 30,
        pv: 8,
        uv: 5,
        cta: 1,
      },
      {
        label: "12시",
        denominator: 30,
        pvTotal: 330,
        uvTotal: 210,
        ctaTotal: 48,
        pv: 11,
        uv: 7,
        cta: 1.6,
      },
    ],
    maxAverage: 11,
    hasData: true,
  },
  weekday: {
    granularity: "weekday",
    labels: ["월", "화", "수", "목", "금"],
    points: ["월", "화", "수", "목", "금"].map((label, index) => ({
      label,
      denominator: 4,
      pvTotal: 120 + index * 20,
      uvTotal: 72 + index * 12,
      ctaTotal: 16 + index * 4,
      pv: 30 + index * 5,
      uv: 18 + index * 3,
      cta: 4 + index,
    })),
    maxAverage: 50,
    hasData: true,
  },
  warningMessage: null,
} satisfies PartnerMetricTimeseriesSnapshot;

export const partnerCanonicalReviewSummary = {
  averageRating: 4.8,
  totalCount: 24,
  distribution: { 1: 0, 2: 1, 3: 2, 4: 5, 5: 16 },
} satisfies PartnerReviewSummary;

export const partnerCanonicalReviews = [
  {
    id: "mock-partner-review-cafe-ssafy",
    partnerId: PARTNER_CANONICAL_STORY_PARTNER_ID,
    memberId: "mock-member-15-seoul",
    rating: 5,
    title: "혜택 적용이 빠르고 안내가 친절했어요",
    body: "SSAFY 인증을 보여드리니 바로 할인이 적용됐고 작업 좌석도 편했습니다.",
    images: [],
    createdAt,
    updatedAt: createdAt,
    authorMaskedName: "김**",
    authorRoleLabel: "15기 교육생",
    isMine: false,
    isHidden: false,
    hiddenAt: null,
    recommendCount: 8,
    disrecommendCount: 0,
    myReaction: null,
  },
] satisfies PartnerReview[];

export const partnerCanonicalNotificationData = {
  warningMessage: null,
  summary: {
    totalCount: 3,
    requestCount: 1,
    pendingRequestCount: 0,
    resolvedRequestCount: 1,
    reviewCount: 1,
    operationCount: 0,
    companyCount: 1,
    serviceCount: 2,
  },
  items: [
    {
      id: "mock-partner-notification-plan-pending",
      notificationId: "11111111-1111-4111-8111-111111111111",
      readAt: null,
      isUnread: true,
      category: "plan",
      status: "pending",
      tone: "warning",
      badgeLabel: "입금 확인 대기",
      title: "카페 싸피 삼성점 Boost 업그레이드 요청이 접수되었습니다",
      body: "입금 확인 후 관리자가 승인하면 플랜과 상세 지표가 반영됩니다.",
      companyId: PARTNER_CANONICAL_STORY_COMPANY_ID,
      companyName: "카페 싸피",
      partnerId: "mock-partner-service-cafe-ssafy-samseong",
      partnerName: "카페 싸피 삼성점",
      href: `/partner/companies/${PARTNER_CANONICAL_STORY_COMPANY_ID}/plans`,
      createdAt,
    },
    {
      id: "mock-partner-notification-review",
      notificationId: "22222222-2222-4222-8222-222222222222",
      readAt: null,
      isUnread: true,
      category: "review",
      status: "created",
      tone: "primary",
      badgeLabel: "새 리뷰",
      title: "카페 싸피 역삼본점에 새 리뷰가 등록되었습니다",
      body: "리뷰 목록에서 별점과 답변 필요 여부를 확인해 주세요.",
      companyId: PARTNER_CANONICAL_STORY_COMPANY_ID,
      companyName: "카페 싸피",
      partnerId: PARTNER_CANONICAL_STORY_PARTNER_ID,
      partnerName: "카페 싸피 역삼본점",
      href: `/partner/companies/${PARTNER_CANONICAL_STORY_COMPANY_ID}/services/${PARTNER_CANONICAL_STORY_PARTNER_ID}`,
      createdAt: "2026-07-05T08:50:00.000+09:00",
    },
    {
      id: "mock-partner-notification-request",
      notificationId: "33333333-3333-4333-8333-333333333333",
      readAt: "2026-07-04T18:30:00.000+09:00",
      isUnread: false,
      category: "request",
      status: "rejected",
      tone: "danger",
      badgeLabel: "수정 반려",
      title: "카페 싸피 잠실점 위치 변경 요청이 반려되었습니다",
      body: "주소와 지도 URL을 확인해 수정 요청을 다시 제출해 주세요.",
      companyId: PARTNER_CANONICAL_STORY_COMPANY_ID,
      companyName: "카페 싸피",
      partnerId: "mock-partner-service-cafe-ssafy-jamsil",
      partnerName: "카페 싸피 잠실점",
      href: `/partner/companies/${PARTNER_CANONICAL_STORY_COMPANY_ID}/services/mock-partner-service-cafe-ssafy-jamsil?mode=edit`,
      createdAt: "2026-07-04T18:15:00.000+09:00",
    },
  ],
} satisfies PartnerNotificationCenterData;

export const partnerCanonicalNotificationPreferences = {
  enabled: true,
  portalEnabled: true,
  pushEnabled: true,
  emailEnabled: true,
  planEnabled: true,
  expiringPartnerEnabled: true,
  metricsEnabled: true,
} satisfies PartnerNotificationPreferenceState;

export const partnerCanonicalCategories = [
  { id: "mock-category-cafe", key: "cafe", label: "카페" },
  { id: "mock-category-food", key: "food", label: "음식점" },
  { id: "mock-category-health", key: "health", label: "헬스" },
] satisfies AdminPartnerFileCategory[];
