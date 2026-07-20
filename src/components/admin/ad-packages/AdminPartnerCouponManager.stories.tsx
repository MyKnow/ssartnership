import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import AdminPartnerCouponManager from "./AdminPartnerCouponManager";
import type {
  AdCampaignWithStats,
  AdCoupon,
} from "@/lib/repositories/ad-package-repository";

const partnerId = "partner-cafe-ssafy";
const campaign: AdCampaignWithStats = {
  id: "campaign-cafe-boost",
  partnerId,
  partnerName: "카페 싸피 역삼점",
  packageTier: "boost",
  title: "카페 싸피 여름 캠페인",
  description: "여름 시즌 캠페인",
  sponsorLabel: "카페 싸피 제공",
  status: "active",
  startsAt: "2026-07-01T00:00:00.000Z",
  endsAt: "2026-08-31T23:59:59.000Z",
  channels: ["coupon", "home_banner"],
  monthlyPriceKrw: 150000,
  notes: "",
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
  coupons: [],
  metrics: {
    homeBannerClicks: 182,
    couponViews: 96,
    couponCopies: 44,
    couponIntentCount: 53,
    couponRedemptions: 21,
    adPushSends: 0,
  },
};

function createCoupon(overrides: Partial<AdCoupon>): AdCoupon {
  return {
    id: "coupon-cafe-lunch",
    campaignId: campaign.id,
    partnerId,
    partnerName: "카페 싸피 역삼점",
    title: "점심 아메리카노 1,000원 할인",
    description: "평일 점심 한정",
    code: "SSAFY-CAFE",
    issuanceType: "service",
    redemptionType: "onsite",
    discountLabel: "1,000원 할인",
    terms: ["평일 점심 한정", "회원별 1회"],
    status: "active",
    startsAt: "2026-07-01T00:00:00.000Z",
    endsAt: "2026-08-31T23:59:59.000Z",
    downloadStartsAt: "2026-07-01T00:00:00.000Z",
    downloadEndsAt: "2026-08-31T23:59:59.000Z",
    usageStartsAt: "2026-07-01T00:00:00.000Z",
    usageEndsAt: "2026-08-31T23:59:59.000Z",
    usageLimit: 300,
    dailyIssueLimit: 50,
    weeklyIssueLimit: null,
    monthlyIssueLimit: null,
    perMemberDailyIssueLimit: 1,
    perMemberWeeklyIssueLimit: 3,
    perMemberMonthlyIssueLimit: 10,
    issuedCount: 84,
    remainingIssueCount: 216,
    perMemberLimit: 1,
    hasOnsitePassword: true,
    usedCount: 21,
    externalUrl: "",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

const meta = {
  title: "Domains/Admin/PartnerDetail/AdminPartnerCouponManager",
  component: AdminPartnerCouponManager,
  args: {
    partnerId,
    partnerName: "카페 싸피 역삼점",
    campaigns: [campaign],
    coupons: [
      createCoupon({}),
      createCoupon({
        id: "coupon-cafe-new",
        campaignId: null,
        title: "신규 회원 디저트 세트",
        discountLabel: "2,000원 할인",
        status: "draft",
        redemptionType: "code",
        hasOnsitePassword: false,
        usedCount: 0,
      }),
    ],
    createCouponAction: async () => {},
    updateCouponAction: async () => {},
    duplicateCouponAction: async () => {},
    deleteCouponAction: async () => {},
    canUpdateCoupon: true,
    canDeleteCoupon: true,
  },
  parameters: {
    chromatic: { viewports: [360, 820, 1366] },
  },
} satisfies Meta<typeof AdminPartnerCouponManager>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText("카페 싸피 역삼점").length).toBeGreaterThan(0);
    const createAccordionButton = canvas.getByRole("button", { name: "쿠폰 생성" });
    await expect(createAccordionButton).toBeInTheDocument();
    await expect(createAccordionButton.closest("details")).not.toHaveAttribute("open");
    await expect(canvas.getByText("신규 회원 디저트 세트")).toBeInTheDocument();
    await expect(canvas.getAllByText("수정").length).toBeGreaterThan(0);
    await expect(canvas.getAllByRole("button", { name: "복제" }).length).toBeGreaterThan(0);
    await expect(canvas.getAllByRole("button", { name: "삭제" }).length).toBeGreaterThan(0);
    await userEvent.click(createAccordionButton);
    await expect(canvas.getByText("현장 확인형 쿠폰에 사용할 숫자 4자리 PIN입니다.")).toBeInTheDocument();
  },
};
