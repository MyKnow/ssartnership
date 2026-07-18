"use client";

import {
  getGraduateProfileHeifSpatialExtentError,
  getGraduateProfilePhotoPixelError,
} from "@/lib/graduate-profile-photo.client";
import {
  validateImageUploadSource,
  type ImageTransformPolicy,
} from "@/lib/image-upload/policy";

function isHeifSource(file: Pick<File, "name" | "type">) {
  const type = file.type.trim().toLowerCase();
  return type === "image/heic"
    || type === "image/heif"
    || type === "image/heic-sequence"
    || type === "image/heif-sequence"
    || /\.hei[cf]$/i.test(file.name);
}

function isSvgSource(file: Pick<File, "name" | "type">) {
  return file.type.trim().toLowerCase() === "image/svg+xml" || /\.svg$/i.test(file.name);
}

async function assertSafeClientSvg(file: File) {
  const svg = await file.text();
  if (!/^\s*(?:<\?xml[^>]*>\s*)?<svg\b/i.test(svg)) {
    throw new Error("SVG 이미지 형식을 확인해 주세요.");
  }
  if (
    /<\s*(?:script|foreignObject|iframe|object|embed)\b/i.test(svg)
    || /\son[a-z]+\s*=/i.test(svg)
    || /<!\s*(?:doctype|entity)\b/i.test(svg)
    || /\b(?:href|xlink:href)\s*=\s*(?:["']?\s*)?(?!#)[^\s>]+/i.test(svg)
    || /\burl\(\s*(?:["']?\s*)?(?!#)[^)]+\)/i.test(svg)
  ) {
    throw new Error("SVG는 외부 리소스나 실행 가능한 요소를 포함할 수 없습니다.");
  }
}

function createWebpFile(blob: Blob, source: File) {
  const baseName = source.name.replace(/\.[^.]+$/u, "") || "image";
  return new File([blob], `${baseName}.webp`, {
    type: "image/webp",
    lastModified: Date.now(),
  });
}

export function shouldUseServerImageTransformFallback(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return !/^(사진 해상도는|이미지 해상도가|이미지 데이터를|HEIC\/HEIF 사진의 해상도)/u.test(message);
}

export function getImageUploadSourceError(
  file: Pick<File, "name" | "size" | "type">,
  policy: Pick<ImageTransformPolicy, "maxSourceBytes">,
) {
  return validateImageUploadSource(file, policy);
}

async function decodeHeifToWebp(file: File, policy: ImageTransformPolicy) {
  const source = await file.arrayBuffer();
  const spatialExtentError = getGraduateProfileHeifSpatialExtentError(source);
  if (spatialExtentError) {
    throw new Error(spatialExtentError);
  }

  const { decode } = await import("@discourse/heic");
  const imageData = await decode(source);
  const pixelError = getGraduateProfilePhotoPixelError(imageData.width, imageData.height);
  if (pixelError || imageData.width * imageData.height > policy.maxInputPixels) {
    throw new Error(pixelError ?? "이미지 해상도가 너무 큽니다.");
  }
  if (imageData.data.byteLength !== imageData.width * imageData.height * 4) {
    throw new Error("이미지 데이터를 안전하게 읽지 못했습니다.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("HEIC/HEIF 사진 변환을 시작할 수 없습니다.");
  }
  context.putImageData(imageData, 0, 0);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (nextBlob) => {
        if (!nextBlob) {
          reject(new Error("HEIC/HEIF 사진 변환에 실패했습니다."));
          return;
        }
        resolve(nextBlob);
      },
      "image/webp",
      policy.quality / 100,
    );
  });
  return createWebpFile(blob, file);
}

/**
 * Uses one input rule for every crop dialog. HEIC/HEIF is locally decoded so
 * the browser cropper can render it; all other formats are sent through to
 * the cropper and are re-verified by the server after upload.
 */
export async function prepareImageUploadSource(
  file: File,
  policy: ImageTransformPolicy,
) {
  const sourceError = getImageUploadSourceError(file, policy);
  if (sourceError) {
    throw new Error(sourceError);
  }
  if (isSvgSource(file)) {
    await assertSafeClientSvg(file);
  }
  if (!isHeifSource(file)) {
    return file;
  }
  if (typeof document === "undefined") {
    throw new Error("HEIC/HEIF 사진은 브라우저에서만 변환할 수 있습니다.");
  }
  try {
    return await decodeHeifToWebp(file, policy);
  } catch (error) {
    if (!shouldUseServerImageTransformFallback(error)) {
      throw error;
    }
    // Some browser/decoder combinations cannot render HEIC/HEIF. Preserve
    // the original only for private staging; the server revalidates and
    // converts it before it can be attached to any business record.
    return file;
  }
}
