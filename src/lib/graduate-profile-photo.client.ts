"use client";

import {
  MAX_GRADUATE_PROFILE_IMAGE_BYTES,
  MAX_GRADUATE_PROFILE_IMAGE_PIXELS,
} from "@/lib/graduate-verification";

export const GRADUATE_PROFILE_PHOTO_ACCEPT = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".heif",
].join(",");

export type GraduateProfilePhotoSourceFormat = "jpeg" | "png" | "webp" | "heif";

type PhotoSource = Pick<File, "name" | "size" | "type">;

const SOURCE_FORMAT_BY_CONTENT_TYPE: Record<string, GraduateProfilePhotoSourceFormat> = {
  "image/jpeg": "jpeg",
  "image/jpg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heif",
  "image/heif": "heif",
};

const SOURCE_FORMAT_BY_EXTENSION: Record<string, GraduateProfilePhotoSourceFormat> = {
  jpg: "jpeg",
  jpeg: "jpeg",
  png: "png",
  webp: "webp",
  heic: "heif",
  heif: "heif",
};

const HEIF_SPATIAL_EXTENT_ERROR =
  "HEIC/HEIF 사진의 해상도를 확인하지 못했습니다. 다른 사진을 선택해 주세요.";
const MAX_HEIF_BOXES = 2_048;
const MAX_HEIF_BOX_DEPTH = 8;

type HeifBoxScope = "root" | "meta" | "iprp" | "ipco";

type HeifBox = {
  end: number;
  payloadStart: number;
  type: string;
};

function getFileExtension(name: string) {
  const normalized = name.trim().toLowerCase();
  const dotIndex = normalized.lastIndexOf(".");
  return dotIndex > 0 && dotIndex < normalized.length - 1
    ? normalized.slice(dotIndex + 1)
    : null;
}

function getContentTypeFormat(type: string) {
  return SOURCE_FORMAT_BY_CONTENT_TYPE[type.trim().toLowerCase()] ?? null;
}

function getExtensionFormat(name: string) {
  const extension = getFileExtension(name);
  return extension ? SOURCE_FORMAT_BY_EXTENSION[extension] ?? null : null;
}

function isEmptyOrGenericBinaryContentType(type: string) {
  const normalized = type.trim().toLowerCase();
  return normalized === "" || normalized === "application/octet-stream";
}

export function getGraduateProfilePhotoSourceFormat(
  source: Pick<PhotoSource, "name" | "type">,
): GraduateProfilePhotoSourceFormat | null {
  const contentTypeFormat = getContentTypeFormat(source.type);
  const extension = getFileExtension(source.name);
  const extensionFormat = getExtensionFormat(source.name);

  if (!isEmptyOrGenericBinaryContentType(source.type) && !contentTypeFormat) {
    return null;
  }
  if (extension && !extensionFormat) {
    return null;
  }
  if (contentTypeFormat && extensionFormat && contentTypeFormat !== extensionFormat) {
    return null;
  }
  return contentTypeFormat ?? extensionFormat;
}

export function getGraduateProfilePhotoPixelError(width: number, height: number) {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    width * height > MAX_GRADUATE_PROFILE_IMAGE_PIXELS
  ) {
    return "사진 해상도는 최대 2,500만 픽셀까지 선택할 수 있습니다.";
  }
  return null;
}

function getHeifBox(view: DataView, offset: number, parentEnd: number): HeifBox | null {
  if (offset + 8 > parentEnd) {
    return null;
  }

  const size32 = view.getUint32(offset);
  const type = String.fromCharCode(
    view.getUint8(offset + 4),
    view.getUint8(offset + 5),
    view.getUint8(offset + 6),
    view.getUint8(offset + 7),
  );
  let payloadStart = offset + 8;
  let size = size32;

  if (size32 === 1) {
    if (offset + 16 > parentEnd) {
      return null;
    }
    const high = view.getUint32(offset + 8);
    const low = view.getUint32(offset + 12);
    size = high * 4_294_967_296 + low;
    payloadStart = offset + 16;
  } else if (size32 === 0) {
    size = parentEnd - offset;
  }

  if (!Number.isSafeInteger(size) || size < payloadStart - offset || offset + size > parentEnd) {
    return null;
  }

  return {
    end: offset + size,
    payloadStart,
    type,
  };
}

/**
 * Reads HEIF `ispe` boxes before the decoder allocates an ImageData buffer.
 * Only the `meta > iprp > ipco` property path is traversed so payload bytes
 * cannot masquerade as a spatial-extent box.
 */
export function getGraduateProfileHeifSpatialExtentError(source: ArrayBuffer) {
  const view = new DataView(source);
  let boxCount = 0;
  let foundSpatialExtent = false;

  const inspectBoxes = (
    offset: number,
    end: number,
    depth: number,
    scope: HeifBoxScope,
  ): string | null => {
    if (depth > MAX_HEIF_BOX_DEPTH) {
      return HEIF_SPATIAL_EXTENT_ERROR;
    }

    let cursor = offset;
    while (cursor < end) {
      boxCount += 1;
      if (boxCount > MAX_HEIF_BOXES) {
        return HEIF_SPATIAL_EXTENT_ERROR;
      }

      const box = getHeifBox(view, cursor, end);
      if (!box) {
        return HEIF_SPATIAL_EXTENT_ERROR;
      }

      if (scope === "ipco" && box.type === "ispe") {
        if (box.payloadStart + 12 > box.end) {
          return HEIF_SPATIAL_EXTENT_ERROR;
        }
        foundSpatialExtent = true;
        const pixelError = getGraduateProfilePhotoPixelError(
          view.getUint32(box.payloadStart + 4),
          view.getUint32(box.payloadStart + 8),
        );
        if (pixelError) {
          return pixelError;
        }
      } else if (scope === "root" && box.type === "meta") {
        if (box.payloadStart + 4 > box.end) {
          return HEIF_SPATIAL_EXTENT_ERROR;
        }
        const error = inspectBoxes(box.payloadStart + 4, box.end, depth + 1, "meta");
        if (error) {
          return error;
        }
      } else if (scope === "meta" && box.type === "iprp") {
        const error = inspectBoxes(box.payloadStart, box.end, depth + 1, "iprp");
        if (error) {
          return error;
        }
      } else if (scope === "iprp" && box.type === "ipco") {
        const error = inspectBoxes(box.payloadStart, box.end, depth + 1, "ipco");
        if (error) {
          return error;
        }
      }

      cursor = box.end;
    }

    return cursor === end ? null : HEIF_SPATIAL_EXTENT_ERROR;
  };

  const error = inspectBoxes(0, view.byteLength, 0, "root");
  return error ?? (foundSpatialExtent ? null : HEIF_SPATIAL_EXTENT_ERROR);
}

export function getGraduateProfilePhotoSourceError(source: PhotoSource) {
  if (!getGraduateProfilePhotoSourceFormat(source)) {
    return "본인 사진은 JPEG, PNG, WebP, HEIC, HEIF 파일만 선택할 수 있습니다.";
  }
  if (source.size <= 0 || source.size > MAX_GRADUATE_PROFILE_IMAGE_BYTES) {
    return "본인 사진은 5MB 이하만 선택할 수 있습니다.";
  }
  return null;
}

function createWebpFile(blob: Blob) {
  return new File([blob], "graduate-profile-source.webp", {
    type: "image/webp",
    lastModified: Date.now(),
  });
}

async function createWebpBlobFromHeif(file: File) {
  const source = await file.arrayBuffer();
  const spatialExtentError = getGraduateProfileHeifSpatialExtentError(source);
  if (spatialExtentError) {
    throw new Error(spatialExtentError);
  }
  const { decode } = await import("@discourse/heic");
  const imageData = await decode(source);
  const pixelError = getGraduateProfilePhotoPixelError(imageData.width, imageData.height);
  if (pixelError) {
    throw new Error(pixelError);
  }
  if (imageData.data.byteLength !== imageData.width * imageData.height * 4) {
    throw new Error("사진 데이터를 안전하게 읽지 못했습니다.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("사진 변환을 시작할 수 없습니다.");
  }
  context.putImageData(imageData, 0, 0);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("사진 변환에 실패했습니다."));
          return;
        }
        resolve(blob);
      },
      "image/webp",
      0.82,
    );
  });
}

/**
 * HEIC/HEIF never leaves the browser. It is decoded locally into a metadata-free
 * WebP before the existing crop and server-side image verification contract runs.
 */
export async function normalizeGraduateProfilePhotoSource(file: File) {
  const sourceError = getGraduateProfilePhotoSourceError(file);
  if (sourceError) {
    throw new Error(sourceError);
  }
  if (getGraduateProfilePhotoSourceFormat(file) !== "heif") {
    return file;
  }
  if (typeof document === "undefined") {
    throw new Error("HEIC/HEIF 사진은 브라우저에서만 변환할 수 있습니다.");
  }

  try {
    return createWebpFile(await createWebpBlobFromHeif(file));
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.startsWith("사진 해상도는") ||
        error.message === "사진 데이터를 안전하게 읽지 못했습니다." ||
        error.message === "사진 변환을 시작할 수 없습니다." ||
        error.message === "사진 변환에 실패했습니다.")
    ) {
      throw error;
    }
    throw new Error("HEIC/HEIF 사진을 안전하게 변환하지 못했습니다. JPEG로 변환한 뒤 다시 선택해 주세요.");
  }
}
