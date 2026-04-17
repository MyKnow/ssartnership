import { normalizePartnerReviewSort } from "@/lib/partner-reviews";
import { partnerRepository } from "@/lib/repositories";
import { parseReviewMediaManifest } from "@/lib/review-media";
import { uploadReviewMediaFile } from "@/lib/review-media-storage";
import { getUserSession } from "@/lib/user-auth";

export type ReviewFieldErrors = Partial<Record<"rating" | "title" | "body" | "images", string>>;

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
  return { sort, offset, limit };
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
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const fieldErrors: ReviewFieldErrors = {};
  const rating = Number.parseInt(ratingRaw, 10);

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    fieldErrors.rating = "별점은 1점부터 5점까지 선택해 주세요.";
  }
  if (!title) {
    fieldErrors.title = "제목을 입력해 주세요.";
  } else if (title.length > 80) {
    fieldErrors.title = "제목은 80자 이내로 입력해 주세요.";
  }
  if (!body) {
    fieldErrors.body = "리뷰 내용을 입력해 주세요.";
  } else if (body.length < 10) {
    fieldErrors.body = "리뷰 내용은 10자 이상 입력해 주세요.";
  } else if (body.length > 2000) {
    fieldErrors.body = "리뷰 내용은 2000자 이내로 입력해 주세요.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      fieldErrors,
    };
  }

  return {
    ok: true,
    rating,
    title,
    body,
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
