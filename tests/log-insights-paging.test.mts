import test from "node:test";
import assert from "node:assert/strict";

import { collectPagedRows } from "@/lib/log-insights/paging";

test("collectPagedRows stops when a short page is returned", async () => {
  const calls: Array<[number, number]> = [];

  const result = await collectPagedRows(
    3000,
    async (from, to) => {
      calls.push([from, to]);
      if (from === 0) {
        return {
          rows: Array.from({ length: 1000 }, (_, index) => index),
          error: false,
        };
      }
      return {
        rows: Array.from({ length: 120 }, (_, index) => 1000 + index),
        error: false,
      };
    },
    1000,
  );

  assert.deepEqual(calls, [
    [0, 999],
    [1000, 1999],
  ]);
  assert.equal(result.rows.length, 1120);
  assert.equal(result.truncated, false);
});

test("collectPagedRows marks truncated when it fills the cap without a short page", async () => {
  const result = await collectPagedRows(
    1500,
    async (from, to) => ({
      rows: Array.from({ length: to - from + 1 }, (_, index) => from + index),
      error: false,
    }),
    500,
  );

  assert.equal(result.rows.length, 1500);
  assert.equal(result.truncated, true);
});

test("collectPagedRows stops on query error and returns partial rows", async () => {
  const calls: number[] = [];

  const result = await collectPagedRows(
    2000,
    async (from, to) => {
      calls.push(from);
      if (from === 1000) {
        return { rows: [], error: true };
      }
      return {
        rows: Array.from({ length: to - from + 1 }, (_, index) => from + index),
        error: false,
      };
    },
    1000,
  );

  assert.deepEqual(calls, [0, 1000]);
  assert.equal(result.rows.length, 1000);
  assert.equal(result.truncated, false);
});

test("collectPagedRows can read until the final short page without a hard cap", async () => {
  const calls: Array<[number, number]> = [];

  const result = await collectPagedRows(
    null,
    async (from, to) => {
      calls.push([from, to]);
      if (from === 0) {
        return {
          rows: Array.from({ length: to - from + 1 }, (_, index) => index),
          error: false,
        };
      }
      return {
        rows: Array.from({ length: 180 }, (_, index) => 1000 + index),
        error: false,
      };
    },
    1000,
  );

  assert.deepEqual(calls, [
    [0, 999],
    [1000, 1999],
  ]);
  assert.equal(result.rows.length, 1180);
  assert.equal(result.truncated, false);
});
