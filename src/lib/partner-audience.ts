export const PARTNER_AUDIENCE_OPTIONS = [
  { value: "staff", label: "운영진" },
  { value: "student", label: "교육생" },
  { value: "graduate", label: "수료생" },
] as const;

export const PARTNER_AUDIENCE_FILTER_OPTIONS = [
  { value: "all", label: "전체" },
  ...PARTNER_AUDIENCE_OPTIONS,
] as const;

export type PartnerAudienceKey =
  (typeof PARTNER_AUDIENCE_OPTIONS)[number]["value"];

export type PartnerAudienceFilter = PartnerAudienceKey | "all";

const PARTNER_AUDIENCE_ORDER: PartnerAudienceKey[] = [
  "staff",
  "student",
  "graduate",
];

const PARTNER_AUDIENCE_LABEL_MAP: Record<PartnerAudienceKey, string> = {
  staff: "운영진",
  student: "교육생",
  graduate: "수료생",
};

export const DEFAULT_PARTNER_AUDIENCE = [...PARTNER_AUDIENCE_ORDER];

export function isPartnerAudienceKey(
  value: string,
): value is PartnerAudienceKey {
  return PARTNER_AUDIENCE_ORDER.includes(value as PartnerAudienceKey);
}

export function normalizePartnerAudience(
  value?: Array<string | null | undefined> | null,
) {
  const selected = new Set<PartnerAudienceKey>();

  for (const item of value ?? []) {
    if (typeof item !== "string") {
      continue;
    }
    const normalized = item.trim();
    if (isPartnerAudienceKey(normalized)) {
      selected.add(normalized);
    }
  }

  if (selected.size === 0) {
    return [...DEFAULT_PARTNER_AUDIENCE];
  }

  return PARTNER_AUDIENCE_ORDER.filter((item) => selected.has(item));
}

export function parsePartnerAudienceSelection(
  value: Array<string | null | undefined>,
) {
  if (value.length === 0) {
    return null;
  }

  const selected = new Set<PartnerAudienceKey>();
  for (const item of value) {
    if (typeof item !== "string") {
      return null;
    }
    const normalized = item.trim();
    if (!isPartnerAudienceKey(normalized)) {
      return null;
    }
    selected.add(normalized);
  }

  if (selected.size === 0) {
    return null;
  }

  return PARTNER_AUDIENCE_ORDER.filter((item) => selected.has(item));
}

export function isFullPartnerAudience(value: PartnerAudienceKey[]) {
  return value.length === PARTNER_AUDIENCE_ORDER.length;
}

export function getPartnerAudienceLabel(value: PartnerAudienceKey) {
  return PARTNER_AUDIENCE_LABEL_MAP[value];
}

