import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import AdminReviewCardView from "./AdminReviewCardView";
import type { AdminReviewRecord } from "@/lib/admin-reviews";

const review: AdminReviewRecord = {
  id: "review-1",
  partnerId: "partner-1",
  partnerName: "역삼 분식랩",
  companyId: "company-1",
  companyName: "분식랩",
  companySlug: "bunsik-lab",
  memberId: "member-1",
  memberName: "김싸피",
  memberUsername: "ssafy15",
  memberYear: 15,
  memberCampus: "서울",
  rating: 5,
  title: "점심 할인 체감이 커서 재방문 의사가 높습니다",
  body: "학생 인증 흐름이 간단했고, 회전이 빨라 수업 사이 방문에도 무리가 없었습니다.",
  images: [],
  createdAt: "2026-04-25T10:00:00.000Z",
  updatedAt: "2026-04-25T10:15:00.000Z",
  deletedAt: null,
  deletedByMemberId: null,
  authorMaskedName: "김**",
  authorRoleLabel: "15기 교육생",
  isHidden: false,
  imageCount: 0,
  recommendCount: 14,
  disrecommendCount: 1,
};

const meta = {
  title: "Domains/Admin/AdminReviewCardView",
  component: AdminReviewCardView,
  args: {
    review,
    returnTo: "/admin/reviews",
    hideAction: async () => {},
    restoreAction: async () => {},
    updateAction: async () => {},
    deleteAction: async () => {},
  },
} satisfies Meta<typeof AdminReviewCardView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Hidden: Story = {
  args: {
    review: {
      ...review,
      isHidden: true,
    },
  },
};

export const EditableWithImages: Story = {
  args: {
    editable: true,
    review: {
      ...review,
      images: [
        "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=900&q=80",
      ],
      imageCount: 1,
    },
  },
};

