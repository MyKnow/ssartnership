import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import Container from "@/components/ui/Container";
import type { AvailableAdCoupon } from "@/lib/repositories/ad-package-repository";
import CouponPartnerVerificationView from "./CouponPartnerVerificationView";

const verificationItem = {
  coupon: {
    id: "coupon-story-onsite",
    campaignId: "campaign-story-onsite",
    partnerId: "partner-story",
    partnerName: "카페 싸피 역삼본점",
    title: "아메리카노 1+1 쿠폰",
    description: "현장 결제 전에 싸트너십 인증 카드와 쿠폰을 함께 보여 주세요.",
    code: "",
    issuanceType: "service",
    redemptionType: "onsite",
    discountLabel: "아메리카노 1+1",
    terms: ["회원 1인 1회 사용", "다른 할인과 중복 불가"],
    status: "active",
    startsAt: "2026-07-01T00:00:00.000+09:00",
    endsAt: "2026-07-31T23:59:59.000+09:00",
    downloadStartsAt: "2026-07-01T00:00:00.000+09:00",
    downloadEndsAt: "2026-07-31T23:59:59.000+09:00",
    usageStartsAt: "2026-07-01T00:00:00.000+09:00",
    usageEndsAt: "2026-07-31T23:59:59.000+09:00",
    usageLimit: null,
    dailyIssueLimit: null,
    weeklyIssueLimit: null,
    monthlyIssueLimit: null,
    perMemberDailyIssueLimit: 1,
    perMemberWeeklyIssueLimit: 2,
    perMemberMonthlyIssueLimit: 4,
    issuedCount: 12,
    remainingIssueCount: null,
    perMemberLimit: 1,
    hasOnsitePassword: true,
    usedCount: 12,
    externalUrl: "",
    createdAt: "2026-07-01T00:00:00.000+09:00",
    updatedAt: "2026-07-01T00:00:00.000+09:00",
  },
  issueId: "issue-story-onsite",
  assignedCode: null,
  issuedAt: "2026-07-10T10:00:00.000+09:00",
  usedAt: null,
  memberUsedCount: 0,
  remainingMemberUses: 1,
  remainingGlobalUses: null,
} satisfies AvailableAdCoupon;

const meta = {
  title: "Screens/Coupons/PartnerVerification",
  component: CouponPartnerVerificationView,
  args: {
    item: verificationItem,
    member: {
      mattermostUsername: "story-member",
      displayName: "김싸피",
      generation: 15,
      campus: "서울",
      profileImageUrl: null,
    },
    cohortCardThemes: [],
  },
  render: (args) => (
    <Container className="pb-12 pt-6" size="wide">
      <CouponPartnerVerificationView {...args} />
    </Container>
  ),
} satisfies Meta<typeof CouponPartnerVerificationView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByTestId("certification-card-frame")).toBeVisible();
    await expect(canvas.getByText("제휴처")).toBeVisible();
    await expect(canvas.getByText("아메리카노 1+1 쿠폰")).toBeVisible();
    const passwordInput = canvasElement.querySelector<HTMLInputElement>(
      'input[name="onsitePassword"]',
    );
    await expect(passwordInput).not.toBeNull();
    await expect(passwordInput).toHaveAttribute("type", "password");
    await expect(
      canvas.getByRole("button", { name: "인증 카드와 쿠폰 확인" }),
    ).toBeVisible();
  },
};
