import type { BenefitListingMode } from "@/lib/partner-coupon-only";

export const PARTNER_CARD_CREATE_DRAFT_KEY = "admin-partner-create-new";
export const PARTNER_CARD_DRAFT_VALUE_KEY = "__partnerCardDraft";

export type PartnerCardBranchEntryMode = "single" | "multi";

export type PartnerCardDraftSnapshot = {
  version: 1;
  branchEntryMode: PartnerCardBranchEntryMode;
  benefitListingMode: BenefitListingMode;
  branchListText: string;
  conditions: string[];
  benefits: string[];
  tags: string[];
  appliesTo: string[];
  campusSlugs: string[];
};

type PartnerCardDraftSnapshotInput = Omit<PartnerCardDraftSnapshot, "version">;

function normalizeStringList(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  );
}

function readStringList(value: unknown) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    return null;
  }
  return normalizeStringList(value);
}

export function createPartnerCardDraftSnapshot(
  input: PartnerCardDraftSnapshotInput,
): PartnerCardDraftSnapshot {
  return {
    version: 1,
    branchEntryMode: input.branchEntryMode === "multi" ? "multi" : "single",
    benefitListingMode:
      input.benefitListingMode === "coupon_only" ? "coupon_only" : "always_on",
    branchListText: input.branchListText.trim(),
    conditions: normalizeStringList(input.conditions),
    benefits: normalizeStringList(input.benefits),
    tags: normalizeStringList(input.tags),
    appliesTo: normalizeStringList(input.appliesTo),
    campusSlugs: normalizeStringList(input.campusSlugs),
  };
}

export function serializePartnerCardDraftSnapshot(
  snapshot: PartnerCardDraftSnapshotInput | PartnerCardDraftSnapshot,
) {
  return JSON.stringify(createPartnerCardDraftSnapshot(snapshot));
}

export function readPartnerCardDraftSnapshot(
  value: unknown,
): PartnerCardDraftSnapshot | null {
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object") return null;

  const candidate = parsed as Partial<PartnerCardDraftSnapshot>;
  if (
    candidate.version !== 1
    || (candidate.branchEntryMode !== "single" && candidate.branchEntryMode !== "multi")
    || (candidate.benefitListingMode !== "always_on" && candidate.benefitListingMode !== "coupon_only")
    || typeof candidate.branchListText !== "string"
  ) {
    return null;
  }

  const conditions = readStringList(candidate.conditions);
  const benefits = readStringList(candidate.benefits);
  const tags = readStringList(candidate.tags);
  const appliesTo = readStringList(candidate.appliesTo);
  const campusSlugs = readStringList(candidate.campusSlugs);
  if (!conditions || !benefits || !tags || !appliesTo || !campusSlugs) {
    return null;
  }

  return createPartnerCardDraftSnapshot({
    branchEntryMode: candidate.branchEntryMode,
    benefitListingMode: candidate.benefitListingMode,
    branchListText: candidate.branchListText,
    conditions,
    benefits,
    tags,
    appliesTo,
    campusSlugs,
  });
}
