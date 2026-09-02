export const IMAGE_FETCH_TIMEOUT_MS = 10_000;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export const PUBLIC_RASTER_IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
] as const;

export function resolveAllowedImageContentType(
  value: string,
  allowedContentTypes?: readonly string[],
) {
  const normalized = value.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  if (!normalized.startsWith("image/")) {
    return null;
  }
  if (allowedContentTypes && !allowedContentTypes.includes(normalized)) {
    return null;
  }
  return normalized;
}

export class ImageProxyError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ImageProxyError";
    this.status = status;
  }
}
