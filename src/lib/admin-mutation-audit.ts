import { sanitizeLogProperties } from "@/lib/log-sanitization";

export type AdminMutationAuditOutcome = "success" | "failure";

export function sanitizeAdminMutationAuditProperties(
  properties?: Record<string, unknown> | null,
) {
  return sanitizeLogProperties(properties);
}

export function buildAdminMutationAuditProperties({
  outcome,
  reason,
  properties,
}: {
  outcome: AdminMutationAuditOutcome;
  reason?: string | null;
  properties?: Record<string, unknown> | null;
}) {
  return {
    outcome,
    ...(reason ? { reason } : {}),
    ...sanitizeAdminMutationAuditProperties(properties),
  };
}
