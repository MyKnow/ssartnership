import { NextResponse } from "next/server";
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
import { getImageUploadRepository } from "@/lib/image-upload/repository.server";
import { ImageUploadError } from "@/lib/image-upload/repository";
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
import { getUserSession, isUserSessionLookupUnavailable } from "@/lib/user-auth";
import { lookupMemberSession } from "@/lib/member-session-lookup";
import { logServerError } from "@/lib/server-log";

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

export function isReviewImageUploadUnavailable(error: unknown) {
  return error instanceof ImageUploadError
    && error.code === "image_upload_unavailable";
}

export async function getReviewMemberSession() {
  return getUserSession();
}

export const REVIEW_SESSION_UNAVAILABLE_MESSAGE =
  "로그인 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.";

type ReviewMemberSession = Awaited<ReturnType<typeof getReviewMemberSession>>;

/**
 * Distinguishes "not signed in" from "session lookup failed". A failed member
 * lookup (which the session helper reports as an empty session) or a failed
 * policy read must not look like a logged-out member (401); callers answer
 * 503 for writes or degrade a public read to anonymous.
 */
export async function getReviewMemberSessionLookup(): Promise<
  { ok: true; session: ReviewMemberSession } | { ok: false }
> {
  return lookupMemberSession(
    "[partner-review] member session lookup failed",
    getReviewMemberSession,
    isUserSessionLookupUnavailable,
  );
}

export function reviewSessionUnavailableResponse() {
  return NextResponse.json(
    { ok: false, message: REVIEW_SESSION_UNAVAILABLE_MESSAGE },
    { status: 503, headers: { "Retry-After": "30", "Cache-Control": "no-store" } },
  );
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

export async function ensurePartnerReviewModerationAccess(
  partnerId: string,
): Promise<"allowed" | "denied" | "unavailable"> {
  let session: Awaited<ReturnType<typeof getPartnerSession>>;
  try {
    session = await getPartnerSession();
  } catch (error) {
    logServerError("[partner-review] partner session lookup failed", error);
    return "unavailable";
  }
  if (!session || session.mustChangePassword) {
    return "denied";
  }
  try {
    const context = await getPartnerChangeRequestContext(session.companyIds, partnerId);
    return context ? "allowed" : "denied";
  } catch (error) {
    logServerError("[partner-review] partner moderation scope lookup failed", error);
    return "unavailable";
  }
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

export type ResolveReviewMediaOptions = {
  /**
   * Receives each URL as soon as this call attaches it. Passing it hands
   * failure cleanup to the caller: the helper then leaves partial attachments
   * in place. Review creation needs this because a duplicate request with the
   * same reviewId attaches to the same deterministic paths, so deleting before
   * checking for an already stored review could remove the winner's images.
   * Pass an empty array.
   */
  attachedUrls?: string[];
};

export async function resolveReviewMediaPayload(
  manifest: ReviewMediaManifest,
  partnerId: string,
  reviewId: string,
  memberId: string,
  allowedExistingUrls: readonly string[] = [],
  options: ResolveReviewMediaOptions = {},
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
  const callerOwnsCleanup = options.attachedUrls !== undefined;
  const uploadedUrls: string[] = options.attachedUrls ?? [];
  const attachUpload = async (uploadId: string, imageIndex: number) => {
    const attached = await getImageUploadRepository().attach({
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
    if (!callerOwnsCleanup) {
      await deleteReviewMediaUrls(uploadedUrls).catch(() => undefined);
    }
    throw error;
  }

  return {
    images,
    uploadedUrls,
  };
}
