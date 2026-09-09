import assert from "node:assert/strict";
import test from "node:test";

import {
  chunkSupabaseFilterValues,
  collectPagedRows,
  collectPagedRowsByFilterChunks,
  collectRowsByFilterChunks,
} from "@/lib/supabase/paging";

test("Supabase paging rejects an invalid page size", async () => {
  await assert.rejects(
    () => collectPagedRows(null, async () => ({ rows: [], error: false }), 0),
    /Supabase 페이지 크기를 확인해 주세요/u,
  );
});

test("Supabase filter values are split into bounded ordered chunks", () => {
  assert.deepEqual(chunkSupabaseFilterValues([1, 2, 3, 4, 5], 2), [
    [1, 2],
    [3, 4],
    [5],
  ]);
  assert.throws(
    () => chunkSupabaseFilterValues([1], 0),
    /Supabase 필터 청크 크기를 확인해 주세요/u,
  );
});

test("Supabase chunk collection keeps order and stops on a failed chunk", async () => {
  const calls: number[][] = [];
  const result = await collectRowsByFilterChunks(
    [1, 2, 3, 4, 5],
    async (values) => {
      calls.push([...values]);
      if (values.includes(3)) {
        return { rows: [], error: true };
      }
      return { rows: values.map((value) => `row-${value}`), error: false };
    },
    2,
  );

  assert.deepEqual(calls, [
    [1, 2],
    [3, 4],
  ]);
  assert.deepEqual(result, {
    rows: ["row-1", "row-2"],
    partialFailure: true,
  });
});

test("Supabase chunked filters also page result sets larger than one response", async () => {
  const calls: Array<{ values: readonly number[]; from: number; to: number }> = [];
  const result = await collectPagedRowsByFilterChunks(
    [1, 2, 3],
    async (values, from, to) => {
      calls.push({ values: [...values], from, to });
      const rows =
        from === 0
          ? Array.from({ length: 2 }, (_, index) => `${values.join("-")}:${index}`)
          : [`${values.join("-")}:last`];
      return { rows, error: false };
    },
    { chunkSize: 2, pageSize: 2 },
  );

  assert.deepEqual(calls, [
    { values: [1, 2], from: 0, to: 1 },
    { values: [1, 2], from: 2, to: 3 },
    { values: [3], from: 0, to: 1 },
    { values: [3], from: 2, to: 3 },
  ]);
  assert.deepEqual(result, {
    rows: ["1-2:0", "1-2:1", "1-2:last", "3:0", "3:1", "3:last"],
    partialFailure: false,
  });
});
