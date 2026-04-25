import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { PartnerReviewSummary } from "@/lib/partner-reviews";
import PartnerReviewSummaryCard from "./PartnerReviewSummaryCard";

const populatedSummary: PartnerReviewSummary = {
  averageRating: 4.6,
  totalCount: 37,
  distribution: {
    1: 1,
    2: 1,
    3: 3,
    4: 10,
    5: 22,
  },
};

const meta = {
  title: "Domains/PartnerReviewSummaryCard",
  component: PartnerReviewSummaryCard,
  args: {
    summary: populatedSummary,
  },
} satisfies Meta<typeof PartnerReviewSummaryCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Populated: Story = {};

export const Empty: Story = {
  args: {
    summary: {
      averageRating: 0,
      totalCount: 0,
      distribution: {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
      },
    },
  },
};
