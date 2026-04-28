import type {
  PartnerReview,
} from "@/lib/partner-reviews";
export {
  getPartnerReviewRatingLabel,
  getPartnerReviewRatingOptions,
} from "@/lib/partner-reviews";
import {
  buildReviewMediaManifestEntries,
  collectReviewMediaFiles,
  createReviewImageItemFromExisting,
  type ReviewImageItem,
} from "@/components/review-media/shared";
import { formatKoreanDate } from "@/lib/datetime";

const REVIEW_MEDIA_CACHE_CONTROL_SECONDS = "31536000";

type SignedReviewUpload = {
  clientId: string;
  signedUrl: string;
  publicUrl: string;
};

type SignedReviewUploadHeaders = {
  apikey?: string;
  Authorization?: string;
};

export function formatPartnerReviewDate(value: string) {
  try {
    return formatKoreanDate(value);
  } catch {
    return value;
  }
}

export function buildReviewFormData(input: {
  reviewId: string;
  rating: number;
  title: string;
  body: string;
  items: ReviewImageItem[];
  directUploadedImageUrls?: string[];
}) {
  const formData = new FormData();
  formData.set("reviewId", input.reviewId);
  formData.set("rating", String(input.rating));
  formData.set("title", input.title);
  formData.set("body", input.body);
  formData.set(
    "imagesManifest",
    JSON.stringify({
      images: buildReviewMediaManifestEntries(input.items),
    }),
  );
  for (const file of collectReviewMediaFiles(input.items)) {
    formData.append("imageFiles", file);
  }
  formData.set(
    "directUploadedImageUrls",
    JSON.stringify(input.directUploadedImageUrls ?? []),
  );
  return formData;
}

export async function uploadReviewImagesDirectly(input: {
  partnerId: string;
  reviewId: string;
  items: ReviewImageItem[];
}) {
  const fileItems = input.items.filter((item) => item.kind === "file");
  if (fileItems.length === 0) {
    return {
      items: input.items,
      uploadedUrls: [],
    };
  }

  const signResponse = await fetch(
    `/api/partners/${encodeURIComponent(input.partnerId)}/reviews/uploads/sign`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reviewId: input.reviewId,
        files: fileItems.map((item) => ({
          clientId: item.id,
          type: item.file.type || "image/webp",
          size: item.file.size,
        })),
      }),
    },
  );
  const signData = await signResponse.json().catch(() => ({}));
  if (!signResponse.ok) {
    throw new Error(signData.message ?? "리뷰 사진 업로드 URL 발급에 실패했습니다.");
  }
  const uploadHeaders = (signData.uploadHeaders ?? {}) as SignedReviewUploadHeaders;

  const uploads = new Map<string, SignedReviewUpload>(
    ((signData.uploads ?? []) as SignedReviewUpload[]).map((upload) => [
      upload.clientId,
      upload,
    ]),
  );
  const uploadResults = await Promise.allSettled(
    fileItems.map(async (item) => {
      const upload = uploads.get(item.id);
      if (!upload) {
        throw new Error("리뷰 사진 업로드 정보를 찾을 수 없습니다.");
      }

      const body = new FormData();
      body.append("cacheControl", REVIEW_MEDIA_CACHE_CONTROL_SECONDS);
      body.append("", item.file);
      const uploadResponse = await fetch(upload.signedUrl, {
        method: "PUT",
        headers: {
          ...uploadHeaders,
          "x-upsert": "false",
        },
        body,
      });
      if (!uploadResponse.ok) {
        throw new Error("리뷰 사진 업로드에 실패했습니다.");
      }

      return {
        clientId: item.id,
        publicUrl: upload.publicUrl,
      };
    }),
  );
  const uploaded = uploadResults.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
  const failedUpload = uploadResults.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (failedUpload) {
    await cleanupDirectUploadedReviewImages({
      partnerId: input.partnerId,
      reviewId: input.reviewId,
      urls: uploaded.map((item) => item.publicUrl),
    });
    throw failedUpload.reason instanceof Error
      ? failedUpload.reason
      : new Error("리뷰 사진 업로드에 실패했습니다.");
  }
  const publicUrlsByClientId = new Map(
    uploaded.map((item) => [item.clientId, item.publicUrl]),
  );

  return {
    items: input.items.map((item) => {
      if (item.kind === "existing") {
        return item;
      }
      const publicUrl = publicUrlsByClientId.get(item.id);
      return publicUrl ? createReviewImageItemFromExisting(publicUrl) : item;
    }),
    uploadedUrls: uploaded.map((item) => item.publicUrl),
  };
}

async function cleanupDirectUploadedReviewImages(input: {
  partnerId: string;
  reviewId: string;
  urls: string[];
}) {
  if (input.urls.length === 0) {
    return;
  }

  await fetch(
    `/api/partners/${encodeURIComponent(input.partnerId)}/reviews/uploads/cleanup`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reviewId: input.reviewId,
        urls: input.urls,
      }),
    },
  ).catch(() => undefined);
}

export function appendPartnerReviewList(
  current: PartnerReview[],
  next: PartnerReview[],
) {
  const seen = new Set<string>();
  return [...current, ...next].filter((review) => {
    if (seen.has(review.id)) {
      return false;
    }
    seen.add(review.id);
    return true;
  });
}
