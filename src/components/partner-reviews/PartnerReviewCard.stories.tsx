import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { PartnerReview } from "@/lib/partner-reviews";
import PartnerReviewCard from "./PartnerReviewCard";

const demoImage = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640">
    <defs>
      <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stop-color="#dbeafe"/>
        <stop offset="100%" stop-color="#bfdbfe"/>
      </linearGradient>
    </defs>
    <rect width="640" height="640" rx="36" fill="url(#g)"/>
    <circle cx="196" cy="220" r="72" fill="#60a5fa" opacity="0.35"/>
    <circle cx="454" cy="408" r="92" fill="#1d4ed8" opacity="0.18"/>
    <text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle" fill="#1e3a8a" font-size="44" font-family="sans-serif">Review Image</text>
  </svg>`,
)}`;

const baseReview: PartnerReview = {
  id: "review-1",
  partnerId: "partner-1",
  memberId: "member-1",
  rating: 5,
  title: "점심 시간대 회전이 빠르고 응대가 안정적입니다",
  body:
    "대기 인원이 있어도 주문 흐름이 매끄럽고, 학생 인증 절차도 빨라서 점심 시간 이용성이 좋았습니다. 다음 방문에도 재사용할 가능성이 높습니다.",
  images: [],
  createdAt: "2026-04-25T12:00:00.000Z",
  updatedAt: "2026-04-25T12:00:00.000Z",
  authorMaskedName: "김**",
  authorRoleLabel: "15기 교육생",
  isMine: false,
  isHidden: false,
  hiddenAt: null,
  recommendCount: 24,
  disrecommendCount: 2,
  myReaction: null,
};

const meta = {
  title: "Domains/PartnerReviewCard",
  component: PartnerReviewCard,
  args: {
    review: baseReview,
    onEdit: () => {},
    onDelete: () => {},
    onReact: () => {},
    showOwnerActions: false,
  },
} satisfies Meta<typeof PartnerReviewCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Recommended: Story = {
  args: {
    review: {
      ...baseReview,
      myReaction: "recommend",
    },
  },
};

export const HiddenForAdmin: Story = {
  args: {
    review: {
      ...baseReview,
      isHidden: true,
      hiddenAt: "2026-04-25T13:00:00.000Z",
    },
    showHiddenContent: true,
    showModerationActions: true,
    onHide: () => {},
    onRestore: () => {},
  },
};

export const WithImages: Story = {
  args: {
    review: {
      ...baseReview,
      images: [demoImage, demoImage],
    },
  },
};
