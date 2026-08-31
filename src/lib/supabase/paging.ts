export const DEFAULT_SUPABASE_QUERY_PAGE_SIZE = 1000;
export const DEFAULT_SUPABASE_IN_FILTER_CHUNK_SIZE = 200;

type RowBatch<T> = {
  rows: T[];
  error: boolean;
};

function assertPageSize(pageSize: number) {
  if (!Number.isSafeInteger(pageSize) || pageSize < 1) {
    throw new Error("Supabase 페이지 크기를 확인해 주세요.");
  }
}

export async function collectPagedRows<T>(
  maxRows: number | null,
  fetchPage: (from: number, to: number) => Promise<RowBatch<T>>,
  pageSize = DEFAULT_SUPABASE_QUERY_PAGE_SIZE,
): Promise<{ rows: T[]; truncated: boolean; partialFailure: boolean }> {
  assertPageSize(pageSize);
  const rows: T[] = [];
  let nextFrom = 0;
  let reachedEnd = false;
  let partialFailure = false;
  const capped = typeof maxRows === "number" && Number.isFinite(maxRows);

  while (!capped || rows.length < (maxRows as number)) {
    const to = capped
      ? Math.min(nextFrom + pageSize - 1, (maxRows as number) - 1)
      : nextFrom + pageSize - 1;
    const pageResult = await fetchPage(nextFrom, to);
    if (pageResult.error) {
      partialFailure = true;
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
    truncated: capped
      ? !reachedEnd && rows.length >= (maxRows as number)
      : false,
    partialFailure,
  };
}

export function chunkSupabaseFilterValues<T>(
  values: readonly T[],
  chunkSize = DEFAULT_SUPABASE_IN_FILTER_CHUNK_SIZE,
) {
  if (!Number.isSafeInteger(chunkSize) || chunkSize < 1) {
    throw new Error("Supabase 필터 청크 크기를 확인해 주세요.");
  }

  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize));
  }
  return chunks;
}

export async function collectRowsByFilterChunks<TValue, TRow>(
  values: readonly TValue[],
  fetchChunk: (values: readonly TValue[]) => Promise<RowBatch<TRow>>,
  chunkSize = DEFAULT_SUPABASE_IN_FILTER_CHUNK_SIZE,
): Promise<{ rows: TRow[]; partialFailure: boolean }> {
  const rows: TRow[] = [];

  for (const chunk of chunkSupabaseFilterValues(values, chunkSize)) {
    const result = await fetchChunk(chunk);
    if (result.error) {
      return { rows, partialFailure: true };
    }
    rows.push(...result.rows);
  }

  return { rows, partialFailure: false };
}

export async function collectPagedRowsByFilterChunks<TValue, TRow>(
  values: readonly TValue[],
  fetchPage: (
    values: readonly TValue[],
    from: number,
    to: number,
  ) => Promise<RowBatch<TRow>>,
  options: { chunkSize?: number; pageSize?: number } = {},
): Promise<{ rows: TRow[]; partialFailure: boolean }> {
  const rows: TRow[] = [];

  for (const chunk of chunkSupabaseFilterValues(
    values,
    options.chunkSize,
  )) {
    const result = await collectPagedRows(
      null,
      (from, to) => fetchPage(chunk, from, to),
      options.pageSize,
    );
    rows.push(...result.rows);
    if (result.partialFailure) {
      return { rows, partialFailure: true };
    }
  }

  return { rows, partialFailure: false };
}
