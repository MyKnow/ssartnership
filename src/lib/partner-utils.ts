export function parseDate(value?: string | null) {
  if (!value) {
    return null;
  }
  if (value === "미정") {
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  return new Date(`${value}T00:00:00`);
}

export function isWithinPeriod(
  start?: string | null,
  end?: string | null,
): boolean {
  const startDate = parseDate(start ?? undefined);
  const endDate = parseDate(end ?? undefined);
  if (!startDate && !endDate) {
    return true;
  }
  const today = new Date();
  const todayDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  if (startDate && todayDate < startDate) {
    return false;
  }
  if (endDate && todayDate > endDate) {
    return false;
  }
  return true;
}

export function compareEndDate(
  a?: string | null,
  b?: string | null,
): number {
  const dateA = parseDate(a ?? undefined);
  const dateB = parseDate(b ?? undefined);
  if (!dateA && !dateB) {
    return 0;
  }
  if (!dateA) {
    return 1;
  }
  if (!dateB) {
    return -1;
  }
  return dateA.getTime() - dateB.getTime();
}
