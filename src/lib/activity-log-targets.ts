import { isUuid } from "@/lib/uuid";

export function shouldRunPartnerMetricFallback(
  targetType?: string | null,
  targetId?: string | null,
) {
  return targetType === "partner" && Boolean(targetId && isUuid(targetId));
}

export function sanitizeProductEventTargetId(
  targetType?: string | null,
  targetId?: string | null,
) {
  if (targetType === "partner" && targetId && !isUuid(targetId)) {
    return null;
  }
  return targetId ?? null;
}
