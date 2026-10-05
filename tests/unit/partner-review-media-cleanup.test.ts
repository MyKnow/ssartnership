import { beforeEach, describe, expect, test, vi } from "vitest";

const { attachMock, deleteReviewMediaUrlsMock } = vi.hoisted(() => ({
  attachMock: vi.fn(),
  deleteReviewMediaUrlsMock: vi.fn(),
}));

vi.mock("@/lib/review-media-storage", () => ({
  buildReviewMediaStoragePath: (
    partnerId: string,
    reviewId: string,
    index: number,
    uploadId: string,
  ) => `reviews/${partnerId}/${reviewId}/${index}-${uploadId}.webp`,
  deleteReviewMediaUrls: deleteReviewMediaUrlsMock,
}));
vi.mock("@/lib/image-upload/repository.server", () => ({
  getImageUploadRepository: () => ({ attach: attachMock }),
}));
vi.mock("@/lib/partner-change-requests", () => ({
  getPartnerChangeRequestContext: vi.fn(),
}));
vi.mock("@/lib/partner-session", () => ({ getPartnerSession: vi.fn() }));
vi.mock("@/lib/partner-view-context", () => ({ getPartnerViewerContext: vi.fn() }));
vi.mock("@/lib/repositories", () => ({ partnerRepository: {} }));
vi.mock("@/lib/user-auth", () => ({ getUserSession: vi.fn() }));

const reviewId = "11111111-1111-4111-8111-111111111111";
const manifest = {
  images: [
    { kind: "upload" as const, uploadId: "upload-a" },
    { kind: "upload" as const, uploadId: "upload-b" },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  deleteReviewMediaUrlsMock.mockResolvedValue(undefined);
  attachMock
    .mockResolvedValueOnce({ url: "https://cdn.test/a.webp" })
    .mockRejectedValueOnce(new Error("처리된 이미지 파일을 찾을 수 없습니다."));
});

describe("resolveReviewMediaPayload failure cleanup", () => {
  test("수집 배열이 없으면 앞서 연결한 이미지를 직접 정리한다", async () => {
    const { resolveReviewMediaPayload } = await import(
      "../../src/app/api/partners/[id]/reviews/_shared"
    );

    await expect(
      resolveReviewMediaPayload(manifest, "partner-1", reviewId, "member-1"),
    ).rejects.toThrow("처리된 이미지 파일을 찾을 수 없습니다.");

    expect(deleteReviewMediaUrlsMock).toHaveBeenCalledWith(["https://cdn.test/a.webp"]);
  });

  test("수집 배열을 넘기면 연결한 이미지를 남기고 정리를 호출자에게 맡긴다", async () => {
    const { resolveReviewMediaPayload } = await import(
      "../../src/app/api/partners/[id]/reviews/_shared"
    );
    const attachedUrls: string[] = [];

    await expect(
      resolveReviewMediaPayload(manifest, "partner-1", reviewId, "member-1", [], {
        attachedUrls,
      }),
    ).rejects.toThrow("처리된 이미지 파일을 찾을 수 없습니다.");

    expect(attachedUrls).toEqual(["https://cdn.test/a.webp"]);
    expect(deleteReviewMediaUrlsMock).not.toHaveBeenCalled();
    expect(attachMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        uploadId: "upload-a",
        destination: expect.objectContaining({
          path: `reviews/partner-1/${reviewId}/0-upload-a.webp`,
        }),
        resource: { type: "partner_review", id: reviewId },
      }),
    );
  });
});
