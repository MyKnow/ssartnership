export type ContentBudget<T> = {
  visible: T[];
  hiddenCount: number;
};

function normalizeContentLimit(limit: number) {
  if (!Number.isFinite(limit)) {
    return 0;
  }
  return Math.max(0, Math.floor(limit));
}

export function applyContentBudget<T>(
  items: readonly T[],
  limit: number,
): ContentBudget<T> {
  const normalizedLimit = normalizeContentLimit(limit);
  const visible = items.slice(0, normalizedLimit);

  return {
    visible,
    hiddenCount: Math.max(0, items.length - visible.length),
  };
}
