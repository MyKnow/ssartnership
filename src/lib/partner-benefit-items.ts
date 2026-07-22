export const PARTNER_BENEFIT_MAX_APPLY_COUNT = 2_147_483_647;

export type PartnerBenefit = {
  id: string;
  title: string;
  maxApplyCount: number | null;
  displayOrder?: number;
};

export type PartnerBenefitDraft = {
  id?: string;
  title: string;
  maxApplyCount?: unknown;
  displayOrder?: number;
};

function parsePositiveInteger(value: unknown) {
  const normalized = typeof value === "number"
    ? value
    : typeof value === "string" && /^\d{1,10}$/.test(value.trim())
      ? Number(value.trim())
      : Number.NaN;

  return Number.isSafeInteger(normalized) && normalized >= 1 ? normalized : null;
}

export function normalizePartnerBenefitMaxApplyCount(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const normalized = parsePositiveInteger(value);
  if (normalized === null || normalized > PARTNER_BENEFIT_MAX_APPLY_COUNT) {
    return null;
  }
  return normalized;
}

export function getEffectivePartnerBenefitMaxApplyCount(
  value: number | null | undefined,
) {
  return value ?? 1;
}

export function normalizePartnerBenefitItems(
  value: unknown,
): PartnerBenefit[] {
  if (!Array.isArray(value)) {
    throw new Error("partner_benefit_invalid_items");
  }

  const titles = new Set<string>();
  const ids = new Set<string>();
  return value.map((raw, index) => {
    if (!raw || typeof raw !== "object") {
      throw new Error("partner_benefit_invalid_items");
    }
    const draft = raw as PartnerBenefitDraft;
    const title = typeof draft.title === "string" ? draft.title.trim() : "";
    if (!title || title.length > 500) {
      throw new Error("partner_benefit_invalid_title");
    }
    if (titles.has(title)) {
      throw new Error("partner_benefit_duplicate_title");
    }
    titles.add(title);
    const rawMax = draft.maxApplyCount;
    const maxApplyCount = normalizePartnerBenefitMaxApplyCount(rawMax);
    if (rawMax !== undefined && rawMax !== null && rawMax !== "" && maxApplyCount === null) {
      throw new Error("partner_benefit_invalid_max_apply_count");
    }
    const id = typeof draft.id === "string" && draft.id.trim()
      ? draft.id.trim()
      : `benefit-${index + 1}`;
    if (ids.has(id)) {
      throw new Error("partner_benefit_duplicate_id");
    }
    ids.add(id);
    return {
      id,
      title,
      maxApplyCount,
      displayOrder: index,
    };
  });
}

export function partnerBenefitItemsToTitles(items: readonly PartnerBenefit[]) {
  return items.map((item) => item.title);
}

export function findPartnerBenefitById(
  items: readonly PartnerBenefit[],
  id: unknown,
) {
  if (typeof id !== "string" || !id.trim()) {
    return null;
  }
  return items.find((item) => item.id === id.trim()) ?? null;
}

export function resolvePartnerBenefitById(
  items: readonly PartnerBenefit[],
  id: unknown,
  partnerId?: string,
) {
  const directMatch = findPartnerBenefitById(items, id);
  if (directMatch || typeof id !== "string" || !partnerId) {
    return directMatch;
  }

  const prefix = `legacy-benefit-${partnerId}-`;
  const normalizedId = id.trim();
  if (!normalizedId.startsWith(prefix)) {
    return null;
  }

  const legacyIndex = Number(normalizedId.slice(prefix.length));
  if (!Number.isSafeInteger(legacyIndex) || legacyIndex < 1) {
    return null;
  }

  const orderedItems = items
    .map((item, index) => ({ item, index }))
    .sort((left, right) =>
      (left.item.displayOrder ?? left.index) - (right.item.displayOrder ?? right.index),
    )
    .map(({ item }) => item);

  return orderedItems[legacyIndex - 1] ?? null;
}
