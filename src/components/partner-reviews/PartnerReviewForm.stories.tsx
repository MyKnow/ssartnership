"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { PartnerReview } from "@/lib/partner-reviews";
import PartnerReviewForm from "./PartnerReviewForm";

const existingReview: PartnerReview = {
  id: "review-1",
  partnerId: "partner-1",
  memberId: "member-1",
  rating: 4,
  title: "점심 시간에도 응대가 안정적이었습니다",
  body: "제휴 인증 과정이 빠르고 좌석 회전이 빨라서 수업 전후 이용이 편했습니다.",
  images: [],
  createdAt: "2026-04-25T11:00:00.000Z",
  updatedAt: "2026-04-25T11:00:00.000Z",
  authorMaskedName: "김**",
  authorRoleLabel: "15기 교육생",
  isMine: true,
  isHidden: false,
  hiddenAt: null,
  recommendCount: 12,
  disrecommendCount: 1,
  myReaction: null,
};

const meta = {
  title: "Domains/PartnerReviewForm",
  component: PartnerReviewForm,
  args: {
    partnerId: "partner-1",
    onCancel: () => {},
    onSubmitted: async () => {},
  },
} satisfies Meta<typeof PartnerReviewForm>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Create: Story = {};

export const Edit: Story = {
  args: {
    review: existingReview,
  },
};
