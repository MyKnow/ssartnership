import type { AdminPlatformActivityDailyPoint } from "@/lib/platform-activity-metrics";

export type ActivityHeatmapCell = {
  date: string | null;
  memberActiveCount: number;
  guestSessionCount: number;
  intensity: 0 | 1 | 2 | 3 | 4;
};

export type ActivityHeatmapWeek = {
  key: string;
  monthLabel: string | null;
  cells: ActivityHeatmapCell[];
};

function parseDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function getActivityIntensity(
  count: number,
  peakCount: number,
): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0 || peakCount <= 0) {
    return 0;
  }

  return Math.min(4, Math.max(1, Math.ceil((count / peakCount) * 4))) as
    | 1
    | 2
    | 3
    | 4;
}

export function buildActivityHeatmap(
  dailySeries: readonly AdminPlatformActivityDailyPoint[],
): ActivityHeatmapWeek[] {
  const validPoints = dailySeries
    .map((point) => ({ point, date: parseDateKey(point.date) }))
    .filter((entry): entry is { point: AdminPlatformActivityDailyPoint; date: Date } =>
      entry.date !== null,
    )
    .sort((left, right) => left.date.getTime() - right.date.getTime());

  if (validPoints.length === 0) {
    return [];
  }

  const pointByDate = new Map(validPoints.map(({ point }) => [point.date, point]));
  const peakCount = Math.max(
    1,
    ...validPoints.map(({ point }) => Math.max(0, point.memberActiveCount)),
  );
  const firstDate = addDays(validPoints[0].date, -validPoints[0].date.getUTCDay());
  const lastDate = addDays(
    validPoints[validPoints.length - 1].date,
    6 - validPoints[validPoints.length - 1].date.getUTCDay(),
  );
  const weeks: ActivityHeatmapWeek[] = [];
  let cursor = firstDate;
  let previousMonth: number | null = null;

  while (cursor.getTime() <= lastDate.getTime()) {
    const cells = Array.from({ length: 7 }, (_, dayIndex) => {
      const date = addDays(cursor, dayIndex);
      const dateKey = toDateKey(date);
      const point = pointByDate.get(dateKey);

      if (!point) {
        return {
          date: null,
          memberActiveCount: 0,
          guestSessionCount: 0,
          intensity: 0 as const,
        };
      }

      return {
        date: dateKey,
        memberActiveCount: Math.max(0, point.memberActiveCount),
        guestSessionCount: Math.max(0, point.guestSessionCount),
        intensity: getActivityIntensity(point.memberActiveCount, peakCount),
      };
    });
    const firstPopulatedCell = cells.find((cell) => cell.date !== null);
    const month = firstPopulatedCell?.date
      ? parseDateKey(firstPopulatedCell.date)?.getUTCMonth() ?? null
      : null;

    weeks.push({
      key: toDateKey(cursor),
      monthLabel:
        month !== null && month !== previousMonth ? `${month + 1}월` : null,
      cells,
    });
    previousMonth = month;
    cursor = addDays(cursor, 7);
  }

  return weeks;
}
