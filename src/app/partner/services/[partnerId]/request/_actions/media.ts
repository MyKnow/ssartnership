import { PartnerChangeRequestError } from "@/lib/partner-change-request-errors";
import { parsePartnerMediaManifest } from "@/lib/partner-media";
import {
  deletePartnerMediaUrls,
  uploadPartnerMediaFile,
} from "@/lib/partner-media-storage";
import { getFormDataFile } from "./shared";

export type PartnerRequestMediaPayload = {
  thumbnail: string | null;
  images: string[];
  uploadedUrls: string[];
};

export async function resolvePartnerMediaPayload(
  formData: FormData,
  partnerId: string,
): Promise<PartnerRequestMediaPayload> {
  const uploadedUrls: string[] = [];

  try {
    const thumbnailManifestRaw = String(formData.get("thumbnailManifest") || "");
    const galleryManifestRaw = String(formData.get("galleryManifest") || "");
    const thumbnailManifest = parsePartnerMediaManifest(thumbnailManifestRaw);
    const galleryManifest = parsePartnerMediaManifest(galleryManifestRaw);

    if (thumbnailManifestRaw.trim() && !thumbnailManifest) {
      throw new PartnerChangeRequestError(
        "invalid_request",
        "썸네일 이미지 형식을 확인해 주세요.",
      );
    }
    if (galleryManifestRaw.trim() && !galleryManifest) {
      throw new PartnerChangeRequestError(
        "invalid_request",
        "이미지 목록 형식을 확인해 주세요.",
      );
    }

    const thumbnailFile = getFormDataFile(formData, "thumbnailFile");
    const galleryFiles = formData
      .getAll("galleryFiles")
      .filter((item): item is File => item instanceof File && item.size > 0);

    let thumbnail: string | null = null;
    if (thumbnailManifest?.thumbnail) {
      if (thumbnailManifest.thumbnail.kind === "existing") {
        thumbnail = thumbnailManifest.thumbnail.url;
      } else {
        if (!thumbnailFile) {
          throw new PartnerChangeRequestError(
            "invalid_request",
            "썸네일 이미지를 찾을 수 없습니다.",
          );
        }
        thumbnail = await uploadPartnerMediaFile(
          partnerId,
          "thumbnail",
          thumbnailFile,
          0,
        );
        uploadedUrls.push(thumbnail);
      }
    }

    const images: string[] = [];
    let galleryFileIndex = 0;
    for (const [index, entry] of (galleryManifest?.gallery ?? []).entries()) {
      if (entry.kind === "existing") {
        images.push(entry.url);
        continue;
      }

      const file = galleryFiles[galleryFileIndex++];
      if (!file) {
        throw new PartnerChangeRequestError(
          "invalid_request",
          "추가 이미지를 찾을 수 없습니다.",
        );
      }

      const uploadedUrl = await uploadPartnerMediaFile(
        partnerId,
        "gallery",
        file,
        index,
      );
      images.push(uploadedUrl);
      uploadedUrls.push(uploadedUrl);
    }

    return { thumbnail, images, uploadedUrls };
  } catch (error) {
    await deletePartnerMediaUrls(uploadedUrls).catch(() => undefined);
    throw error;
  }
}
