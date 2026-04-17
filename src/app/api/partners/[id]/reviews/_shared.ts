import { normalizePartnerReviewSort } from "@/lib/partner-reviews";
import { partnerRepository } from "@/lib/repositories";
import { parseReviewMediaManifest } from "@/lib/review-media";
import { uploadReviewMediaFile } from "@/lib/review-media-storage";
import {
  normalizeReviewDraftInput,
  validateReviewDraftInput,
  type ReviewFieldErrors,
} from "@/lib/review-validation";
import { getUserSession } from "@/lib/user-auth";

export async function getReviewMemberSession() {
  return getUserSession();
}

export async function ensureVisibleReviewPartner(
  partnerId: string,
  currentUserId?: string | null,
) {
  return partnerRepository.getPartnerById(partnerId, {
    authenticated: Boolean(currentUserId),
  });
}

export function parseReviewListParams(request: Request) {
  const url = new URL(request.url);
  const sort = normalizePartnerReviewSort(url.searchParams.get("sort"));
  const offset = clampListNumber(url.searchParams.get("offset"), 0);
  const limit = clampListNumber(url.searchParams.get("limit"), 10, 1, 20);
  const imagesOnly = parseBooleanParam(url.searchParams.get("imagesOnly"));
  return { sort, offset, limit, imagesOnly };
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
  const uploadedUrls: string[] = [];
  let fileIndex = 0;

  for (const [index, entry] of entries.entries()) {
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

    const uploadedUrl = await uploadReviewMediaFile(partnerId, reviewId, nextFile, index);
    images.push(uploadedUrl);
    uploadedUrls.push(uploadedUrl);
  }

  return {
    images,
    uploadedUrls,
  };
}
