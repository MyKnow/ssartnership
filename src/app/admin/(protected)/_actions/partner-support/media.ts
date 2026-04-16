import { parsePartnerMediaManifest } from "@/lib/partner-media";
import { uploadPartnerMediaFile } from "@/lib/partner-media-storage";
import type { PartnerMediaInput } from "../shared-types";

function getFormDataFile(formData: FormData, name: string) {
  const value = formData.get(name);
  return value instanceof File && value.size > 0 ? value : null;
}

export async function resolvePartnerMediaPayload(
  formData: FormData,
  partnerId: string,
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

  const thumbnailFile = getFormDataFile(formData, "thumbnailFile");
  const galleryFiles = formData
    .getAll("galleryFiles")
    .filter((item): item is File => item instanceof File && item.size > 0);

  let thumbnail: string | null = null;
  const uploadedUrls: string[] = [];
  if (thumbnailManifest?.thumbnail) {
    if (thumbnailManifest.thumbnail.kind === "existing") {
      thumbnail = thumbnailManifest.thumbnail.url;
    } else {
      if (!thumbnailFile) {
        throw new Error("썸네일 이미지를 찾을 수 없습니다.");
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
  const galleryEntries = galleryManifest?.gallery ?? [];
  for (const [index, entry] of galleryEntries.entries()) {
    if (entry.kind === "existing") {
      images.push(entry.url);
      continue;
    }

    const nextFile = galleryFiles[galleryFileIndex++];
    if (!nextFile) {
      throw new Error("추가 이미지 파일을 찾을 수 없습니다.");
    }
    if (!nextFile.type.startsWith("image/")) {
      throw new Error("이미지 파일만 저장할 수 있습니다.");
    }

    const uploadedUrl = await uploadPartnerMediaFile(
      partnerId,
      "gallery",
      nextFile,
      index,
    );
    images.push(uploadedUrl);
    uploadedUrls.push(uploadedUrl);
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
