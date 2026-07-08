import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import Container from "@/components/ui/Container";
import type { AvailableAdCoupon } from "@/lib/repositories/ad-package-repository";
import CouponWalletView from "./CouponWalletView";

const now = "2026-07-08T09:00:00.000+09:00";

const availableCoupons = [
  {
    coupon: {
      id: "mock-coupon-cafe-morning",
      campaignId: "mock-campaign-cafe-morning",
      partnerId: "cafe-001",
      partnerName: "카페 싸피 역삼본점",
      title: "아침 집중 부스터 아메리카노 1+1 쿠폰",
      description:
        "등교 전이나 오전 스터디 시작 전에 바로 사용할 수 있는 음료 쿠폰입니다. 매장 직원에게 SSAFY 인증 화면을 함께 보여 주세요.",
      code: "MOCK-CAFE-MORNING",
      redemptionType: "onsite",
      discountLabel: "아메리카노 1+1",
      terms: [
        "앱 주문 전 SSAFY 인증 카드와 쿠폰 화면을 함께 제시해야 합니다.",
        "평일 오전 8시부터 11시 30분까지 매장 방문 주문에만 적용됩니다.",
      ],
      status: "active",
      startsAt: now,
      endsAt: "2026-07-31T23:59:59.000+09:00",
      usageLimit: 80,
      perMemberLimit: 2,
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
    coupon: {
      id: "mock-coupon-space-evening",
      campaignId: "mock-campaign-space-evening",
      partnerId: "space-001",
      partnerName: "워크라운지 역삼 스터디룸",
      title: "저녁 스터디룸 1시간 무료 쿠폰",
      description:
        "프로젝트 마감 전 팀 단위로 모일 때 사용할 수 있는 공간 쿠폰입니다. 예약 상황에 따라 이용 시간이 달라질 수 있습니다.",
      code: "MOCK-SPACE-EVENING",
      redemptionType: "onsite",
      discountLabel: "1시간 무료",
      terms: [
        "평일 18시 이후 3인 이상 예약 건에만 적용됩니다.",
        "현장 결제 전에 쿠폰 사용 의사를 먼저 알려야 합니다.",
      ],
      status: "active",
      startsAt: now,
      endsAt: "2026-08-12T23:59:59.000+09:00",
      usageLimit: null,
      perMemberLimit: 1,
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
    const firstDetails = firstSummary.closest("details");
    const secondDetails = secondSummary.closest("details");
    const detailLinks = canvas.getAllByRole("link", { name: /제휴처 상세 보기/ });
    const firstDetailLink = detailLinks.find(
      (link) => link.getAttribute("href") === "/partners/cafe-001#coupons",
    );
    const secondDetailLink = detailLinks.find(
      (link) => link.getAttribute("href") === "/partners/space-001#coupons",
    );

    if (!firstDetails || !secondDetails || !firstDetailLink || !secondDetailLink) {
      throw new Error("Coupon wallet story fixture is incomplete.");
    }

    await expect(canvas.getByRole("heading", { name: "쿠폰함" })).toBeVisible();
    await expect(firstDetails).toHaveAttribute("open");
    await expect(secondDetails).not.toHaveAttribute("open");
    await expect(canvas.getByText(/앱 주문 전 SSAFY 인증 카드/)).toBeVisible();
    await expect(firstDetailLink).toHaveAttribute("href", "/partners/cafe-001#coupons");
    await userEvent.click(secondSummary);
    await expect(secondDetails).toHaveAttribute("open");
    await expect(firstDetails).not.toHaveAttribute("open");
    await expect(canvas.getByText(/평일 18시 이후/)).toBeVisible();
    await expect(secondDetailLink).toHaveAttribute("href", "/partners/space-001#coupons");
  },
};

export const Empty: Story = {
  args: {
    coupons: [],
  },
};
