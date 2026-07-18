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
  parseReviewMediaManifest,
  REVIEW_MEDIA_BUCKET,
} from "@/lib/review-media";
import {
  buildReviewMediaStoragePath,
} from "@/lib/review-media-storage";
import {
  assertNoDirectImageFileSubmission,
  resolveImageTransformPolicy,
} from "@/lib/image-upload/policy";
import { getImageUploadRepository } from "@/lib/image-upload/repository.supabase";
import {
  normalizeReviewDraftInput,
  validateReviewDraftInput,
  type ReviewFieldErrors,
} from "@/lib/review-validation";
import { getUserSession } from "@/lib/user-auth";

const REVIEW_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

export function parseReviewFormFields(formData: FormData):
  | {
      ok: true;
      rating: number;
      title: string;
      body: string;
    }
  | {
      ok: false;
      fieldErrors: ReviewFieldErrors;
    } {
  const ratingRaw = String(formData.get("rating") ?? "").trim();
  const rating = Number.parseInt(ratingRaw, 10);
  const normalized = normalizeReviewDraftInput({
    rating,
    title: String(formData.get("title") ?? ""),
    body: String(formData.get("body") ?? ""),
  });
  const manifest = parseReviewMediaManifest(String(formData.get("imagesManifest") ?? ""));
  const fieldErrors = validateReviewDraftInput({
    ...normalized,
    imageCount: manifest?.images.length ?? 0,
  });

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      fieldErrors,
    };
  }

  return {
    ok: true,
    rating: normalized.rating,
    title: normalized.title,
    body: normalized.body,
  };
}

export function parseRequestedReviewId(formData: FormData) {
  const raw = String(formData.get("reviewId") ?? "").trim();
  return REVIEW_ID_PATTERN.test(raw) ? raw : null;
}

export async function resolveReviewMediaPayload(
  formData: FormData,
  partnerId: string,
  reviewId: string,
  memberId: string,
  allowedExistingUrls: readonly string[] = [],
) {
  const manifestRaw = String(formData.get("imagesManifest") ?? "");
  const manifest = parseReviewMediaManifest(manifestRaw);

  if (manifestRaw.trim() && !manifest) {
    throw new Error("리뷰 사진 형식을 확인해 주세요.");
  }
  assertNoDirectImageFileSubmission(formData, ["imageFiles"]);

  const entries = manifest?.images ?? [];
  assertReviewMediaExistingUrls(manifest, allowedExistingUrls);
  if (entries.length > 5) {
    throw new Error("리뷰 사진은 최대 5장까지 업로드할 수 있습니다.");
  }

  const images: string[] = [];
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

  for (const entry of entries) {
    if (entry.kind === "existing") {
      images.push(entry.url);
      continue;
    }
    if (!entry.uploadId) {
      throw new Error("완료된 공통 이미지 업로드를 확인해 주세요.");
    }
    images.push(await attachUpload(entry.uploadId, images.length));
  }

  return {
    images,
    uploadedUrls: [],
  };
}
