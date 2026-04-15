import { normalizePartnerAudience } from "../partner-audience.ts";
import { sanitizeHttpUrl } from "../validation.ts";
import type {
  PartnerAudienceKey,
} from "../partner-audience.ts";
import type { PartnerChangeRequestSummary } from "./shared.ts";

export function normalizeTextList(values?: string[] | null) {
  const seen = new Set<string>();
  const next: string[] = [];

  for (const value of values ?? []) {
    const normalized = String(value ?? "").trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    next.push(normalized);
  }

  return next;
}

export function normalizeOptionalText(value?: string | null) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

export function normalizeRequiredText(value?: string | null) {
  return String(value ?? "").trim();
}

export function normalizeHttpUrlList(
  values?: Array<string | null | undefined> | null,
) {
  const seen = new Set<string>();
  const next: string[] = [];

  for (const value of values ?? []) {
    const normalized = sanitizeHttpUrl(value ?? undefined);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    next.push(normalized);
  }

  return next;
}

export function arraysEqual(a: string[], b: string[]) {
  if (a.length !== b.length) {
    return false;
  }

  return a.every((value, index) => value === b[index]);
}

export function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value;
}

export function normalizeAudience(values?: string[] | null): PartnerAudienceKey[] {
  return normalizePartnerAudience(values);
}

export function collectPartnerMediaUrls(row?: {
  thumbnail?: string | null;
  images?: string[] | null;
} | null) {
  if (!row) {
    return [];
  }

  return normalizeHttpUrlList([row.thumbnail ?? null, ...(row.images ?? [])]);
}

export function collectPartnerMediaUrlsFromInput(input?: {
  thumbnail?: string | null;
  images?: string[] | null;
} | null) {
  if (!input) {
    return [];
  }

  return normalizeHttpUrlList([input.thumbnail ?? null, ...(input.images ?? [])]);
}

export function collectPartnerChangeRequestRequestedMediaUrls(
  request?: Pick<PartnerChangeRequestSummary, "requestedThumbnail" | "requestedImages"> | null,
) {
  if (!request) {
    return [];
  }

  return normalizeHttpUrlList([
    request.requestedThumbnail ?? null,
    ...(request.requestedImages ?? []),
  ]);
}
