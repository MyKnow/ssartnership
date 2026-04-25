import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { AdminReviewPageData } from "@/lib/admin-reviews";
import AdminReviewManagerView from "./AdminReviewManagerView";

const reviewData: AdminReviewPageData = {
  counts: {
    totalCount: 128,
    visibleCount: 112,
    hiddenCount: 16,
  },
  filters: {
    sort: "latest",
    status: "all",
    companyId: "",
    partnerId: "",
    rating: "all",
    imagesOnly: false,
    memberQuery: "",
  },
  companies: [
    {
      id: "company-1",
      name: "분식랩",
      slug: "bunsik-lab",
    },
    {
      id: "company-2",
      name: "카페 루프",
      slug: "cafe-loop",
    },
  ],
  partners: [
    {
      id: "partner-1",
      name: "역삼 분식랩",
      companyId: "company-1",
      companyName: "분식랩",
      companySlug: "bunsik-lab",
    },
    {
      id: "partner-2",
      name: "카페 루프 역삼점",
      companyId: "company-2",
      companyName: "카페 루프",
      companySlug: "cafe-loop",
    },
  ],
  reviews: [
    {
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
      title: "점심 회전이 빨라 반복 방문하기 좋았습니다",
      body: "학생 인증 흐름이 빠르고 포장 대기 시간이 짧아서 수업 사이에 이용하기 편했습니다.",
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
    },
    {
      id: "review-2",
      partnerId: "partner-2",
      partnerName: "카페 루프 역삼점",
      companyId: "company-2",
      companyName: "카페 루프",
      companySlug: "cafe-loop",
      memberId: "member-2",
      memberName: "박운영",
      memberUsername: "ops15",
      memberYear: 15,
      memberCampus: "서울",
      rating: 3,
      title: "좌석은 넉넉하지만 피크 시간은 다소 혼잡합니다",
      body: "혜택 자체는 명확했고, 매장 응대는 안정적이었습니다. 다만 피크 시간 혼잡도는 체크가 필요합니다.",
      images: [],
      createdAt: "2026-04-24T09:00:00.000Z",
      updatedAt: "2026-04-24T09:20:00.000Z",
      deletedAt: null,
      deletedByMemberId: null,
      authorMaskedName: "박**",
      authorRoleLabel: "15기 운영진",
      isHidden: true,
      imageCount: 0,
      recommendCount: 4,
      disrecommendCount: 2,
    },
  ],
};

const meta = {
  title: "Domains/Admin/AdminReviewManager",
  component: AdminReviewManagerView,
  args: {
    data: reviewData,
    returnTo: "/admin/reviews",
    hideAction: async () => {},
    restoreAction: async () => {},
    updateAction: async () => {},
    deleteAction: async () => {},
  },
} satisfies Meta<typeof AdminReviewManagerView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    data: {
      ...reviewData,
      reviews: [],
    },
  },
};

export const WithError: Story = {
  args: {
    errorMessage: "리뷰 변경 처리 중 일시적인 오류가 발생했습니다.",
  },
};

export const WithImageReview: Story = {
  args: {
    data: {
      ...reviewData,
      reviews: [
        reviewData.reviews[0]!,
        {
          ...reviewData.reviews[1]!,
          images: ["https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=900&q=80"],
          imageCount: 1,
        },
      ],
    },
  },
};
