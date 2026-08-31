import { sanitizeHttpUrl } from "@/lib/validation";

const PUBLIC_STORAGE_OBJECT_MARKER = "/storage/v1/object/public/";

export type PublicStorageObjectPath = {
  bucket: string;
  path: string;
};

export function extractPublicStorageObjectPath(
  url: string,
): PublicStorageObjectPath | null {
  const safeUrl = sanitizeHttpUrl(url);
  if (!safeUrl) {
    return null;
  }

  try {
    const parsed = new URL(safeUrl);
    const markerIndex = parsed.pathname.indexOf(PUBLIC_STORAGE_OBJECT_MARKER);
    if (markerIndex < 0) {
      return null;
    }
    const remainder = parsed.pathname.slice(
      markerIndex + PUBLIC_STORAGE_OBJECT_MARKER.length,
    );
    const slashIndex = remainder.indexOf("/");
    if (slashIndex < 0) {
      return null;
    }
    const bucket = remainder.slice(0, slashIndex);
    const path = remainder.slice(slashIndex + 1);
    if (!bucket || !path) {
      return null;
    }
    return {
      bucket,
      path: decodeURIComponent(path),
    };
  } catch {
    return null;
  }
}
