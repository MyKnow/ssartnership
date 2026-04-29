export const DEFAULT_QUERY_PAGE_SIZE = 1000;

export async function collectPagedRows<T>(
  maxRows: number | null,
  fetchPage: (from: number, to: number) => Promise<{
    rows: T[];
    error: boolean;
  }>,
  pageSize = DEFAULT_QUERY_PAGE_SIZE,
): Promise<{ rows: T[]; truncated: boolean }> {
  const rows: T[] = [];
  let nextFrom = 0;
  let reachedEnd = false;
  const capped = typeof maxRows === 'number' && Number.isFinite(maxRows);

  while (!capped || rows.length < (maxRows as number)) {
    const to = capped ? Math.min(nextFrom + pageSize - 1, (maxRows as number) - 1) : nextFrom + pageSize - 1;
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
    rows: capped ? rows.slice(0, maxRows as number) : rows,
    truncated: capped ? !reachedEnd && rows.length >= (maxRows as number) : false,
  };
}
