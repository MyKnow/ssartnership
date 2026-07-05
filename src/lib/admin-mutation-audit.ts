type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type AdminMutationAuditOutcome = "success" | "failure";

const sensitivePropertyPattern =
  /password|passwd|secret|token|credential|authorization|cookie|session/i;

function sanitizeAuditValue(key: string, value: unknown): JsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (sensitivePropertyPattern.test(key)) {
    return "[redacted]";
  }
  if (value === null) {
    return null;
  }
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeAuditValue(key, item))
      .filter((item): item is JsonValue => item !== undefined);
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([childKey, childValue]) => [
        childKey,
        sanitizeAuditValue(childKey, childValue),
      ] as const)
      .filter((entry): entry is readonly [string, JsonValue] => entry[1] !== undefined);

    return Object.fromEntries(entries) as { [key: string]: JsonValue };
  }
  return String(value);
}

export function sanitizeAdminMutationAuditProperties(
  properties?: Record<string, unknown> | null,
) {
  return Object.fromEntries(
    Object.entries(properties ?? {})
      .map(([key, value]) => [key, sanitizeAuditValue(key, value)] as const)
      .filter(([, value]) => value !== undefined),
  );
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
