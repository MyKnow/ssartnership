import {
  normalizePartnerReviewRatingFilter,
  normalizePartnerReviewSort,
} from "@/lib/partner-reviews";
import { getPartnerChangeRequestContext } from "@/lib/partner-change-requests";
import { getPartnerSession } from "@/lib/partner-session";
import { getPartnerViewerContext } from "@/lib/partner-view-context";
import { partnerRepository } from "@/lib/repositories";
import {
  assertReviewMediaExistingUrls,
  REVIEW_MEDIA_BUCKET,
  type ReviewMediaManifest,
} from "@/lib/review-media";
import {
  buildReviewMediaStoragePath,
  deleteReviewMediaUrls,
} from "@/lib/review-media-storage";
import {
  resolveImageTransformPolicy,
} from "@/lib/image-upload/policy";
import { getImageUploadRepository } from "@/lib/image-upload/repository.supabase";
import {
  INVALID_REVIEW_MEDIA_MESSAGE,
  parseReviewSubmissionRequest,
  type ReviewFieldErrors,
  type ParsedReviewSubmission,
} from "@/lib/review-validation";
import { MAX_EXTENDED_JSON_BODY_BYTES } from "@/lib/request-body-limit";
import {
  RouteJsonBodyError,
  readRouteJsonBodyWithinLimit,
} from "@/lib/route-json-body";
import { getUserSession } from "@/lib/user-auth";

const INVALID_REVIEW_BODY_MESSAGE = "리뷰 요청 형식을 확인해 주세요.";
const OVERSIZED_REVIEW_BODY_MESSAGE = "리뷰 요청이 너무 큽니다.";

class ReviewMediaInputError extends Error {
  constructor(message = INVALID_REVIEW_MEDIA_MESSAGE) {
    super(message);
    this.name = "ReviewMediaInputError";
  }
}

export function getReviewMediaInputFieldErrors(
  error: unknown,
): ReviewFieldErrors | null {
  return error instanceof ReviewMediaInputError
    ? { images: error.message }
    : null;
}

export async function getReviewMemberSession() {
  return getUserSession();
}

export async function ensureVisibleReviewPartner(
  partnerId: string,
  currentUserId?: string | null,
) {
  return partnerRepository.getPartnerById(
    partnerId,
    await getPartnerViewerContext(currentUserId),
  );
}

export function parseReviewListParams(request: Request) {
  const url = new URL(request.url);
  const sort = normalizePartnerReviewSort(url.searchParams.get("sort"));
  const offset = clampListNumber(url.searchParams.get("offset"), 0);
  const limit = clampListNumber(url.searchParams.get("limit"), 10, 1, 20);
  const rating = normalizePartnerReviewRatingFilter(url.searchParams.get("rating"));
  const imagesOnly = parseBooleanParam(url.searchParams.get("imagesOnly"));
  const includeHidden = parseBooleanParam(url.searchParams.get("includeHidden"));
  return { sort, offset, limit, rating, imagesOnly, includeHidden };
}

export async function ensurePartnerReviewModerationAccess(partnerId: string) {
  const session = await getPartnerSession().catch(() => null);
  if (!session || session.mustChangePassword) {
    return null;
  }
  const context = await getPartnerChangeRequestContext(session.companyIds, partnerId).catch(
    () => null,
  );
  return context ? session : null;
}

function parseBooleanParam(value: string | null) {
  return value === "1" || value === "true";
}

function clampListNumber(
  value: string | null,
  fallback: number,
  min = 0,
  max = 100,
) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}

export async function readPartnerReviewSubmission(request: Request): Promise<
  | { ok: true; values: ParsedReviewSubmission }
  | {
      ok: false;
      status: 400 | 413;
      message?: string;
      fieldErrors?: ReviewFieldErrors;
    }
> {
  let body: unknown;
  try {
    body = await readRouteJsonBodyWithinLimit<unknown>(request, {
      maximumBytes: MAX_EXTENDED_JSON_BODY_BYTES,
      invalidMessage: INVALID_REVIEW_BODY_MESSAGE,
      tooLargeMessage: OVERSIZED_REVIEW_BODY_MESSAGE,
    });
  } catch (error) {
    if (error instanceof RouteJsonBodyError) {
      return { ok: false, status: error.status, message: error.message };
    }
    throw error;
  }

  const parsed = parseReviewSubmissionRequest(body);
  if (parsed.ok) {
    return parsed;
  }
  if (parsed.reason === "invalid_fields") {
    return { ok: false, status: 400, fieldErrors: parsed.fieldErrors };
  }
  return {
    ok: false,
    status: 400,
    message: INVALID_REVIEW_BODY_MESSAGE,
  };
}

export async function resolveReviewMediaPayload(
  manifest: ReviewMediaManifest,
  partnerId: string,
  reviewId: string,
  memberId: string,
  allowedExistingUrls: readonly string[] = [],
) {
  const entries = manifest.images;
  try {
    assertReviewMediaExistingUrls(manifest, allowedExistingUrls);
  } catch {
    throw new ReviewMediaInputError();
  }
  if (entries.length > 5) {
    throw new ReviewMediaInputError(
      "리뷰 사진은 최대 5장까지 업로드할 수 있습니다.",
    );
  }

  const images: string[] = [];
  const uploadedUrls: string[] = [];
  const uploadRepository = getImageUploadRepository();
  const attachUpload = async (uploadId: string, imageIndex: number) => {
    const attached = await uploadRepository.attach({
      actor: { kind: "member", id: memberId },
      purpose: "review",
      uploadId,
      role: "image",
      policy: resolveImageTransformPolicy("review", "image"),
      destination: {
        bucket: REVIEW_MEDIA_BUCKET,
        path: buildReviewMediaStoragePath(partnerId, reviewId, imageIndex, uploadId),
        isPublic: true,
      },
      resource: { type: "partner_review", id: reviewId },
    });
    if (!attached.url) {
      throw new Error("리뷰 사진 URL을 만들지 못했습니다.");
    }
    return attached.url;
  };

  try {
    for (const entry of entries) {
      if (entry.kind === "existing") {
        images.push(entry.url);
        continue;
      }
      if (!entry.uploadId) {
        throw new ReviewMediaInputError(
          "완료된 공통 이미지 업로드를 확인해 주세요.",
        );
      }
      const uploadedUrl = await attachUpload(entry.uploadId, images.length);
      images.push(uploadedUrl);
      uploadedUrls.push(uploadedUrl);
    }
  } catch (error) {
    await deleteReviewMediaUrls(uploadedUrls).catch(() => undefined);
    throw error;
  }

  return {
    images,
    uploadedUrls,
  };
}
