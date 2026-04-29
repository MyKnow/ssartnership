import { beforeEach, describe, expect, test, vi } from "vitest";

const getSupabaseAdminClient = vi.fn();
const createEmptyPartnerReviewReactionState = vi.fn(() => ({
  recommendCount: 0,
  disrecommendCount: 0,
  myReaction: null,
}));
const getPartnerReviewAuthorRoleLabel = vi.fn((year: number | null | undefined) =>
  year === 15 ? "15기" : "알 수 없음",
);
const maskPartnerReviewAuthorName = vi.fn((name: string | null | undefined) =>
  name ? `${name[0]}*` : "익*",
);
const aggregatePartnerReviewReactionStates = vi.fn();

vi.mock("../../src/lib/supabase/server", () => ({
  getSupabaseAdminClient,
}));

vi.mock("../../src/lib/partner-reviews", () => ({
  createEmptyPartnerReviewReactionState,
  getPartnerReviewAuthorRoleLabel,
  maskPartnerReviewAuthorName,
}));

vi.mock("../../src/lib/partner-review-reactions", () => ({
  aggregatePartnerReviewReactionStates,
}));

type QueryState = {
  table: string;
  rows: unknown[];
  count?: number | null;
};

function createSupabaseMock({
  companies = [],
  partners = [],
  reviews = [],
  reactions = [],
  counts = {
    total: 0,
    visible: 0,
    hidden: 0,
  },
}: {
  companies?: unknown[];
  partners?: unknown[];
  reviews?: unknown[];
  reactions?: unknown[];
  counts?: {
    total: number;
    visible: number;
    hidden: number;
  };
}) {
  return {
    rpc(fn: string) {
      if (fn === "get_admin_review_counts") {
        return Promise.resolve({
          data: [
            {
              total_count: counts.total,
              visible_count: counts.visible,
              hidden_count: counts.hidden,
            },
          ],
          error: null,
        });
      }
      return Promise.resolve({ data: [], error: null });
    },
    from(table: string) {
      const state: QueryState = {
        table,
        rows:
          table === "partner_companies"
            ? companies
            : table === "partners"
              ? partners
              : table === "partner_reviews"
                ? reviews
                : table === "partner_review_reactions"
                  ? reactions
                  : [],
      };

      const builder = {
        select(_selection: string, options?: { count?: string; head?: boolean }) {
          if (table === "partner_reviews" && options?.head) {
            let mode: "total" | "visible" | "hidden" = "total";
            const countBuilder = {
              is(field: string, value: unknown) {
                if (field === "hidden_at" && value === null) {
                  mode = "visible";
                }
                return countBuilder;
              },
              not(field: string, _operator: string, value: unknown) {
                if (field === "hidden_at" && value === null) {
                  mode = "hidden";
                }
                return Promise.resolve({
                  count: mode === "hidden" ? counts.hidden : counts.total,
                  error: null,
                });
              },
              then(resolve: (value: { count: number; error: null }) => unknown) {
                return Promise.resolve({
                  count:
                    mode === "visible"
                      ? counts.visible
                      : mode === "hidden"
                        ? counts.hidden
                        : counts.total,
                  error: null,
                }).then(resolve);
              },
            };
            return countBuilder;
          }
          return builder;
        },
        order() {
          if (table === "partner_companies" || table === "partners") {
            return Promise.resolve({ data: state.rows, error: null });
          }
          return builder;
        },
        eq(field: string, value: unknown) {
          if (table === "partners" && field === "company_id") {
            state.rows = (state.rows as Array<{ company_id: string | null }>).filter(
              (row) => row.company_id === value,
            );
            return Promise.resolve({ data: state.rows, error: null });
          }
          if (table === "partner_reviews" && field === "partner_id") {
            state.rows = (state.rows as Array<{ partner_id: string }>).filter(
              (row) => row.partner_id === value,
            );
          }
          if (table === "partner_reviews" && field === "rating") {
            state.rows = (state.rows as Array<{ rating: number }>).filter(
              (row) => row.rating === value,
            );
          }
          return builder;
        },
        in(field: string, values: unknown[]) {
          if (table === "partners" && field === "id") {
            state.rows = (state.rows as Array<{ id: string }>).filter((row) =>
              values.includes(row.id),
            );
          }
          if (table === "partner_reviews" && field === "partner_id") {
            state.rows = (state.rows as Array<{ partner_id: string }>).filter((row) =>
              values.includes(row.partner_id),
            );
            return builder;
          }
          return Promise.resolve({ data: state.rows, error: null });
        },
        is(field: string, value: unknown) {
          if (table === "partner_reviews" && field === "hidden_at") {
            builder.__hidden = value === null ? "visible" : builder.__hidden;
          }
          return builder;
        },
        not(field: string, _operator: string, value: unknown) {
          if (table === "partner_reviews" && field === "hidden_at" && value === null) {
            builder.__hidden = "hidden";
          }
          if (table === "partner_reviews" && field === "images") {
            state.rows = (state.rows as Array<{ images: string[] | null }>).filter(
              (row) => Array.isArray(row.images) && row.images.length > 0,
            );
          }
          return builder;
        },
        limit() {
          return Promise.resolve({ data: state.rows, error: null });
        },
        __hidden: undefined as undefined | "visible" | "hidden",
      };

      return builder;
    },
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("admin review helpers", () => {
  test("parses and serializes filters conservatively", async () => {
    const adminReviews = await import("../../src/lib/admin-reviews");
    const filters = adminReviews.parseAdminReviewFilters({
      sort: "oldest",
      status: "hidden",
      companyId: "company-1",
      partnerId: "partner-1",
      rating: "4",
      imagesOnly: "true",
      memberQuery: "  ssafy15  ",
    });

    expect(filters).toEqual({
      sort: "oldest",
      status: "hidden",
      companyId: "company-1",
      partnerId: "partner-1",
      rating: "4",
      imagesOnly: true,
      memberQuery: "ssafy15",
    });
    expect(adminReviews.serializeAdminReviewFilters(filters)).toBe(
      "sort=oldest&status=hidden&companyId=company-1&partnerId=partner-1&rating=4&imagesOnly=true&memberQuery=ssafy15",
    );
  });

  test("normalizes invalid filter inputs and omits defaults when serializing", async () => {
    const adminReviews = await import("../../src/lib/admin-reviews");
    const filters = adminReviews.parseAdminReviewFilters({
      sort: ["invalid", "oldest"],
      status: "mystery",
      companyId: ["  company-2  "],
      partnerId: ["", "partner-2"],
      rating: "9",
      imagesOnly: "0",
      memberQuery: ["  ", "ssafy"],
    });

    expect(filters).toEqual({
      sort: "latest",
      status: "all",
      companyId: "company-2",
      partnerId: "",
      rating: "all",
      imagesOnly: false,
      memberQuery: "",
    });
    expect(adminReviews.serializeAdminReviewFilters(filters)).toBe("companyId=company-2");
  });

  test('treats "all" company and partner filters as empty values', async () => {
    const adminReviews = await import("../../src/lib/admin-reviews");
    const filters = adminReviews.parseAdminReviewFilters({
      companyId: "all",
      partnerId: "all",
    });

    expect(filters.companyId).toBe("");
    expect(filters.partnerId).toBe("");
    expect(adminReviews.serializeAdminReviewFilters(filters)).toBe("");
  });

  test("getAdminReviewPageData maps relations, reactions, and applies client filtering", async () => {
    aggregatePartnerReviewReactionStates.mockReturnValue(
      new Map([
        [
          "review-1",
          { recommendCount: 3, disrecommendCount: 1, myReaction: "recommend" },
        ],
        [
          "review-2",
          { recommendCount: 0, disrecommendCount: 2, myReaction: null },
        ],
      ]),
    );

    getSupabaseAdminClient.mockReturnValue(
      createSupabaseMock({
        companies: [{ id: "company-1", name: "분식컴퍼니", slug: "bunsik" }],
        partners: [
          {
            id: "partner-1",
            name: "분식랩",
            company_id: "company-1",
            company: { id: "company-1", name: "분식컴퍼니", slug: "bunsik" },
          },
        ],
        reviews: [
          {
            id: "review-1",
            partner_id: "partner-1",
            member_id: "member-1",
            rating: 5,
            title: "최고예요",
            body: "서울 캠퍼스 추천",
            images: ["one.webp"],
            created_at: "2026-04-26T00:00:00.000Z",
            updated_at: "2026-04-26T00:00:00.000Z",
            deleted_at: null,
            deleted_by_member_id: null,
            hidden_at: null,
            partner: {
              id: "partner-1",
              name: "분식랩",
              company_id: "11111111-2222-4333-8444-555555555555",
              company: {
                id: "11111111-2222-4333-8444-555555555555",
                name: "분식컴퍼니",
                slug: "bunsik",
              },
            },
            member: {
              id: "member-1",
              display_name: "김싸피",
              mm_username: "ssafy15",
              year: 15,
              campus: "서울",
            },
          },
          {
            id: "review-2",
            partner_id: "partner-1",
            member_id: "member-2",
            rating: 3,
            title: "보통",
            body: "이미지 없음",
            images: [],
            created_at: "2026-04-25T00:00:00.000Z",
            updated_at: "2026-04-25T00:00:00.000Z",
            deleted_at: null,
            deleted_by_member_id: null,
            hidden_at: null,
            partner: {
              id: "partner-1",
              name: "분식랩",
              company_id: "company-1",
              company: { id: "company-1", name: "분식컴퍼니", slug: "bunsik" },
            },
            member: {
              id: "member-2",
              display_name: "박운영",
              mm_username: "ops15",
              year: null,
              campus: null,
            },
          },
        ],
        reactions: [
          { review_id: "review-1", member_id: "member-3", reaction: "recommend" },
          { review_id: "review-2", member_id: "member-4", reaction: "disrecommend" },
        ],
      }),
    );

    const adminReviews = await import("../../src/lib/admin-reviews");
    const result = await adminReviews.getAdminReviewPageData(
      {
        sort: "latest",
        status: "all",
        companyId: "",
        partnerId: "",
        rating: "all",
        imagesOnly: true,
        memberQuery: "ssafy15",
      },
      { includeCounts: false },
    );

    expect(result.counts).toEqual({ totalCount: 0, visibleCount: 0, hiddenCount: 0 });
    expect(result.companies).toHaveLength(1);
    expect(result.partners).toEqual([
      {
        id: "partner-1",
        name: "분식랩",
        companyId: "company-1",
        companyName: "분식컴퍼니",
        companySlug: "bunsik",
      },
    ]);
    expect(result.reviews).toEqual([
      expect.objectContaining({
        id: "review-1",
        partnerName: "분식랩",
        memberName: "김싸피",
        memberUsername: "ssafy15",
        authorMaskedName: "김*",
        authorRoleLabel: "15기",
        imageCount: 1,
        recommendCount: 3,
        disrecommendCount: 1,
      }),
    ]);
  });

  test("getAdminReviewPageData returns no reviews for invalid partner ids", async () => {
    getSupabaseAdminClient.mockReturnValue(
      createSupabaseMock({
        companies: [],
        partners: [],
        reviews: [],
      }),
    );

    const adminReviews = await import("../../src/lib/admin-reviews");
    const result = await adminReviews.getAdminReviewPageData(
      {
        sort: "latest",
        status: "all",
        companyId: "",
        partnerId: "not-a-uuid",
        rating: "all",
        imagesOnly: false,
        memberQuery: "",
      },
      { includeCounts: false },
    );

    expect(result.reviews).toEqual([]);
  });

  test("getAdminReviewPageData applies status, company, rating, and member filters together", async () => {
    aggregatePartnerReviewReactionStates.mockReturnValue(new Map());

    getSupabaseAdminClient.mockReturnValue(
      createSupabaseMock({
        companies: [
          { id: "11111111-2222-4333-8444-555555555555", name: "분식컴퍼니", slug: "bunsik" },
          { id: "22222222-3333-4444-8555-666666666666", name: "카페컴퍼니", slug: "cafe" },
        ],
        partners: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            name: "분식랩",
            company_id: "11111111-2222-4333-8444-555555555555",
            company: {
              id: "11111111-2222-4333-8444-555555555555",
              name: "분식컴퍼니",
              slug: "bunsik",
            },
          },
          {
            id: "22222222-2222-4222-8222-222222222222",
            name: "카페랩",
            company_id: "22222222-3333-4444-8555-666666666666",
            company: {
              id: "22222222-3333-4444-8555-666666666666",
              name: "카페컴퍼니",
              slug: "cafe",
            },
          },
        ],
        reviews: [
          {
            id: "review-visible-match",
            partner_id: "11111111-1111-4111-8111-111111111111",
            member_id: "member-1",
            rating: 4,
            title: "좋아요",
            body: "분식이 맛있어요",
            images: ["one.webp"],
            created_at: "2026-04-26T00:00:00.000Z",
            updated_at: "2026-04-26T00:00:00.000Z",
            deleted_at: null,
            deleted_by_member_id: null,
            hidden_at: null,
            partner: {
              id: "11111111-1111-4111-8111-111111111111",
              name: "분식랩",
              company_id: "11111111-2222-4333-8444-555555555555",
              company: {
                id: "11111111-2222-4333-8444-555555555555",
                name: "분식컴퍼니",
                slug: "bunsik",
              },
            },
            member: {
              id: "member-1",
              display_name: "김싸피",
              mm_username: "match15",
              year: 15,
              campus: "서울",
            },
          },
          {
            id: "review-hidden",
            partner_id: "11111111-1111-4111-8111-111111111111",
            member_id: "member-2",
            rating: 4,
            title: "숨김",
            body: "숨김 리뷰",
            images: ["two.webp"],
            created_at: "2026-04-25T00:00:00.000Z",
            updated_at: "2026-04-25T00:00:00.000Z",
            deleted_at: null,
            deleted_by_member_id: null,
            hidden_at: "2026-04-25T01:00:00.000Z",
            partner: {
              id: "11111111-1111-4111-8111-111111111111",
              name: "분식랩",
              company_id: "11111111-2222-4333-8444-555555555555",
              company: {
                id: "11111111-2222-4333-8444-555555555555",
                name: "분식컴퍼니",
                slug: "bunsik",
              },
            },
            member: {
              id: "member-2",
              display_name: "박숨김",
              mm_username: "hidden15",
              year: 15,
              campus: "서울",
            },
          },
          {
            id: "review-company-miss",
            partner_id: "22222222-2222-4222-8222-222222222222",
            member_id: "member-3",
            rating: 4,
            title: "다른 업체",
            body: "카페 리뷰",
            images: ["three.webp"],
            created_at: "2026-04-24T00:00:00.000Z",
            updated_at: "2026-04-24T00:00:00.000Z",
            deleted_at: null,
            deleted_by_member_id: null,
            hidden_at: null,
            partner: {
              id: "22222222-2222-4222-8222-222222222222",
              name: "카페랩",
              company_id: "22222222-3333-4444-8555-666666666666",
              company: {
                id: "22222222-3333-4444-8555-666666666666",
                name: "카페컴퍼니",
                slug: "cafe",
              },
            },
            member: {
              id: "member-3",
              display_name: "이다른",
              mm_username: "other15",
              year: 15,
              campus: "서울",
            },
          },
          {
            id: "review-rating-miss",
            partner_id: "11111111-1111-4111-8111-111111111111",
            member_id: "member-4",
            rating: 2,
            title: "별점 다름",
            body: "별점이 달라요",
            images: ["four.webp"],
            created_at: "2026-04-23T00:00:00.000Z",
            updated_at: "2026-04-23T00:00:00.000Z",
            deleted_at: null,
            deleted_by_member_id: null,
            hidden_at: null,
            partner: {
              id: "11111111-1111-4111-8111-111111111111",
              name: "분식랩",
              company_id: "11111111-2222-4333-8444-555555555555",
              company: {
                id: "11111111-2222-4333-8444-555555555555",
                name: "분식컴퍼니",
                slug: "bunsik",
              },
            },
            member: {
              id: "member-4",
              display_name: "최별점",
              mm_username: "rate15",
              year: 15,
              campus: "서울",
            },
          },
        ],
      }),
    );

    const adminReviews = await import("../../src/lib/admin-reviews");
    const result = await adminReviews.getAdminReviewPageData(
      {
        sort: "latest",
        status: "visible",
        companyId: "11111111-2222-4333-8444-555555555555",
        partnerId: "",
        rating: "4",
        imagesOnly: false,
        memberQuery: "match15",
      },
      { includeCounts: false },
    );

    expect(result.reviews).toHaveLength(1);
    expect(result.reviews[0]).toEqual(
      expect.objectContaining({
        id: "review-visible-match",
        companyId: "11111111-2222-4333-8444-555555555555",
        rating: 4,
        isHidden: false,
        memberUsername: "match15",
      }),
    );
  });

  test("getAdminReviewPageData can return hidden reviews only and empty member searches", async () => {
    aggregatePartnerReviewReactionStates.mockReturnValue(new Map());

    getSupabaseAdminClient.mockReturnValue(
      createSupabaseMock({
        companies: [{ id: "company-1", name: "분식컴퍼니", slug: "bunsik" }],
        partners: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            name: "분식랩",
            company_id: "company-1",
            company: { id: "company-1", name: "분식컴퍼니", slug: "bunsik" },
          },
        ],
        reviews: [
          {
            id: "review-hidden-match",
            partner_id: "11111111-1111-4111-8111-111111111111",
            member_id: "member-1",
            rating: 5,
            title: "숨김 대상",
            body: "관리자만 확인",
            images: [],
            created_at: "2026-04-26T00:00:00.000Z",
            updated_at: "2026-04-26T00:00:00.000Z",
            deleted_at: null,
            deleted_by_member_id: null,
            hidden_at: "2026-04-26T01:00:00.000Z",
            partner: {
              id: "11111111-1111-4111-8111-111111111111",
              name: "분식랩",
              company_id: "company-1",
              company: { id: "company-1", name: "분식컴퍼니", slug: "bunsik" },
            },
            member: {
              id: "member-1",
              display_name: "김숨김",
              mm_username: "private15",
              year: 15,
              campus: "서울",
            },
          },
          {
            id: "review-visible-miss",
            partner_id: "11111111-1111-4111-8111-111111111111",
            member_id: "member-2",
            rating: 5,
            title: "공개 대상",
            body: "보이는 리뷰",
            images: [],
            created_at: "2026-04-25T00:00:00.000Z",
            updated_at: "2026-04-25T00:00:00.000Z",
            deleted_at: null,
            deleted_by_member_id: null,
            hidden_at: null,
            partner: {
              id: "11111111-1111-4111-8111-111111111111",
              name: "분식랩",
              company_id: "company-1",
              company: { id: "company-1", name: "분식컴퍼니", slug: "bunsik" },
            },
            member: {
              id: "member-2",
              display_name: "이공개",
              mm_username: "public15",
              year: 15,
              campus: "서울",
            },
          },
        ],
      }),
    );

    const adminReviews = await import("../../src/lib/admin-reviews");
    const hiddenOnly = await adminReviews.getAdminReviewPageData(
      {
        sort: "latest",
        status: "hidden",
        companyId: "",
        partnerId: "",
        rating: "all",
        imagesOnly: false,
        memberQuery: "private15",
      },
      { includeCounts: false },
    );
    const noMatch = await adminReviews.getAdminReviewPageData(
      {
        sort: "latest",
        status: "all",
        companyId: "",
        partnerId: "",
        rating: "all",
        imagesOnly: false,
        memberQuery: "no-such-member",
      },
      { includeCounts: false },
    );

    expect(hiddenOnly.reviews).toHaveLength(1);
    expect(hiddenOnly.reviews[0]).toEqual(
      expect.objectContaining({
        id: "review-hidden-match",
        isHidden: true,
      }),
    );
    expect(noMatch.reviews).toEqual([]);
  });

  test("getAdminReviewCounts returns exact counts when queries succeed", async () => {
    getSupabaseAdminClient.mockReturnValue(
      createSupabaseMock({
        counts: {
          total: 7,
          visible: 5,
          hidden: 2,
        },
      }),
    );

    const adminReviews = await import("../../src/lib/admin-reviews");
    await expect(adminReviews.getAdminReviewCounts()).resolves.toEqual({
      totalCount: 7,
      visibleCount: 5,
      hiddenCount: 2,
    });
  });

  test("getAdminReviewCounts tolerates query errors", async () => {
    getSupabaseAdminClient.mockReturnValue({
      rpc() {
        return Promise.resolve({ data: null, error: new Error("boom") });
      },
      from() {
        return {
          select() {
            const countBuilder = {
              is() {
                return countBuilder;
              },
              not() {
                return Promise.resolve({ count: null, error: new Error("boom") });
              },
            };
            return countBuilder;
          },
        };
      },
    });

    const adminReviews = await import("../../src/lib/admin-reviews");
    await expect(adminReviews.getAdminReviewCounts()).resolves.toEqual({
      totalCount: 0,
      visibleCount: 0,
      hiddenCount: 0,
    });
  });

  test("returns static admin review filter option lists", async () => {
    const adminReviews = await import("../../src/lib/admin-reviews");

    expect(adminReviews.getAdminReviewSortOptions()).toEqual([
      { value: "latest", label: "최신순" },
      { value: "oldest", label: "오래된 순" },
    ]);
    expect(adminReviews.getAdminReviewStatusOptions()).toEqual([
      { value: "all", label: "전체 상태" },
      { value: "visible", label: "공개" },
      { value: "hidden", label: "비공개" },
    ]);
    expect(adminReviews.getAdminReviewRatingOptions()).toEqual([
      { value: "all", label: "전체 별점" },
      { value: "5", label: "5점" },
      { value: "4", label: "4점" },
      { value: "3", label: "3점" },
      { value: "2", label: "2점" },
      { value: "1", label: "1점" },
    ]);
  });
});
