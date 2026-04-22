type AuditChangeField = {
  label: string;
  before: unknown;
  after: unknown;
  format?: (value: unknown) => string;
  describeChange?: (before: unknown, after: unknown) => string | null;
};

type AuditChangeSummary = {
  summary: string;
  changedFields: string[];
  changes: string[];
};

function normalizeAuditValue(value: unknown): unknown {
  if (value === undefined || value === null) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeAuditValue(item));
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [
        key,
        normalizeAuditValue(entryValue),
      ]),
    );
  }
  return value;
}

function formatAuditValue(value: unknown, format?: (value: unknown) => string): string {
  if (format) {
    return format(value);
  }
  if (value === undefined || value === null || value === "") {
    return "없음";
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "없음";
    }
    return value.map((item) => formatAuditValue(item)).join(", ");
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "boolean") {
    return value ? "예" : "아니오";
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[object]";
    }
  }
  return String(value);
}

function isAuditValueEqual(before: unknown, after: unknown): boolean {
  return JSON.stringify(normalizeAuditValue(before)) === JSON.stringify(normalizeAuditValue(after));
}

export function buildAuditChangeSummary(
  entityLabel: string,
  changes: AuditChangeField[],
): AuditChangeSummary {
  const changedFields: string[] = [];
  const changeDescriptions: string[] = [];

  for (const change of changes) {
    if (isAuditValueEqual(change.before, change.after)) {
      continue;
    }

    changedFields.push(change.label);
    const description =
      change.describeChange?.(change.before, change.after) ??
      `${change.label}: ${formatAuditValue(change.before, change.format)} → ${formatAuditValue(change.after, change.format)}`;
    if (description) {
      changeDescriptions.push(description);
    }
  }

  return {
    summary:
      changedFields.length > 0
        ? `${entityLabel} 수정 / ${changedFields.join(", ")}`
        : `${entityLabel} 수정`,
    changedFields,
    changes: changeDescriptions,
  };
}
