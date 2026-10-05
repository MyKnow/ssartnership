import { beforeEach, describe, expect, test, vi } from "vitest";

const getSupabaseAdminClient = vi.fn();

vi.mock("../../src/lib/supabase/server", () => ({
  getSupabaseAdminClient,
}));

type ReactionRow = {
  review_id: string;
  member_id: string;
  reaction: "recommend" | "disrecommend";
};

const reviewRow = {
  id: "review-1",
  partner_id: "partner-1",
  member_id: "author-1",
  rating: 5,
  title: "리뷰",
  body: "리뷰 본문",
  images: [],
  created_at: "2026-10-01T00:00:00.000Z",
  updated_at: "2026-10-01T00:00:00.000Z",
  deleted_at: null,
  hidden_at: null,
  members: { display_name: "김싸피", generation: 15 },
};

/**
 * Models `partner_review_reactions` with its (review_id, member_id) unique
 * constraint so racing writes behave like the database: a plain insert of a
 * duplicate pair fails, an upsert on the pair converges.
 */
function createFakeSupabase() {
  const reactions: ReactionRow[] = [];
  const upsertOptions: unknown[] = [];

  const reviewsTable = () => {
    let columns = "";
    const builder = {
      select: (selected: string) => {
        columns = selected;
        return builder;
      },
      eq: () => builder,
      maybeSingle: async () => ({
        data:
          columns === "id,partner_id,deleted_at,hidden_at"
            ? { id: reviewRow.id, partner_id: reviewRow.partner_id, deleted_at: null, hidden_at: null }
            : reviewRow,
        error: null,
      }),
    };
    return builder;
  };

  const reactionsTable = () => ({
    insert: async (row: ReactionRow) => {
      if (reactions.some((item) => item.review_id === row.review_id && item.member_id === row.member_id)) {
        return { error: { code: "23505", message: "duplicate key value violates unique constraint" } };
      }
      reactions.push({ review_id: row.review_id, member_id: row.member_id, reaction: row.reaction });
      return { error: null };
    },
    upsert: async (row: ReactionRow, options: unknown) => {
      upsertOptions.push(options);
      // Yield so concurrent callers interleave like separate requests.
      await Promise.resolve();
      const existing = reactions.find(
        (item) => item.review_id === row.review_id && item.member_id === row.member_id,
      );
      if (existing) {
        existing.reaction = row.reaction;
      } else {
        reactions.push({ review_id: row.review_id, member_id: row.member_id, reaction: row.reaction });
      }
      return { error: null };
    },
    delete: () => {
      const filters: Record<string, string> = {};
      const builder = {
        eq: (column: string, value: string) => {
          filters[column] = value;
          return builder;
        },
        then: (resolve: (value: { error: null }) => void) => {
          for (let index = reactions.length - 1; index >= 0; index -= 1) {
            const row = reactions[index] as Record<string, string>;
            if (Object.entries(filters).every(([column, value]) => row[column] === value)) {
              reactions.splice(index, 1);
            }
          }
          resolve({ error: null });
        },
      };
      return builder;
    },
    select: () => ({
      in: async (_column: string, reviewIds: string[]) => ({
        data: reactions.filter((row) => reviewIds.includes(row.review_id)),
        error: null,
      }),
    }),
  });

  const from = vi.fn((table: string) => {
    if (table === "partner_reviews") return reviewsTable();
    if (table === "partner_review_reactions") return reactionsTable();
    throw new Error(`Unexpected table: ${table}`);
  });

  return { client: { from }, reactions, upsertOptions };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("SupabasePartnerReviewRepository.setPartnerReviewReaction", () => {
  test("동시에 같은 반응을 두 번 보내도 오류 없이 한 행으로 수렴한다", async () => {
    const fake = createFakeSupabase();
    getSupabaseAdminClient.mockReturnValue(fake.client);
    const { SupabasePartnerReviewRepository } = await import(
      "../../src/lib/repositories/supabase/partner-review-repository.supabase"
    );
    const repository = new SupabasePartnerReviewRepository();
    const input = { reviewId: "review-1", memberId: "member-1", reaction: "recommend" as const };

    const [first, second] = await Promise.all([
      repository.setPartnerReviewReaction(input),
      repository.setPartnerReviewReaction(input),
    ]);

    expect(fake.reactions).toEqual([
      { review_id: "review-1", member_id: "member-1", reaction: "recommend" },
    ]);
    expect(fake.upsertOptions).toEqual([
      { onConflict: "review_id,member_id" },
      { onConflict: "review_id,member_id" },
    ]);
    for (const review of [first, second]) {
      expect(review.recommendCount).toBe(1);
      expect(review.myReaction).toBe("recommend");
    }
  });

  test("반응은 원하는 최종 상태로 설정되고 null은 멱등하게 해제한다", async () => {
    const fake = createFakeSupabase();
    getSupabaseAdminClient.mockReturnValue(fake.client);
    const { SupabasePartnerReviewRepository } = await import(
      "../../src/lib/repositories/supabase/partner-review-repository.supabase"
    );
    const repository = new SupabasePartnerReviewRepository();
    const base = { reviewId: "review-1", memberId: "member-1" };

    await repository.setPartnerReviewReaction({ ...base, reaction: "recommend" });
    const retried = await repository.setPartnerReviewReaction({ ...base, reaction: "recommend" });
    expect(retried.myReaction).toBe("recommend");
    expect(retried.recommendCount).toBe(1);

    const switched = await repository.setPartnerReviewReaction({ ...base, reaction: "disrecommend" });
    expect(switched.myReaction).toBe("disrecommend");
    expect(switched.recommendCount).toBe(0);
    expect(switched.disrecommendCount).toBe(1);

    const cleared = await repository.setPartnerReviewReaction({ ...base, reaction: null });
    const clearedAgain = await repository.setPartnerReviewReaction({ ...base, reaction: null });
    expect(cleared.myReaction).toBeNull();
    expect(clearedAgain.myReaction).toBeNull();
    expect(fake.reactions).toEqual([]);
  });
});
