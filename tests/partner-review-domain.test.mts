import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

type PartnerReviewSharedModule = typeof import("../src/lib/partner-reviews/shared.ts");
type PartnerReviewReactionsModule = typeof import("../src/lib/partner-review-reactions.ts");
type MockPartnerReviewRepositoryModule =
  typeof import("../src/lib/repositories/mock/partner-review-repository.mock.ts");

const partnerReviewSharedPromise = import(
  new URL("../src/lib/partner-reviews/shared.ts", import.meta.url).href,
) as Promise<PartnerReviewSharedModule>;
const partnerReviewReactionsPromise = import(
  new URL("../src/lib/partner-review-reactions.ts", import.meta.url).href,
) as Promise<PartnerReviewReactionsModule>;
const mockPartnerReviewRepositoryPromise = import(
  new URL("../src/lib/repositories/mock/partner-review-repository.mock.ts", import.meta.url).href,
) as Promise<MockPartnerReviewRepositoryModule>;

const globalScope = globalThis as typeof globalThis & {
  __mockPartnerReviewStore?: unknown;
};

beforeEach(() => {
  delete globalScope.__mockPartnerReviewStore;
});

describe("partner review reaction helpers", () => {
  it("applies optimistic reaction changes without mutating the original review", async () => {
    const { applyPartnerReviewReaction } = await partnerReviewSharedPromise;
    const baseReview = {
      id: "review-1",
      partnerId: "health-001",
      memberId: "member-1",
      rating: 5,
      title: "좋아요",
      body: "충분히 긴 리뷰 본문입니다.",
      images: [],
      createdAt: "2026-04-10T03:00:00.000Z",
      updatedAt: "2026-04-10T03:00:00.000Z",
      authorMaskedName: "김**",
      authorRoleLabel: "15기 교육생",
      isMine: false,
      isHidden: false,
      hiddenAt: null,
      recommendCount: 2,
      disrecommendCount: 1,
      myReaction: "recommend" as const,
    };

    const changed = applyPartnerReviewReaction(baseReview, "disrecommend");
    assert.equal(changed.recommendCount, 1);
    assert.equal(changed.disrecommendCount, 2);
    assert.equal(changed.myReaction, "disrecommend");
    assert.equal(baseReview.recommendCount, 2);
    assert.equal(baseReview.disrecommendCount, 1);
    assert.equal(baseReview.myReaction, "recommend");

    const cleared = applyPartnerReviewReaction(
      { ...baseReview, recommendCount: 0 },
      null,
    );
    assert.equal(cleared.recommendCount, 0);
    assert.equal(cleared.disrecommendCount, 1);
    assert.equal(cleared.myReaction, null);
  });

  it("aggregates reaction counts and current user reaction per review id", async () => {
    const { aggregatePartnerReviewReactionStates } = await partnerReviewReactionsPromise;

    const states = aggregatePartnerReviewReactionStates(
      ["review-1", "review-2", "review-3"],
      [
        { review_id: "review-1", member_id: "member-1", reaction: "recommend" },
        { review_id: "review-1", member_id: "member-2", reaction: "disrecommend" },
        { review_id: "review-2", member_id: "member-2", reaction: "recommend" },
        { review_id: "unknown-review", member_id: "member-2", reaction: "recommend" },
      ],
      "member-2",
    );

    assert.deepEqual(states.get("review-1"), {
      recommendCount: 1,
      disrecommendCount: 1,
      myReaction: "disrecommend",
    });
    assert.deepEqual(states.get("review-2"), {
      recommendCount: 1,
      disrecommendCount: 0,
      myReaction: "recommend",
    });
    assert.deepEqual(states.get("review-3"), {
      recommendCount: 0,
      disrecommendCount: 0,
      myReaction: null,
    });
    assert.equal(states.get("unknown-review"), undefined);
  });
});

describe("mock partner review repository", () => {
  it("lists, filters, sorts, and paginates visible reviews", async () => {
    const { MockPartnerReviewRepository } = await mockPartnerReviewRepositoryPromise;
    const repository = new MockPartnerReviewRepository();

    const latest = await repository.listPartnerReviews({
      partnerId: "health-001",
      currentUserId: "mock-student-15",
      limit: 1,
    });
    assert.equal(latest.items.length, 1);
    assert.equal(latest.items[0]?.id, "mock-review-2");
    assert.equal(latest.items[0]?.isMine, true);
    assert.equal(latest.nextOffset, 1);
    assert.equal(latest.hasMore, true);
    assert.equal(latest.summary.totalCount, 2);
    assert.equal(latest.summary.averageRating, 4.5);

    const ratingDesc = await repository.listPartnerReviews({
      partnerId: "health-001",
      sort: "rating_desc",
      rating: "5",
    });
    assert.deepEqual(
      ratingDesc.items.map((review) => review.id),
      ["mock-review-1"],
    );
  });

  it("creates, updates, reacts to, and soft-deletes owned reviews", async () => {
    const { MockPartnerReviewRepository } = await mockPartnerReviewRepositoryPromise;
    const repository = new MockPartnerReviewRepository();

    const created = await repository.createPartnerReview({
      reviewId: "created-review-1",
      partnerId: "health-001",
      memberId: "mock-student-15",
      rating: 3,
      title: "새 리뷰",
      body: "새롭게 작성한 리뷰 본문입니다.",
      images: ["https://example.com/review.webp"],
    });
    assert.equal(created.isMine, true);
    assert.deepEqual(created.images, ["https://example.com/review.webp"]);

    const updated = await repository.updatePartnerReview({
      reviewId: "created-review-1",
      memberId: "mock-student-15",
      rating: 4,
      title: "수정 리뷰",
      body: "수정한 리뷰 본문입니다.",
      images: [],
    });
    assert.equal(updated.rating, 4);
    assert.equal(updated.title, "수정 리뷰");

    const recommended = await repository.setPartnerReviewReaction({
      reviewId: "created-review-1",
      memberId: "mock-student-14",
      reaction: "recommend",
    });
    assert.equal(recommended.recommendCount, 1);
    assert.equal(recommended.myReaction, "recommend");

    const toggledOff = await repository.setPartnerReviewReaction({
      reviewId: "created-review-1",
      memberId: "mock-student-14",
      reaction: "recommend",
    });
    assert.equal(toggledOff.recommendCount, 0);
    assert.equal(toggledOff.myReaction, null);

    const ownedBeforeDelete = await repository.getOwnedPartnerReview(
      "created-review-1",
      "mock-student-15",
    );
    assert.equal(ownedBeforeDelete?.deletedAt, null);

    await repository.softDeletePartnerReview({
      reviewId: "created-review-1",
      memberId: "mock-student-15",
    });
    const listedAfterDelete = await repository.listPartnerReviews({
      partnerId: "health-001",
      sort: "latest",
    });
    assert.equal(
      listedAfterDelete.items.some((review) => review.id === "created-review-1"),
      false,
    );
    const ownedAfterDelete = await repository.getOwnedPartnerReview(
      "created-review-1",
      "mock-student-15",
    );
    assert.notEqual(ownedAfterDelete?.deletedAt, null);
  });

  it("hides, restores, and deletes reviews for moderation", async () => {
    const { MockPartnerReviewRepository } = await mockPartnerReviewRepositoryPromise;
    const repository = new MockPartnerReviewRepository();

    const hidden = await repository.hidePartnerReview("mock-review-1");
    assert.deepEqual(hidden, {
      reviewId: "mock-review-1",
      partnerId: "health-001",
    });

    const hiddenList = await repository.listPartnerReviews({
      partnerId: "health-001",
      includeHidden: true,
      sort: "oldest",
    });
    assert.equal(hiddenList.items[0]?.id, "mock-review-1");
    assert.equal(hiddenList.items[0]?.isHidden, true);

    const moderationRecord = await repository.getPartnerReviewModerationRecord("mock-review-1");
    assert.notEqual(moderationRecord?.hiddenAt, null);

    const restored = await repository.restorePartnerReview("mock-review-1");
    assert.deepEqual(restored, {
      reviewId: "mock-review-1",
      partnerId: "health-001",
    });

    const deleted = await repository.deletePartnerReview("mock-review-1");
    assert.deepEqual(deleted, {
      reviewId: "mock-review-1",
      partnerId: "health-001",
    });

    const secondDelete = await repository.deletePartnerReview("mock-review-1");
    assert.equal(secondDelete, null);
  });
});
