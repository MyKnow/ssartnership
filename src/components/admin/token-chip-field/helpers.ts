export function splitTokenValues(value: string) {
  return value
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function dedupeTokenValues(values: string[]) {
  const seen = new Set<string>();
  const next: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    next.push(normalized);
  }

  return next;
}

export function clampTokenIndex(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function moveTokenArrayItem(values: string[], from: number, to: number) {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= values.length ||
    to > values.length
  ) {
    return values;
  }

  const next = [...values];
  const [item] = next.splice(from, 1);
  if (typeof item === "undefined") {
    return values;
  }
  next.splice(to, 0, item);
  return next;
}

export function remapEditingIndexAfterMove(index: number, from: number, to: number) {
  if (index === from) {
    return to;
  }
  if (from < to && index > from && index <= to) {
    return index - 1;
  }
  if (to < from && index >= to && index < from) {
    return index + 1;
  }
  return index;
}
