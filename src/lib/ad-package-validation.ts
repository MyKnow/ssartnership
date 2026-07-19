import {
  getAdPackageDefinition,
  isAdPackageTier,
  normalizeAdChannelsForTier,
  type AdCampaignStatus,
  type AdChannel,
  type AdCouponRedemptionType,
  type AdCouponIssuanceType,
  type AdCouponStatus,
} from "@/lib/ad-packages";
import type {
  CreateAdCampaignInput,
  CreateAdCouponInput,
} from "@/lib/repositories/ad-package-repository";
import { sanitizeHttpUrl } from "@/lib/validation";

export const AD_PACKAGE_FORM_LIMITS = {
  titleMax: 80,
  descriptionMax: 240,
  sponsorLabelMax: 60,
  codeMax: 120,
  discountLabelMax: 80,
  termsMax: 8,
  termMax: 80,
  notesMax: 500,
} as const;

const campaignStatuses = new Set<AdCampaignStatus>([
  "draft",
  "active",
  "paused",
  "ended",
]);
const couponStatuses = new Set<AdCouponStatus>([
  "draft",
  "active",
  "paused",
  "ended",
]);
const redemptionTypes = new Set<AdCouponRedemptionType>([
  "onsite",
  "code",
  "external",
]);
const issuanceTypes = new Set<AdCouponIssuanceType>([
  "service",
  "partner_code_pool",
]);

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function requireString(formData: FormData, key: string, message: string) {
  const value = getString(formData, key);
  if (!value) {
    throw new Error(message);
  }
  return value;
}

function limitLength(value: string, max: number, message: string) {
  if (value.length > max) {
    throw new Error(message);
  }
  return value;
}

function parseDateTimeLocal(value: string, message: string) {
  if (!value) {
    throw new Error(message);
  }
  const normalized = value.length === 16 ? `${value}:00+09:00` : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    throw new Error("기간 형식을 확인해 주세요.");
  }
  return date.toISOString();
}

function parseOptionalDateTimeLocal(value: string, fallback: string) {
  return value ? parseDateTimeLocal(value, "기간 형식을 확인해 주세요.") : fallback;
}

function assertPeriod(startsAt: string, endsAt: string) {
  if (new Date(startsAt).getTime() > new Date(endsAt).getTime()) {
    throw new Error("시작 시각은 종료 시각보다 늦을 수 없습니다.");
  }
}

function parseNonNegativeInteger(value: string, fallback: number) {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error("금액과 제한 횟수는 0 이상의 정수로 입력해 주세요.");
  }
  return parsed;
}

function parsePositiveInteger(value: string, fallback: number) {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error("회원별 사용 제한은 1 이상의 정수로 입력해 주세요.");
  }
  return parsed;
}

function parseNullableLimit(value: string) {
  if (!value) {
    return null;
  }
  return parseNonNegativeInteger(value, 0);
}

function parseTerms(value: string) {
  const terms = value
    .split(/\r?\n/)
    .map((term) => term.trim())
    .filter(Boolean)
    .slice(0, AD_PACKAGE_FORM_LIMITS.termsMax)
    .map((term) =>
      limitLength(
        term,
        AD_PACKAGE_FORM_LIMITS.termMax,
        "쿠폰 조건은 항목당 80자 이하로 입력해 주세요.",
      ),
    );
  return terms;
}

function parseStatus<T extends string>(
  value: string,
  allowed: ReadonlySet<T>,
  fallback: T,
) {
  return allowed.has(value as T) ? (value as T) : fallback;
}

export function parseCreateAdCampaignForm(
  formData: FormData,
): CreateAdCampaignInput {
  const partnerId = requireString(formData, "partnerId", "제휴처를 선택해 주세요.");
  const tierValue = requireString(formData, "packageTier", "패키지를 선택해 주세요.");
  if (!isAdPackageTier(tierValue)) {
    throw new Error("패키지 유형을 확인해 주세요.");
  }
  const title = limitLength(
    requireString(formData, "title", "캠페인명을 입력해 주세요."),
    AD_PACKAGE_FORM_LIMITS.titleMax,
    "캠페인명은 80자 이하로 입력해 주세요.",
  );
  const description = limitLength(
    getString(formData, "description"),
    AD_PACKAGE_FORM_LIMITS.descriptionMax,
    "캠페인 설명은 240자 이하로 입력해 주세요.",
  );
  const sponsorLabel = limitLength(
    getString(formData, "sponsorLabel"),
    AD_PACKAGE_FORM_LIMITS.sponsorLabelMax,
    "스폰서 표기는 60자 이하로 입력해 주세요.",
  );
  const startsAt = parseDateTimeLocal(
    requireString(formData, "startsAt", "시작 시각을 입력해 주세요."),
    "시작 시각을 입력해 주세요.",
  );
  const endsAt = parseDateTimeLocal(
    requireString(formData, "endsAt", "종료 시각을 입력해 주세요."),
    "종료 시각을 입력해 주세요.",
  );
  assertPeriod(startsAt, endsAt);
  const requestedChannels = formData
    .getAll("channels")
    .map((value) => String(value).trim())
    .filter(Boolean) as AdChannel[];
  const channels = normalizeAdChannelsForTier(tierValue, requestedChannels);
  const definition = getAdPackageDefinition(tierValue);

  return {
    partnerId,
    packageTier: tierValue,
    title,
    description,
    sponsorLabel,
    status: parseStatus(getString(formData, "status"), campaignStatuses, "draft"),
    startsAt,
    endsAt,
    channels,
    monthlyPriceKrw: parseNonNegativeInteger(
      getString(formData, "monthlyPriceKrw"),
      definition.monthlyPriceKrw,
    ),
    notes: limitLength(
      getString(formData, "notes"),
      AD_PACKAGE_FORM_LIMITS.notesMax,
      "운영 메모는 500자 이하로 입력해 주세요.",
    ),
  };
}

export function parseCreateAdCouponForm(formData: FormData): CreateAdCouponInput {
  const partnerId = requireString(formData, "partnerId", "제휴처를 선택해 주세요.");
  const campaignId = getString(formData, "campaignId") || null;
  const title = limitLength(
    requireString(formData, "title", "쿠폰명을 입력해 주세요."),
    AD_PACKAGE_FORM_LIMITS.titleMax,
    "쿠폰명은 80자 이하로 입력해 주세요.",
  );
  const startsAt = parseDateTimeLocal(
    requireString(formData, "startsAt", "시작 시각을 입력해 주세요."),
    "시작 시각을 입력해 주세요.",
  );
  const endsAt = parseDateTimeLocal(
    requireString(formData, "endsAt", "종료 시각을 입력해 주세요."),
    "종료 시각을 입력해 주세요.",
  );
  assertPeriod(startsAt, endsAt);
  const downloadStartsAt = parseOptionalDateTimeLocal(
    getString(formData, "downloadStartsAt"),
    startsAt,
  );
  const downloadEndsAt = parseOptionalDateTimeLocal(
    getString(formData, "downloadEndsAt"),
    endsAt,
  );
  const usageStartsAt = parseOptionalDateTimeLocal(
    getString(formData, "usageStartsAt"),
    startsAt,
  );
  const usageEndsAt = parseOptionalDateTimeLocal(
    getString(formData, "usageEndsAt"),
    endsAt,
  );
  assertPeriod(downloadStartsAt, downloadEndsAt);
  assertPeriod(usageStartsAt, usageEndsAt);
  const externalUrl = getString(formData, "externalUrl");
  const safeExternalUrl = externalUrl ? sanitizeHttpUrl(externalUrl) : "";
  if (externalUrl && !safeExternalUrl) {
    throw new Error("외부 쿠폰 링크 형식을 확인해 주세요.");
  }

  return {
    campaignId,
    partnerId,
    title,
    description: limitLength(
      getString(formData, "description"),
      AD_PACKAGE_FORM_LIMITS.descriptionMax,
      "쿠폰 설명은 240자 이하로 입력해 주세요.",
    ),
    code: limitLength(
      getString(formData, "code"),
      AD_PACKAGE_FORM_LIMITS.codeMax,
      "쿠폰 코드는 120자 이하로 입력해 주세요.",
    ),
    issuanceType: parseStatus(
      getString(formData, "issuanceType"),
      issuanceTypes,
      "service",
    ),
    redemptionType: parseStatus(
      getString(formData, "redemptionType"),
      redemptionTypes,
      "onsite",
    ),
    discountLabel: limitLength(
      getString(formData, "discountLabel"),
      AD_PACKAGE_FORM_LIMITS.discountLabelMax,
      "할인 표기는 80자 이하로 입력해 주세요.",
    ),
    terms: parseTerms(getString(formData, "terms")),
    status: parseStatus(getString(formData, "status"), couponStatuses, "draft"),
    startsAt,
    endsAt,
    downloadStartsAt,
    downloadEndsAt,
    usageStartsAt,
    usageEndsAt,
    usageLimit: parseNullableLimit(getString(formData, "usageLimit")),
    dailyIssueLimit: parseNullableLimit(getString(formData, "dailyIssueLimit")),
    weeklyIssueLimit: parseNullableLimit(getString(formData, "weeklyIssueLimit")),
    monthlyIssueLimit: parseNullableLimit(getString(formData, "monthlyIssueLimit")),
    perMemberLimit: parsePositiveInteger(getString(formData, "perMemberLimit"), 1),
    externalUrl: safeExternalUrl ?? "",
  };
}
