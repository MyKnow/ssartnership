import { sanitizeHttpUrl } from "@/lib/validation";

export const PARTNER_MEDIA_BUCKET = "partner-media";
export const PARTNER_THUMBNAIL_ASPECT_RATIO = 1;
export const PARTNER_GALLERY_ASPECT_RATIO = 4 / 3;

export type PartnerMediaManifestEntry =
  | {
      kind: "existing";
      url: string;
    }
  | {
      kind: "upload";
    };

export type PartnerMediaManifest = {
  thumbnail: PartnerMediaManifestEntry | null;
  gallery: PartnerMediaManifestEntry[];
};

export function parsePartnerMediaManifest(
  raw: string | null | undefined,
): PartnerMediaManifest | null {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const record = parsed as {
    thumbnail?: unknown;
    gallery?: unknown;
  };

  const thumbnail = parsePartnerMediaManifestEntry(record.thumbnail);
  const gallery = parsePartnerMediaManifestEntries(record.gallery);
  if (!thumbnail && record.thumbnail !== null && record.thumbnail !== undefined) {
    return null;
  }
  if (!gallery) {
    return null;
  }

  return {
    thumbnail,
    gallery,
  };
}

function parsePartnerMediaManifestEntry(
  value: unknown,
): PartnerMediaManifestEntry | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (!value || typeof value !== "object") {
    return null;
  }

  const entry = value as {
    kind?: unknown;
    url?: unknown;
  };

  if (entry.kind === "upload") {
    return { kind: "upload" };
  }

  if (entry.kind === "existing") {
    const safeUrl = sanitizeHttpUrl(
      typeof entry.url === "string" ? entry.url : undefined,
    );
    if (!safeUrl) {
      return null;
    }
    return {
      kind: "existing",
      url: safeUrl,
    };
  }

  return null;
}

function parsePartnerMediaManifestEntries(
  value: unknown,
): PartnerMediaManifestEntry[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const entries = value.map((item) => parsePartnerMediaManifestEntry(item));
  if (entries.some((item) => item === null)) {
    return null;
  }
  return entries as PartnerMediaManifestEntry[];
}

export function buildPartnerMediaStoragePath(
  partnerId: string,
  role: "thumbnail" | "gallery",
  index: number,
  extension = "webp",
) {
  const safePartnerId = partnerId.trim();
  const safeRole = role === "thumbnail" ? "thumbnail" : "gallery";
  const suffix = `${Date.now().toString(36)}-${cryptoRandomId()}`;
  return `partners/${safePartnerId}/${safeRole}/${index}-${suffix}.${extension}`;
}

export function extractPartnerMediaStoragePath(url: string) {
  const safeUrl = sanitizeHttpUrl(url);
  if (!safeUrl) {
    return null;
  }

  try {
    const parsed = new URL(safeUrl);
    const marker = "/storage/v1/object/public/";
    const index = parsed.pathname.indexOf(marker);
    if (index < 0) {
      return null;
    }
    const remainder = parsed.pathname.slice(index + marker.length);
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

function cryptoRandomId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
