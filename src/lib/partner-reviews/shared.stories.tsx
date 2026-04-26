import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import {
  applyPartnerReviewReaction,
  buildPartnerReviewSummary,
  createEmptyPartnerReviewReactionState,
  createEmptyPartnerReviewSummary,
  getPartnerReviewAuthorRoleLabel,
  getPartnerReviewRatingLabel,
  getPartnerReviewRatingOptions,
  maskPartnerReviewAuthorName,
  matchesPartnerReviewRatingFilter,
  normalizePartnerReviewRatingFilter,
  normalizePartnerReviewSort,
} from "./shared";

function PartnerReviewsSharedPreview() {
  const emptySummary = createEmptyPartnerReviewSummary();
  const summary = buildPartnerReviewSummary([5, 4, 0, 6, 3]);
  const emptyReaction = createEmptyPartnerReviewReactionState();
  const changedReaction = applyPartnerReviewReaction(
    {
      id: "review-1",
      partnerId: "partner-1",
      memberId: "member-1",
      rating: 5,
      title: "좋아요",
      body: "충분히 긴 리뷰 본문입니다.",
      images: [],
      createdAt: "2026-04-25T00:00:00.000Z",
      updatedAt: "2026-04-25T00:00:00.000Z",
      authorMaskedName: "김**",
      authorRoleLabel: "15기 교육생",
      isMine: false,
      isHidden: false,
      hiddenAt: null,
      recommendCount: 1,
      disrecommendCount: 0,
      myReaction: "recommend",
    },
    "disrecommend",
  );

  return (
    <div className="space-y-2 text-sm text-foreground">
      <div>empty-summary:{JSON.stringify(emptySummary)}</div>
      <div>summary-average:{summary.averageRating}</div>
      <div>summary-total:{summary.totalCount}</div>
      <div>summary-dist-5:{summary.distribution[5]}</div>
      <div>summary-dist-4:{summary.distribution[4]}</div>
      <div>summary-dist-3:{summary.distribution[3]}</div>
      <div>empty-reaction:{JSON.stringify(emptyReaction)}</div>
      <div>changed-reaction:{JSON.stringify(changedReaction)}</div>
      <div>sort-invalid:{normalizePartnerReviewSort("weird")}</div>
      <div>rating-invalid:{normalizePartnerReviewRatingFilter("weird")}</div>
      <div>rating-label-all:{getPartnerReviewRatingLabel("all")}</div>
      <div>rating-label-4:{getPartnerReviewRatingLabel("4")}</div>
      <div>rating-match:{String(matchesPartnerReviewRatingFilter(4, "4"))}</div>
      <div>mask-empty:{maskPartnerReviewAuthorName("")}</div>
      <div>mask-one:{maskPartnerReviewAuthorName("가")}</div>
      <div>mask-many:{maskPartnerReviewAuthorName("김민재")}</div>
      <div>role-admin:{getPartnerReviewAuthorRoleLabel(0)}</div>
      <div>role-member:{getPartnerReviewAuthorRoleLabel(15)}</div>
      <div>role-default:{getPartnerReviewAuthorRoleLabel(null)}</div>
      <div>options-count:{getPartnerReviewRatingOptions().length}</div>
    </div>
  );
}

const meta = {
  title: "Domains/Lib/PartnerReviewsShared",
  component: PartnerReviewsSharedPreview,
} satisfies Meta<typeof PartnerReviewsSharedPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Summary: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/summary-average:3\.6/)).toBeInTheDocument();
    await expect(canvas.getByText("summary-total:5")).toBeInTheDocument();
    await expect(canvas.getByText("summary-dist-5:1")).toBeInTheDocument();
    await expect(canvas.getByText("summary-dist-4:1")).toBeInTheDocument();
    await expect(canvas.getByText("summary-dist-3:1")).toBeInTheDocument();
    await expect(canvas.getByText("sort-invalid:latest")).toBeInTheDocument();
    await expect(canvas.getByText("rating-invalid:all")).toBeInTheDocument();
    await expect(canvas.getByText("rating-label-all:전체 별점")).toBeInTheDocument();
    await expect(canvas.getByText("rating-label-4:4점")).toBeInTheDocument();
    await expect(canvas.getByText("rating-match:true")).toBeInTheDocument();
    await expect(canvas.getByText("mask-empty:익명")).toBeInTheDocument();
    await expect(canvas.getByText("mask-one:가*")).toBeInTheDocument();
    await expect(canvas.getByText("mask-many:김**")).toBeInTheDocument();
    await expect(canvas.getByText("role-admin:운영진")).toBeInTheDocument();
    await expect(canvas.getByText("role-member:15기 교육생")).toBeInTheDocument();
    await expect(canvas.getByText("role-default:구성원")).toBeInTheDocument();
    await expect(canvas.getByText("options-count:6")).toBeInTheDocument();
  },
};
