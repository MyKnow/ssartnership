export const DEFAULT_QUERY_PAGE_SIZE = 1000;

export async function collectPagedRows<T>(
  maxRows: number,
  fetchPage: (from: number, to: number) => Promise<{
    rows: T[];
    error: boolean;
  }>,
  pageSize = DEFAULT_QUERY_PAGE_SIZE,
): Promise<{ rows: T[]; truncated: boolean }> {
  const rows: T[] = [];
  let nextFrom = 0;
  let reachedEnd = false;

  while (rows.length < maxRows) {
    const to = Math.min(nextFrom + pageSize - 1, maxRows - 1);
    const pageResult = await fetchPage(nextFrom, to);
    if (pageResult.error) {
      break;
    }

    rows.push(...pageResult.rows);
    if (pageResult.rows.length < pageSize) {
      reachedEnd = true;
      break;
    }

    nextFrom += pageSize;
  }

  return {
    rows: rows.slice(0, maxRows),
    truncated: !reachedEnd && rows.length >= maxRows,
  };
}
