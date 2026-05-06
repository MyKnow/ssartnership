import {
  normalizePartnerReviewRatingFilter,
  normalizePartnerReviewSort,
} from "@/lib/partner-reviews";
import { getPartnerChangeRequestContext } from "@/lib/partner-change-requests";
import { getPartnerSession } from "@/lib/partner-session";
import { getPartnerViewerContext } from "@/lib/partner-view-context";
import { partnerRepository } from "@/lib/repositories";
import {
  extractReviewMediaStoragePath,
  parseReviewMediaManifest,
  REVIEW_MEDIA_BUCKET,
} from "@/lib/review-media";
import { deleteReviewMediaUrls, uploadReviewMediaFile } from "@/lib/review-media-storage";
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
  const fieldErrors = validateReviewDraftInput({
    ...normalized,
    imageCount: formData.getAll("imageFiles").filter((item) => item instanceof File).length,
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

export function parseDirectUploadedReviewUrls(
  formData: FormData,
  partnerId: string,
  reviewId: string,
) {
  const raw = String(formData.get("directUploadedImageUrls") ?? "").trim();
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const expectedPrefix = `reviews/${partnerId.trim()}/${reviewId.trim()}/`;
    return parsed.filter((item): item is string => {
      if (typeof item !== "string" || item.length === 0) {
        return false;
      }
      const storagePath = extractReviewMediaStoragePath(item);
      return (
        storagePath?.bucket === REVIEW_MEDIA_BUCKET &&
        storagePath.path.startsWith(expectedPrefix)
      );
    });
  } catch {
    return [];
  }
}

export async function resolveReviewMediaPayload(
  formData: FormData,
  partnerId: string,
  reviewId: string,
) {
  const manifestRaw = String(formData.get("imagesManifest") ?? "");
  const manifest = parseReviewMediaManifest(manifestRaw);
  const files = formData
    .getAll("imageFiles")
    .filter((item): item is File => item instanceof File && item.size > 0);

  if (manifestRaw.trim() && !manifest) {
    throw new Error("리뷰 사진 형식을 확인해 주세요.");
  }

  const entries = manifest?.images ?? [];
  if (entries.length > 5) {
    throw new Error("리뷰 사진은 최대 5장까지 업로드할 수 있습니다.");
  }

  const images: string[] = [];
  const uploadTasks: Array<{
    imageIndex: number;
    file: File;
  }> = [];
  let fileIndex = 0;

  for (const entry of entries) {
    if (entry.kind === "existing") {
      images.push(entry.url);
      continue;
    }

    const nextFile = files[fileIndex++];
    if (!nextFile) {
      throw new Error("리뷰 사진 파일을 찾을 수 없습니다.");
    }
    if (!nextFile.type.startsWith("image/")) {
      throw new Error("이미지 파일만 업로드할 수 있습니다.");
    }

    images.push("");
    uploadTasks.push({
      imageIndex: images.length - 1,
      file: nextFile,
    });
  }

  const uploadResults = await Promise.allSettled(
    uploadTasks.map((task) =>
      uploadReviewMediaFile(partnerId, reviewId, task.file, task.imageIndex),
    ),
  );
  const uploadedUrls = uploadResults.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
  const failedUpload = uploadResults.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );

  if (failedUpload) {
    await deleteReviewMediaUrls(uploadedUrls).catch(() => undefined);
    throw failedUpload.reason instanceof Error
      ? failedUpload.reason
      : new Error("리뷰 사진 업로드에 실패했습니다.");
  }

  for (const [index, task] of uploadTasks.entries()) {
    images[task.imageIndex] = uploadedUrls[index] ?? "";
  }

  return {
    images,
    uploadedUrls,
  };
}
