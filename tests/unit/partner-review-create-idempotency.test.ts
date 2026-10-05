import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  createPartnerReviewMock,
  deleteReviewMediaUrlsMock,
  getPartnerReviewByIdMock,
  getPartnerReviewSummaryMock,
  getReviewMediaInputFieldErrorsMock,
  resolveReviewMediaPayloadMock,
} = vi.hoisted(() => ({
  createPartnerReviewMock: vi.fn(),
  deleteReviewMediaUrlsMock: vi.fn(),
  getPartnerReviewByIdMock: vi.fn(),
  getPartnerReviewSummaryMock: vi.fn(),
  getReviewMediaInputFieldErrorsMock: vi.fn(),
  resolveReviewMediaPayloadMock: vi.fn(),
}));

const reviewId = "11111111-1111-4111-8111-111111111111";

vi.mock("@/lib/activity-logs", () => ({
  getRequestLogContext: () => ({}),
  scheduleProductEventLog: vi.fn(),
}));
vi.mock("@/lib/request-guards", () => ({
  isTrustedSameOriginRequest: () => true,
}));
vi.mock("@/lib/review-media-storage", () => ({
  deleteReviewMediaUrls: deleteReviewMediaUrlsMock,
}));
vi.mock("@/lib/repositories", () => ({
  partnerReviewRepository: {
    createPartnerReview: createPartnerReviewMock,
    getPartnerReviewById: getPartnerReviewByIdMock,
    getPartnerReviewSummary: getPartnerReviewSummaryMock,
  },
}));
vi.mock("../../src/app/api/partners/[id]/reviews/_shared", () => ({
  ensurePartnerReviewModerationAccess: vi.fn(),
  ensureVisibleReviewPartner: vi.fn(async () => ({ id: "partner-1" })),
  getReviewMediaInputFieldErrors: getReviewMediaInputFieldErrorsMock,
  getReviewMemberSession: vi.fn(async () => ({ userId: "member-1" })),
  isReviewImageUploadUnavailable: () => false,
  parseReviewListParams: vi.fn(),
  readPartnerReviewSubmission: vi.fn(async () => ({
    ok: true,
    values: {
      reviewId,
      rating: 5,
      title: "좋아요",
      body: "리뷰 본문입니다.",
      imagesManifest: { images: [] },
    },
  })),
  resolveReviewMediaPayload: resolveReviewMediaPayloadMock,
}));

function storedReview(images: string[]) {
  return {
    id: reviewId,
    partnerId: "partner-1",
    memberId: "member-1",
    images,
  };
}

async function postReview() {
  const { POST } = await import("../../src/app/api/partners/[id]/reviews/route");
  const response = await POST(
    new Request("http://localhost/api/partners/partner-1/reviews", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }),
    { params: Promise.resolve({ id: "partner-1" }) },
  );
  return { status: response.status, body: await response.json() };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  getPartnerReviewSummaryMock.mockResolvedValue({ totalCount: 1 });
  deleteReviewMediaUrlsMock.mockResolvedValue(undefined);
  getReviewMediaInputFieldErrorsMock.mockReturnValue(null);
});

describe("POST /api/partners/[id]/reviews idempotency", () => {
  test("PK 충돌로 진 중복 요청은 저장된 리뷰를 돌려주고 참조되지 않는 업로드만 정리한다", async () => {
    resolveReviewMediaPayloadMock.mockResolvedValue({
      images: ["https://cdn.test/a.webp", "https://cdn.test/b.webp"],
      uploadedUrls: ["https://cdn.test/a.webp", "https://cdn.test/b.webp"],
    });
    createPartnerReviewMock.mockRejectedValue(
      new Error("duplicate key value violates unique constraint \"partner_reviews_pkey\""),
    );
    getPartnerReviewByIdMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(storedReview(["https://cdn.test/a.webp"]));

    const result = await postReview();

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ ok: true, idempotent: true, review: { id: reviewId } });
    expect(deleteReviewMediaUrlsMock).toHaveBeenCalledTimes(1);
    expect(deleteReviewMediaUrlsMock).toHaveBeenCalledWith(["https://cdn.test/b.webp"]);
  });

  test("이미 저장된 리뷰가 있으면 이미지 연결 오류보다 멱등 응답을 우선한다", async () => {
    const mediaError = new Error("이미지가 다른 요청에서 처리 중입니다.");
    resolveReviewMediaPayloadMock.mockRejectedValue(mediaError);
    getReviewMediaInputFieldErrorsMock.mockReturnValue({ images: "다시 업로드해 주세요." });
    getPartnerReviewByIdMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(storedReview([]));

    const result = await postReview();

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ ok: true, idempotent: true });
    expect(createPartnerReviewMock).not.toHaveBeenCalled();
    expect(deleteReviewMediaUrlsMock).not.toHaveBeenCalled();
  });

  test("저장된 리뷰가 없으면 기존처럼 필드 오류를 돌려준다", async () => {
    resolveReviewMediaPayloadMock.mockRejectedValue(new Error("media"));
    getReviewMediaInputFieldErrorsMock.mockReturnValue({ images: "다시 업로드해 주세요." });
    getPartnerReviewByIdMock.mockResolvedValue(null);

    const result = await postReview();

    expect(result.status).toBe(400);
    expect(result.body).toEqual({ ok: false, fieldErrors: { images: "다시 업로드해 주세요." } });
  });

  test("다른 회원의 리뷰와 충돌하면 저장된 리뷰를 노출하지 않는다", async () => {
    resolveReviewMediaPayloadMock.mockResolvedValue({ images: [], uploadedUrls: [] });
    createPartnerReviewMock.mockRejectedValue(new Error("duplicate key"));
    getPartnerReviewByIdMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...storedReview([]), memberId: "member-2" });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      const result = await postReview();

      expect(result.status).toBe(503);
      expect(result.body.ok).toBe(false);
      expect(JSON.stringify(result.body)).not.toContain("member-2");
    } finally {
      consoleError.mockRestore();
    }
  });
});
