const PROXY_PREFIX = "/api/image?url=";

export function getCachedImageUrl(src?: string | null) {
  if (!src) {
    return "";
  }
  if (src.startsWith(PROXY_PREFIX) || src.startsWith("data:")) {
    return src;
  }
  return `${PROXY_PREFIX}${encodeURIComponent(src)}`;
}
