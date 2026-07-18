import {
  resolveImageUploadActorForServerAction,
} from "@/lib/image-upload/auth.server";
import {
  assertNoDirectImageFileSubmission,
  resolveImageTransformPolicy,
} from "@/lib/image-upload/policy";
import { getImageUploadRepository } from "@/lib/image-upload/repository.supabase";
import {
  assertPartnerMediaExistingUrls,
  PARTNER_MEDIA_BUCKET,
  parsePartnerMediaManifest,
} from "@/lib/partner-media";
import {
  buildPartnerMediaStoragePath,
} from "@/lib/partner-media-storage";
import type { PartnerMediaInput } from "../shared-types";

export async function resolvePartnerMediaPayload(
  formData: FormData,
  partnerId: string,
  allowedExistingUrls: readonly string[] = [],
): Promise<PartnerMediaInput> {
  const thumbnailManifestRaw = String(formData.get("thumbnailManifest") || "");
  const galleryManifestRaw = String(formData.get("galleryManifest") || "");
  const thumbnailManifest = parsePartnerMediaManifest(thumbnailManifestRaw);
  const galleryManifest = parsePartnerMediaManifest(galleryManifestRaw);

  if (thumbnailManifestRaw.trim() && !thumbnailManifest) {
    throw new Error("썸네일 이미지 형식을 확인해 주세요.");
  }
  if (galleryManifestRaw.trim() && !galleryManifest) {
    throw new Error("이미지 목록 형식을 확인해 주세요.");
  }
  assertNoDirectImageFileSubmission(formData, ["thumbnailFile", "galleryFiles"]);
  assertPartnerMediaExistingUrls(thumbnailManifest, allowedExistingUrls);
  assertPartnerMediaExistingUrls(galleryManifest, allowedExistingUrls);

  let thumbnail: string | null = null;
  const uploadedUrls: string[] = [];
  const uploadActor = await resolveImageUploadActorForServerAction("partner", "admin");
  const uploadRepository = getImageUploadRepository();

  const attachUpload = async (
    uploadId: string,
    role: "thumbnail" | "gallery",
    index: number,
  ) => {
    const attached = await uploadRepository.attach({
      actor: uploadActor,
      purpose: "partner",
      uploadId,
      role,
      policy: resolveImageTransformPolicy("partner", role),
      destination: {
        bucket: PARTNER_MEDIA_BUCKET,
        path: buildPartnerMediaStoragePath(partnerId, role, index, uploadId),
        isPublic: true,
      },
      resource: { type: "partner", id: partnerId },
    });
    if (!attached.url) {
      throw new Error("제휴처 이미지 URL을 만들지 못했습니다.");
    }
    return attached.url;
  };

  if (thumbnailManifest?.thumbnail) {
    if (thumbnailManifest.thumbnail.kind === "existing") {
      thumbnail = thumbnailManifest.thumbnail.url;
    } else {
      if (!thumbnailManifest.thumbnail.uploadId) {
        throw new Error("완료된 공통 이미지 업로드를 확인해 주세요.");
      }
      thumbnail = await attachUpload(thumbnailManifest.thumbnail.uploadId, "thumbnail", 0);
    }
  }

  const images: string[] = [];
  const galleryEntries = galleryManifest?.gallery ?? [];
  for (const [index, entry] of galleryEntries.entries()) {
    if (entry.kind === "existing") {
      images.push(entry.url);
      continue;
    }
    if (!entry.uploadId) {
      throw new Error("완료된 공통 이미지 업로드를 확인해 주세요.");
    }
    images.push(await attachUpload(entry.uploadId, "gallery", index));
  }

  return {
    thumbnail,
    images,
    uploadedUrls,
  };
}

export function collectPartnerMediaUrls(
  row?: {
    thumbnail?: string | null;
    images?: string[] | null;
  } | null,
) {
  if (!row) {
    return [];
  }

  const urls = [row.thumbnail ?? null, ...(row.images ?? [])].filter(
    (item): item is string => Boolean(item),
  );

  return Array.from(new Set(urls));
}
