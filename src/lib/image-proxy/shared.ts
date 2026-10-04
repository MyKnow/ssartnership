export const IMAGE_FETCH_TIMEOUT_MS = 10_000;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/**
 * 익명 공개 이미지 프록시(`/api/image`)의 원격 fetch 한도.
 * IP 쿼터를 적용할 수 없는 내부 옵티마이저 호출도 이 한도로 요청당 비용이 바운드된다.
 * 업로드 원본 한도(5MB)보다 여유 있게 두되 서버 측 기본 한도보다 작게 유지한다.
 */
export const PUBLIC_IMAGE_PROXY_FETCH_LIMITS = {
  maxBytes: 8 * 1024 * 1024,
  timeoutMs: 8_000,
} as const;

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
