import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import Container from "@/components/ui/Container";
import type { AvailableAdCoupon } from "@/lib/repositories/ad-package-repository";
import CouponWalletView from "./CouponWalletView";

const now = "2026-07-08T09:00:00.000+09:00";

const availableCoupons = [
  {
    issueId: "mock-issued-coupon-cafe-morning",
    coupon: {
      id: "mock-coupon-cafe-morning",
      campaignId: "mock-campaign-cafe-morning",
      partnerId: "cafe-001",
      partnerName: "카페 싸피 역삼본점",
      title: "아침 집중 부스터 아메리카노 1+1 쿠폰",
      description:
        "등교 전이나 오전 스터디 시작 전에 바로 사용할 수 있는 음료 쿠폰입니다. 매장 직원에게 SSAFY 인증 화면을 함께 보여 주세요.",
      code: "MOCK-CAFE-MORNING",
      issuanceType: "service",
      redemptionType: "onsite",
      discountLabel: "아메리카노 1+1",
      terms: [
        "앱 주문 전 SSAFY 인증 카드와 쿠폰 화면을 함께 제시해야 합니다.",
        "평일 오전 8시부터 11시 30분까지 매장 방문 주문에만 적용됩니다.",
      ],
      status: "active",
      startsAt: now,
      endsAt: "2026-07-31T23:59:59.000+09:00",
      downloadStartsAt: now,
      downloadEndsAt: "2026-07-31T23:59:59.000+09:00",
      usageStartsAt: now,
      usageEndsAt: "2026-07-31T23:59:59.000+09:00",
      usageLimit: 80,
      dailyIssueLimit: null,
      weeklyIssueLimit: null,
      monthlyIssueLimit: null,
      perMemberDailyIssueLimit: null,
      perMemberWeeklyIssueLimit: null,
      perMemberMonthlyIssueLimit: null,
      issuedCount: 32,
      remainingIssueCount: 48,
      perMemberLimit: 2,
      hasOnsitePassword: true,
      usedCount: 32,
      externalUrl: "",
      createdAt: now,
      updatedAt: now,
    },
    memberUsedCount: 0,
    remainingMemberUses: 2,
    remainingGlobalUses: 48,
  },
  {
    issueId: "mock-issued-coupon-space-evening",
    coupon: {
      id: "mock-coupon-space-evening",
      campaignId: "mock-campaign-space-evening",
      partnerId: "space-001",
      partnerName: "워크라운지 역삼 스터디룸",
      title: "저녁 스터디룸 1시간 무료 쿠폰",
      description:
        "프로젝트 마감 전 팀 단위로 모일 때 사용할 수 있는 공간 쿠폰입니다. 예약 상황에 따라 이용 시간이 달라질 수 있습니다.",
      code: "MOCK-SPACE-EVENING",
      issuanceType: "service",
      redemptionType: "onsite",
      discountLabel: "1시간 무료",
      terms: [
        "평일 18시 이후 3인 이상 예약 건에만 적용됩니다.",
        "현장 결제 전에 쿠폰 사용 의사를 먼저 알려야 합니다.",
      ],
      status: "active",
      startsAt: now,
      endsAt: "2026-08-12T23:59:59.000+09:00",
      downloadStartsAt: now,
      downloadEndsAt: "2026-08-12T23:59:59.000+09:00",
      usageStartsAt: now,
      usageEndsAt: "2026-08-12T23:59:59.000+09:00",
      usageLimit: null,
      dailyIssueLimit: null,
      weeklyIssueLimit: null,
      monthlyIssueLimit: null,
      perMemberDailyIssueLimit: null,
      perMemberWeeklyIssueLimit: null,
      perMemberMonthlyIssueLimit: null,
      issuedCount: 9,
      remainingIssueCount: null,
      perMemberLimit: 1,
      hasOnsitePassword: true,
      usedCount: 9,
      externalUrl: "",
      createdAt: now,
      updatedAt: now,
    },
    memberUsedCount: 0,
    remainingMemberUses: 1,
    remainingGlobalUses: null,
  },
] satisfies AvailableAdCoupon[];

const meta = {
  title: "Page States/Coupons/Wallet",
  component: CouponWalletView,
  render: (args) => (
    <div className="min-h-screen bg-background">
      <Container className="pb-12 pt-6" size="wide">
        <CouponWalletView {...args} />
      </Container>
    </div>
  ),
} satisfies Meta<typeof CouponWalletView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AvailableAccordion: Story = {
  args: {
    coupons: availableCoupons,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const firstSummary = canvas.getByText("아침 집중 부스터 아메리카노 1+1 쿠폰");
    const secondSummary = canvas.getByText("저녁 스터디룸 1시간 무료 쿠폰");
    const firstCard = firstSummary.closest("article");
    const secondCard = secondSummary.closest("article");
    const firstToggle = firstCard?.querySelector("button[aria-controls]");
    const secondToggle = secondCard?.querySelector("button[aria-controls]");
    const firstUseLink = firstCard?.querySelector('a[href="/coupons?issueId=mock-issued-coupon-cafe-morning"]');
    const secondUseLink = secondCard?.querySelector('a[href="/coupons?issueId=mock-issued-coupon-space-evening"]');
    const firstPartnerLink = canvas.getByRole("link", {
      name: "카페 싸피 역삼본점 제휴처 상세 보기",
    });
    const secondPartnerLink = canvas.getByRole("link", {
      name: "워크라운지 역삼 스터디룸 제휴처 상세 보기",
    });

    if (!firstCard || !secondCard || !firstToggle || !secondToggle || !firstUseLink || !secondUseLink) {
      throw new Error("Coupon wallet story fixture is incomplete.");
    }

    await expect(canvas.getByRole("heading", { name: "쿠폰함" })).toBeVisible();
    await expect(canvas.queryByText("가장 빠른 만료")).not.toBeInTheDocument();
    await expect(canvas.queryByText("내 2회")).not.toBeInTheDocument();
    await expect(
      canvas.queryByText("제휴처 상세에서 쿠폰을 확인하고 사용할 수 있습니다."),
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByText("제휴처 상세에서 쿠폰 사용 방법을 확인해 주세요."),
    ).not.toBeInTheDocument();
    await expect(canvas.queryByText("전체 잔여 수량")).not.toBeInTheDocument();
    await expect(canvas.queryByText("전체 제한 없음")).not.toBeInTheDocument();
    await expect(canvas.getAllByRole("link", { name: "사용하기" }).length).toBeGreaterThan(0);
    await expect(firstToggle).toHaveAttribute("aria-expanded", "true");
    await expect(secondToggle).toHaveAttribute("aria-expanded", "false");
    await expect(firstUseLink).toBeVisible();
    await expect(secondUseLink).toBeVisible();
    await expect(canvas.getByText(/앱 주문 전 SSAFY 인증 카드/)).toBeVisible();
    await expect(firstPartnerLink).toHaveAttribute("href", "/partners/cafe-001#coupons");
    await userEvent.click(secondToggle);
    await expect(secondToggle).toHaveAttribute("aria-expanded", "true");
    await expect(firstToggle).toHaveAttribute("aria-expanded", "false");
    await expect(firstUseLink).toBeVisible();
    await expect(canvas.getByText(/평일 18시 이후/)).toBeVisible();
    await expect(secondPartnerLink).toHaveAttribute("href", "/partners/space-001#coupons");
  },
};

export const Empty: Story = {
  args: {
    coupons: [],
  },
};
