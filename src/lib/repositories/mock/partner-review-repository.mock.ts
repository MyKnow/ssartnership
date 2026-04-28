import {
  buildPartnerReviewSummary,
  createEmptyPartnerReviewReactionState,
  getPartnerReviewAuthorRoleLabel,
  maskPartnerReviewAuthorName,
  matchesPartnerReviewRatingFilter,
  normalizePartnerReviewRatingFilter,
  normalizePartnerReviewSort,
  type PartnerReview,
  type PartnerReviewReaction,
} from "@/lib/partner-reviews";
import { mockPreviewMembers } from "@/lib/mock/member-preview";
import type {
  CreatePartnerReviewInput,
  HidePartnerReviewResult,
  PartnerReviewListContext,
  PartnerReviewModerationRecord,
  PartnerReviewOwnedRecord,
  PartnerReviewRepository,
  ReviewModerationActor,
  SetPartnerReviewReactionInput,
  SoftDeletePartnerReviewInput,
  UpdatePartnerReviewInput,
} from "@/lib/repositories/partner-review-repository";

type MockReviewRecord = {
  id: string;
  partnerId: string;
  memberId: string;
  rating: number;
  title: string;
  body: string;
  images: string[];
  deletedAt: string | null;
  deletedByMemberId: string | null;
  hiddenAt: string | null;
  hiddenByAdminId?: string | null;
  hiddenByPartnerAccountId?: string | null;
  createdAt: string;
  updatedAt: string;
};

type MockReactionRecord = {
  reviewId: string;
  memberId: string;
  reaction: PartnerReviewReaction;
};

type MockReviewStore = {
  reviews: MockReviewRecord[];
  reactions: MockReactionRecord[];
};

const seededReviews: MockReviewRecord[] = [
  {
    id: "mock-review-1",
    partnerId: "health-001",
    memberId: "mock-student-14",
    rating: 5,
    title: "시설이 깔끔합니다",
    body: "러닝머신과 샤워실 상태가 좋아서 만족도가 높았습니다.",
    images: [],
    deletedAt: null,
    deletedByMemberId: null,
    hiddenAt: null,
    createdAt: "2026-04-10T03:00:00.000Z",
    updatedAt: "2026-04-10T03:00:00.000Z",
  },
  {
    id: "mock-review-2",
    partnerId: "health-001",
    memberId: "mock-student-15",
    rating: 4,
    title: "가성비가 좋습니다",
    body: "SSAFY 제휴가 적용돼서 월 이용권 부담이 많이 줄었습니다.",
    images: [],
    deletedAt: null,
    deletedByMemberId: null,
    hiddenAt: null,
    createdAt: "2026-04-11T06:20:00.000Z",
    updatedAt: "2026-04-11T06:20:00.000Z",
  },
];

const globalScope = globalThis as typeof globalThis & {
  __mockPartnerReviewStore?: MockReviewStore;
};

function getStore() {
  if (!globalScope.__mockPartnerReviewStore) {
    globalScope.__mockPartnerReviewStore = {
      reviews: seededReviews.map((review) => ({ ...review, images: [...review.images] })),
      reactions: [],
    };
  }
  return globalScope.__mockPartnerReviewStore;
}

function getReviewReactionState(recordId: string, currentUserId?: string | null) {
  const reactions = getStore().reactions.filter((reaction) => reaction.reviewId === recordId);
  const state = createEmptyPartnerReviewReactionState();
  for (const reaction of reactions) {
    if (reaction.reaction === "recommend") {
      state.recommendCount += 1;
    } else {
      state.disrecommendCount += 1;
    }
    if (currentUserId && reaction.memberId === currentUserId) {
      state.myReaction = reaction.reaction;
    }
  }
  return state;
}

function mapReview(record: MockReviewRecord, currentUserId?: string | null): PartnerReview {
  const member = mockPreviewMembers.find((item) => item.id === record.memberId);
  const reactionState = getReviewReactionState(record.id, currentUserId);
  return {
    id: record.id,
    partnerId: record.partnerId,
    memberId: record.memberId,
    rating: record.rating,
    title: record.title,
    body: record.body,
    images: [...record.images],
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    authorMaskedName: maskPartnerReviewAuthorName(member?.display_name),
    authorRoleLabel: getPartnerReviewAuthorRoleLabel(member?.year),
    isMine: currentUserId === record.memberId,
    isHidden: record.hiddenAt !== null,
    hiddenAt: record.hiddenAt,
    recommendCount: reactionState.recommendCount,
    disrecommendCount: reactionState.disrecommendCount,
    myReaction: reactionState.myReaction,
  };
}

function sortReviews(reviews: MockReviewRecord[], sort: string) {
  const copy = [...reviews];
  if (sort === "oldest") {
    return copy.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  if (sort === "rating_desc") {
    return copy.sort((a, b) => b.rating - a.rating || b.createdAt.localeCompare(a.createdAt));
  }
  if (sort === "rating_asc") {
    return copy.sort((a, b) => a.rating - b.rating || b.createdAt.localeCompare(a.createdAt));
  }
  return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export class MockPartnerReviewRepository implements PartnerReviewRepository {
  async getPartnerReviewSummary(partnerId: string) {
    const ratings = getStore()
      .reviews.filter(
        (review) => review.partnerId === partnerId && !review.deletedAt && !review.hiddenAt,
      )
      .map((review) => review.rating);
    return buildPartnerReviewSummary(ratings);
  }

  async listPartnerReviews(context: PartnerReviewListContext) {
    const limit = Math.max(1, Math.min(20, context.limit ?? 10));
    const offset = Math.max(0, context.offset ?? 0);
    const sort = normalizePartnerReviewSort(context.sort);
    const rating = normalizePartnerReviewRatingFilter(context.rating);
    const rows = sortReviews(
      getStore().reviews.filter(
        (review) =>
          review.partnerId === context.partnerId &&
          matchesPartnerReviewRatingFilter(review.rating, rating) &&
          !review.deletedAt &&
          (context.includeHidden || !review.hiddenAt) &&
          (!context.imagesOnly || review.images.length > 0),
      ),
      sort,
    );
    const items = rows
      .slice(offset, offset + limit)
      .map((review) => mapReview(review, context.currentUserId));
    const summary = buildPartnerReviewSummary(
      rows
        .filter((review) => !review.deletedAt && !review.hiddenAt)
        .map((review) => review.rating),
    );
    return {
      summary,
      items,
      nextOffset: offset + items.length,
      hasMore: offset + items.length < rows.length,
    };
  }

  async createPartnerReview(input: CreatePartnerReviewInput) {
    const now = new Date().toISOString();
    const review: MockReviewRecord = {
      id: input.reviewId,
      partnerId: input.partnerId,
      memberId: input.memberId,
      rating: input.rating,
      title: input.title,
      body: input.body,
      images: [...input.images],
      deletedAt: null,
      deletedByMemberId: null,
      hiddenAt: null,
      createdAt: now,
      updatedAt: now,
    };
    getStore().reviews.unshift(review);
    return mapReview(review, input.memberId);
  }

  async updatePartnerReview(input: UpdatePartnerReviewInput) {
    const review = getStore().reviews.find(
      (item) =>
        item.id === input.reviewId &&
        item.memberId === input.memberId &&
        item.deletedAt === null &&
        item.hiddenAt === null,
    );
    if (!review) {
      throw new Error("리뷰를 찾을 수 없습니다.");
    }
    review.rating = input.rating;
    review.title = input.title;
    review.body = input.body;
    review.images = [...input.images];
    review.updatedAt = new Date().toISOString();
    return mapReview(review, input.memberId);
  }

  async softDeletePartnerReview(input: SoftDeletePartnerReviewInput) {
    const review = getStore().reviews.find(
      (item) =>
        item.id === input.reviewId &&
        item.memberId === input.memberId &&
        item.deletedAt === null &&
        item.hiddenAt === null,
    );
    if (!review) {
      throw new Error("리뷰를 찾을 수 없습니다.");
    }
    review.deletedAt = new Date().toISOString();
    review.deletedByMemberId = input.memberId;
    review.updatedAt = review.deletedAt;
  }

  async setPartnerReviewReaction(input: SetPartnerReviewReactionInput) {
    const review = getStore().reviews.find(
      (item) =>
        item.id === input.reviewId &&
        item.deletedAt === null &&
        item.hiddenAt === null,
    );
    if (!review) {
      throw new Error("리뷰를 찾을 수 없습니다.");
    }

    const currentIndex = getStore().reactions.findIndex(
      (reaction) =>
        reaction.reviewId === input.reviewId && reaction.memberId === input.memberId,
    );
    const currentReaction = currentIndex >= 0 ? getStore().reactions[currentIndex] : null;

    if (!input.reaction || currentReaction?.reaction === input.reaction) {
      if (currentIndex >= 0) {
        getStore().reactions.splice(currentIndex, 1);
      }
      return mapReview(review, input.memberId);
    }

    if (currentIndex >= 0) {
      getStore().reactions[currentIndex] = {
        reviewId: input.reviewId,
        memberId: input.memberId,
        reaction: input.reaction,
      };
    } else {
      getStore().reactions.push({
        reviewId: input.reviewId,
        memberId: input.memberId,
        reaction: input.reaction,
      });
    }

    return mapReview(review, input.memberId);
  }

  async hidePartnerReview(
    reviewId: string,
    actor: ReviewModerationActor,
  ): Promise<HidePartnerReviewResult | null> {
    const review = getStore().reviews.find(
      (item) => item.id === reviewId && item.deletedAt === null && item.hiddenAt === null,
    );
    if (!review) {
      return null;
    }
    review.hiddenAt = new Date().toISOString();
    review.updatedAt = review.hiddenAt;
    review.hiddenByAdminId = actor.actorType === "admin" ? actor.adminId : null;
    review.hiddenByPartnerAccountId =
      actor.actorType === "partner" ? actor.partnerAccountId : null;
    return {
      reviewId: review.id,
      partnerId: review.partnerId,
    };
  }

  async restorePartnerReview(
    reviewId: string,
    actor: ReviewModerationActor,
  ): Promise<HidePartnerReviewResult | null> {
    void actor;
    const review = getStore().reviews.find(
      (item) => item.id === reviewId && item.deletedAt === null && item.hiddenAt !== null,
    );
    if (!review) {
      return null;
    }
    review.hiddenAt = null;
    review.updatedAt = new Date().toISOString();
    review.hiddenByAdminId = null;
    review.hiddenByPartnerAccountId = null;
    return {
      reviewId: review.id,
      partnerId: review.partnerId,
    };
  }

  async deletePartnerReview(reviewId: string): Promise<HidePartnerReviewResult | null> {
    const review = getStore().reviews.find((item) => item.id === reviewId && item.deletedAt === null);
    if (!review) {
      return null;
    }
    review.deletedAt = new Date().toISOString();
    review.deletedByMemberId = null;
    review.updatedAt = review.deletedAt;
    return {
      reviewId: review.id,
      partnerId: review.partnerId,
    };
  }

  async getPartnerReviewModerationRecord(
    reviewId: string,
  ): Promise<PartnerReviewModerationRecord | null> {
    const review = getStore().reviews.find((item) => item.id === reviewId);
    if (!review) {
      return null;
    }
    return {
      id: review.id,
      partnerId: review.partnerId,
      deletedAt: review.deletedAt,
      hiddenAt: review.hiddenAt,
    };
  }

  async getOwnedPartnerReview(reviewId: string, memberId: string): Promise<PartnerReviewOwnedRecord | null> {
    const review = getStore().reviews.find(
      (item) => item.id === reviewId && item.memberId === memberId,
    );
    if (!review) {
      return null;
    }
    return {
      id: review.id,
      partnerId: review.partnerId,
      memberId: review.memberId,
      images: [...review.images],
      deletedAt: review.deletedAt,
      hiddenAt: review.hiddenAt,
    };
  }
}
