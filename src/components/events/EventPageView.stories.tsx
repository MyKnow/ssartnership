import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import EventPageView from "@/components/events/EventPageView";
import { SIGNUP_REWARD_EVENT } from "@/lib/event-pages/signup-reward";
import type { EventRewardSummary } from "@/lib/promotions/event-rewards";

const campaign = {
  ...SIGNUP_REWARD_EVENT,
  slug: "story-active-reward",
  title: "서울 캠퍼스 제휴 이용 이벤트",
  periodLabel: "2026년 7월 1일 ~ 2026년 7월 31일",
  startsAt: "2026-07-01T00:00:00+09:00",
  endsAt: "2026-07-31T23:59:59+09:00",
};

const summary: EventRewardSummary = {
  authenticated: true,
  totalTickets: 3,
  conditions: campaign.conditions.map((condition, index) => ({
    key: condition.key,
    status: index < 2 ? "received" : "missing",
    earnedTickets: index < 2 ? condition.tickets : 0,
    currentCount: condition.repeatable ? 1 : undefined,
  })),
};

const meta = {
  title: "Screens/Public/EventPageView",
  component: EventPageView,
  args: {
    campaign,
    summary,
    showHeroImage: false,
    showRegistrationNotice: false,
  },
} satisfies Meta<typeof EventPageView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
