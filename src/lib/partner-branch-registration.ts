import { inferCampusSlugsFromLocation, normalizeCampusSlugs } from "@/lib/campuses";
import { sanitizeHttpUrl, sanitizePartnerLinkValue } from "@/lib/validation";
import type { CampusSlug } from "@/lib/campuses";

export type PartnerRegistrationMode =
  | "full_new"
  | "add_benefit_group"
  | "add_branches";

export type PartnerBranchScopeType =
  | "single_location"
  | "selected_direct_branches"
  | "many_direct_branches"
  | "all_direct_branches"
  | "selected_franchise_branches"
  | "mixed_selected_branches"
  | "online";

export type PartnerBranchType = "direct" | "franchise" | "unknown";

export type PartnerBranchInputRow = {
  benefitGroupLabel?: string | null;
  benefitGroupKey?: string | null;
  branchName?: string | null;
  address?: string | null;
  branchCode?: string | null;
  branchType?: string | null;
  mapUrl?: string | null;
  phone?: string | null;
  memo?: string | null;
};

export type PartnerBranchNormalizationContext = {
  companyName: string;
  brandName: string;
  defaultBenefitGroupKey: string;
  defaultBranchType: PartnerBranchType;
};

export type PartnerBranchDraft = {
  benefitGroupKey: string;
  benefitGroupLabel: string | null;
  branchKey: string;
  branchCode: string | null;
  branchName: string;
  address: string;
  branchType: PartnerBranchType;
  campusSlugs: CampusSlug[];
  mapUrl: string | null;
  phone: string | null;
  memo: string | null;
};

export const PARTNER_REGISTRATION_MODE_OPTIONS = [
  {
    value: "full_new",
    label: "전체 신규 등록",
    description: "브랜드 공통 정보, 혜택, 적용 지점을 함께 접수합니다.",
  },
  {
    value: "add_benefit_group",
    label: "새 혜택 그룹 추가",
    description: "기존 브랜드에 혜택이 다른 적용 지점을 추가합니다.",
  },
  {
    value: "add_branches",
    label: "새 지점만 추가",
    description: "기존 혜택은 유지하고 적용 지점 목록만 추가합니다.",
  },
] as const satisfies Array<{
  value: PartnerRegistrationMode;
  label: string;
  description: string;
}>;

export const PARTNER_BRANCH_SCOPE_OPTIONS = [
  {
    value: "single_location",
    label: "단일 지점",
    description: "하나의 매장 또는 지점에만 적용됩니다.",
  },
  {
    value: "selected_direct_branches",
    label: "선택 직영점",
    description: "소수 직영점에만 혜택을 적용합니다.",
  },
  {
    value: "many_direct_branches",
    label: "직영점 다수",
    description: "여러 직영점에 같은 혜택을 적용합니다.",
  },
  {
    value: "all_direct_branches",
    label: "전체 직영점",
    description: "등록한 전체 직영점에 같은 혜택을 적용합니다.",
  },
  {
    value: "selected_franchise_branches",
    label: "선택 가맹점",
    description: "제휴에 동의한 일부 가맹점에만 적용합니다.",
  },
  {
    value: "mixed_selected_branches",
    label: "직영+가맹 일부",
    description: "직영점과 가맹점 일부가 함께 참여합니다.",
  },
] as const satisfies Array<{
  value: Exclude<PartnerBranchScopeType, "online">;
  label: string;
  description: string;
}>;

const DEFAULT_BENEFIT_GROUP_LABELS = new Set([
  "",
  "기본",
  "기본 혜택",
  "default",
  "main",
]);

function normalizeText(value?: string | null) {
  return (value ?? "").trim();
}

function normalizeKeyPart(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function hashString(value: string) {
  let hash = 5381;
  for (const char of value) {
    hash = (hash * 33) ^ char.charCodeAt(0);
  }
  return (hash >>> 0).toString(36).padStart(6, "0").slice(0, 10);
}

export function normalizePartnerRegistrationMode(
  value?: string | null,
): PartnerRegistrationMode {
  return PARTNER_REGISTRATION_MODE_OPTIONS.some((option) => option.value === value)
    ? (value as PartnerRegistrationMode)
    : "full_new";
}

export function normalizePartnerBranchScopeType(
  value?: string | null,
  serviceMode?: string | null,
): PartnerBranchScopeType {
  if (serviceMode === "online") {
    return "online";
  }
  return PARTNER_BRANCH_SCOPE_OPTIONS.some((option) => option.value === value)
    ? (value as PartnerBranchScopeType)
    : "single_location";
}

export function isMultiBranchScopeType(scopeType: PartnerBranchScopeType) {
  return (
    scopeType === "selected_direct_branches" ||
    scopeType === "many_direct_branches" ||
    scopeType === "all_direct_branches" ||
    scopeType === "selected_franchise_branches" ||
    scopeType === "mixed_selected_branches"
  );
}

export function getDefaultBranchTypeForScope(
  scopeType: PartnerBranchScopeType,
): PartnerBranchType {
  if (scopeType === "selected_franchise_branches") {
    return "franchise";
  }
  if (scopeType === "mixed_selected_branches") {
    return "unknown";
  }
  return "direct";
}

export function getPartnerBranchScopeLabel(
  scopeType?: string | null,
  serviceMode?: string | null,
) {
  if (serviceMode === "online" || scopeType === "online") {
    return "온라인";
  }
  return (
    PARTNER_BRANCH_SCOPE_OPTIONS.find((option) => option.value === scopeType)?.label ??
    "단일 지점"
  );
}

export function inferPartnerBranchScopeType({
  serviceMode,
  branches,
  fallback = "single_location",
}: {
  serviceMode?: string | null;
  branches: Array<{ branchType?: string | null }>;
  fallback?: PartnerBranchScopeType;
}): PartnerBranchScopeType {
  if (serviceMode === "online" || fallback === "online") {
    return "online";
  }
  if (branches.length === 0) {
    return fallback;
  }

  const branchTypes = branches.map((branch) =>
    normalizePartnerBranchType(branch.branchType, "unknown"),
  );
  const hasDirect = branchTypes.includes("direct");
  const hasFranchise = branchTypes.includes("franchise");
  const hasUnknown = branchTypes.includes("unknown");

  if (branches.length === 1) {
    if (hasFranchise) {
      return "selected_franchise_branches";
    }
    if (fallback !== "single_location") {
      return fallback;
    }
    return "single_location";
  }

  if (hasFranchise && (hasDirect || hasUnknown)) {
    return "mixed_selected_branches";
  }
  if (hasFranchise) {
    return "selected_franchise_branches";
  }
  if (hasUnknown) {
    return "mixed_selected_branches";
  }
  return branches.length >= 10 ? "many_direct_branches" : "selected_direct_branches";
}

export function normalizePartnerBranchType(
  value?: string | null,
  fallback: PartnerBranchType = "unknown",
): PartnerBranchType {
  const normalized = normalizeText(value).toLowerCase();
  if (["direct", "직영", "직영점", "본사", "直营"].includes(normalized)) {
    return "direct";
  }
  if (["franchise", "가맹", "가맹점", "加盟"].includes(normalized)) {
    return "franchise";
  }
  if (["unknown", "미정", "혼합"].includes(normalized)) {
    return "unknown";
  }
  return fallback;
}

export function normalizeBenefitGroupKey(
  value: string | null | undefined,
  fallback: string,
) {
  const normalized = normalizeText(value);
  if (DEFAULT_BENEFIT_GROUP_LABELS.has(normalized.toLowerCase())) {
    return fallback;
  }
  return normalizeKeyPart(normalized) || fallback;
}

export function buildPartnerBranchKey({
  companyName,
  brandName,
  branchName,
  address,
  branchCode,
}: {
  companyName: string;
  brandName: string;
  branchName: string;
  address: string;
  branchCode?: string | null;
}) {
  const normalizedCode = normalizeKeyPart(normalizeText(branchCode));
  if (normalizedCode) {
    return `code-${normalizedCode}`;
  }
  const source = [companyName, brandName, branchName, address]
    .map((item) => normalizeKeyPart(item))
    .filter(Boolean)
    .join("|");
  return `auto-${hashString(source || address || branchName)}`;
}

function normalizeBranchName(branchName: string, address: string) {
  return branchName || address;
}

export function normalizePartnerBranchRows(
  rows: PartnerBranchInputRow[],
  context: PartnerBranchNormalizationContext,
) {
  const errors: string[] = [];
  const branches: PartnerBranchDraft[] = [];
  const seen = new Set<string>();

  for (const [index, row] of rows.entries()) {
    const address = normalizeText(row.address);
    const branchName = normalizeBranchName(normalizeText(row.branchName), address);
    const branchCode = normalizeText(row.branchCode);
    const benefitGroupKey = normalizeBenefitGroupKey(
      row.benefitGroupKey ?? row.benefitGroupLabel,
      context.defaultBenefitGroupKey,
    );
    const branchType = normalizePartnerBranchType(
      row.branchType,
      context.defaultBranchType,
    );

    if (!address) {
      errors.push(`${index + 1}번째 지점의 주소를 입력해 주세요.`);
      continue;
    }
    if (!branchName) {
      errors.push(`${index + 1}번째 지점명을 확인해 주세요.`);
      continue;
    }

    const safeMapUrl = row.mapUrl ? sanitizeHttpUrl(row.mapUrl) : null;
    if (row.mapUrl && !safeMapUrl) {
      errors.push(`${index + 1}번째 지점의 지도 URL 형식을 확인해 주세요.`);
      continue;
    }

    const safePhone = row.phone ? sanitizePartnerLinkValue(row.phone) : null;
    if (row.phone && !safePhone) {
      errors.push(`${index + 1}번째 지점의 전화번호 형식을 확인해 주세요.`);
      continue;
    }

    const branchKey = buildPartnerBranchKey({
      companyName: context.companyName,
      brandName: context.brandName,
      branchName,
      address,
      branchCode,
    });
    const duplicateKey = `${benefitGroupKey}:${branchKey}`;
    if (seen.has(duplicateKey)) {
      continue;
    }
    seen.add(duplicateKey);

    branches.push({
      benefitGroupKey,
      benefitGroupLabel: normalizeText(row.benefitGroupLabel) || null,
      branchKey,
      branchCode: branchCode || null,
      branchName,
      address,
      branchType,
      campusSlugs: normalizeCampusSlugs(inferCampusSlugsFromLocation(address)),
      mapUrl: safeMapUrl,
      phone: safePhone,
      memo: normalizeText(row.memo) || null,
    });
  }

  return { branches, errors };
}

function splitBranchListLine(line: string) {
  if (line.includes("\t")) {
    return line.split("\t");
  }
  if (line.includes("|")) {
    return line.split("|");
  }
  return line.split(",");
}

export function parsePartnerBranchListText(
  value: string,
  context: PartnerBranchNormalizationContext,
) {
  const rows = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map<PartnerBranchInputRow>((line) => {
      const cells = splitBranchListLine(line).map((cell) => cell.trim());
      if (cells.length === 1) {
        return { address: cells[0] };
      }
      if (cells.length === 2) {
        return { branchName: cells[0], address: cells[1] };
      }
      return {
        benefitGroupLabel: cells[0],
        branchName: cells[1],
        address: cells[2],
        branchCode: cells[3],
        branchType: cells[4],
        mapUrl: cells[5],
        phone: cells[6],
        memo: cells.slice(7).join(" "),
      };
    });

  return normalizePartnerBranchRows(rows, context);
}

export function createFallbackSingleBranch(
  input: {
    companyName: string;
    brandName: string;
    location: string;
    mapUrl?: string | null;
    phone?: string | null;
  },
  defaultBenefitGroupKey = "default",
) {
  return normalizePartnerBranchRows(
    [
      {
        benefitGroupKey: defaultBenefitGroupKey,
        branchName: input.brandName,
        address: input.location,
        branchType: "direct",
        mapUrl: input.mapUrl,
        phone: input.phone,
      },
    ],
    {
      companyName: input.companyName,
      brandName: input.brandName,
      defaultBenefitGroupKey,
      defaultBranchType: "direct",
    },
  );
}
