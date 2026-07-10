import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { PartnerChangeRequestSummary } from "@/lib/partner-change-requests";
import PartnerChangeRequestQueue from "./PartnerChangeRequestQueue";

const request: PartnerChangeRequestSummary = {
  id: "change-request-001",
  companyId: "company-cafe-001",
  companyName: "카페 싸피 운영 주식회사",
  companySlug: "cafe-ssafy",
  partnerId: "partner-cafe-yeoksam",
  partnerName: "카페 싸피 역삼점",
  partnerLocation: "서울특별시 강남구 테헤란로 212 인근",
  currentDetailDescription: "SSAFY 구성원을 위한 캠퍼스 인근 카페입니다.",
  currentPartnerName: "카페 싸피 역삼점",
  currentPartnerLocation: "서울 강남구 테헤란로 212",
  currentMapUrl: "https://maps.example.com/current-location",
  currentCampusSlugs: ["seoul"],
  categoryLabel: "카페/디저트",
  status: "pending",
  requestedByAccountId: "partner-account-001",
  requestedByLoginId: "cafe-ssafy-manager",
  requestedByDisplayName: "카페 싸피 운영 담당자",
  currentConditions: ["SSAFY 모바일 인증 화면 제시"],
  currentBenefits: ["전 메뉴 10% 할인"],
  currentAppliesTo: ["staff", "student", "graduate"],
  currentTags: ["카페", "스터디"],
  currentThumbnail: null,
  currentImages: [],
  currentReservationLink: null,
  currentInquiryLink: "https://example.com/inquiry",
  currentPeriodStart: "2026-03-01",
  currentPeriodEnd: "2026-12-31",
  requestedConditions: ["SSAFY 모바일 인증 화면을 결제 전에 제시"],
  requestedBenefits: ["음료 15% 할인", "디저트 세트 2,000원 할인"],
  requestedAppliesTo: ["staff", "student", "graduate"],
  requestedTags: ["카페", "스터디", "테이크아웃"],
  requestedThumbnail: null,
  requestedImages: [],
  requestedReservationLink: "https://example.com/reservation",
  requestedInquiryLink: "https://example.com/inquiry",
  requestedPeriodStart: "2026-03-01",
  requestedPeriodEnd: "2027-02-28",
  requestedPartnerName: "카페 싸피 역삼 캠퍼스점",
  requestedPartnerLocation: "서울특별시 강남구 테헤란로 212 1층",
  requestedDetailDescription: "캠퍼스에서 도보 3분 거리의 제휴 카페입니다.",
  requestedMapUrl: "https://maps.example.com/requested-location",
  requestedCampusSlugs: ["seoul"],
  reviewedByAdminId: null,
  reviewedAt: null,
  cancelledByAccountId: null,
  cancelledAt: null,
  createdAt: "2026-07-09T10:00:00+09:00",
  updatedAt: "2026-07-09T10:00:00+09:00",
};

const meta = {
  title: "Domains/Admin/PartnerChangeRequestQueue",
  component: PartnerChangeRequestQueue,
  args: {
    requests: [request],
    approveAction: async () => {},
    rejectAction: async () => {},
    canReview: true,
  },
  parameters: {
    chromatic: { viewports: [360, 820, 1366] },
  },
} satisfies Meta<typeof PartnerChangeRequestQueue>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: { requests: [] },
};

export const Readonly: Story = {
  args: { canReview: false },
};
