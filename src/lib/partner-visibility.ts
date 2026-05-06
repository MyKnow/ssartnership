import type { PartnerVisibility } from "@/lib/types";
import { isWithinPeriod } from "@/lib/partner-utils";

export const PARTNER_VISIBILITY_VALUES = [
  "public",
  "confidential",
  "private",
] as const;

export type PartnerVisibilityState = PartnerVisibility | "expired";
type PartnerPeriod = {
  start?: string | null;
  end?: string | null;
};

export function isPartnerVisibility(value: string): value is PartnerVisibility {
  return (PARTNER_VISIBILITY_VALUES as readonly string[]).includes(value);
}

export function normalizePartnerVisibility(
  value?: string | null,
): PartnerVisibility {
  const normalized = value?.trim().toLowerCase() ?? "";
  return isPartnerVisibility(normalized) ? normalized : "public";
}

export function getPartnerVisibilityState(
  visibility: PartnerVisibility,
  periodStart?: string | null,
  periodEnd?: string | null,
): PartnerVisibilityState {
  if (visibility !== "private" && !isWithinPeriod(periodStart, periodEnd)) {
    return "expired";
  }

  return visibility;
}

export function getPartnerVisibilityLabel(visibility: PartnerVisibilityState) {
  switch (visibility) {
    case "public":
      return "공개";
    case "confidential":
      return "대외비";
    case "private":
      return "비공개";
    case "expired":
      return "기간 만료";
  }
}

export function getPartnerVisibilityBadgeClass(
  visibility: PartnerVisibilityState,
) {
  switch (visibility) {
    case "public":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "confidential":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    case "private":
      return "bg-slate-500/15 text-slate-700 dark:text-slate-300";
    case "expired":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
  }
}

export function canViewPartnerDetails(
  visibility: PartnerVisibility,
  authenticated: boolean,
  period?: PartnerPeriod,
) {
  if (
    period &&
    visibility !== "private" &&
    !isWithinPeriod(period.start, period.end)
  ) {
    return false;
  }
  if (visibility === "public") {
    return true;
  }
  if (visibility === "confidential") {
    return authenticated;
  }
  return false;
}

export function getPartnerLockKind(
  visibility: PartnerVisibility,
  authenticated: boolean,
): "confidential" | "private" | null {
  if (visibility === "private") {
    return "private";
  }
  if (visibility === "confidential" && !authenticated) {
    return "confidential";
  }
  return null;
}

export function getPartnerLockCopy(lockKind: "confidential" | "private") {
  switch (lockKind) {
    case "confidential":
      return {
        badge: "대외비",
        title: "로그인하면 확인할 수 있어요",
        description:
          "다른 업체가 더 있는 건 알겠지만\n지금은 내용을 확인할 수 없어요.",
      };
    case "private":
      return {
        badge: "비공개",
        title: "아직 추진 중인 제휴 업체예요",
        description:
          "제휴가 확정되기 전이라 누구에게도 공개되지 않아요.",
      };
  }
}
