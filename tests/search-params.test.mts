import assert from "node:assert/strict";
import test from "node:test";
import {
  readFirstSearchParam,
  readFirstSearchParamOrEmpty,
} from "@/lib/search-params";

test("readFirstSearchParam keeps the first Next.js search parameter value", () => {
  assert.equal(readFirstSearchParam(undefined), undefined);
  assert.equal(readFirstSearchParam("single"), "single");
  assert.equal(readFirstSearchParam([]), undefined);
  assert.equal(readFirstSearchParam(["first", "second"]), "first");
});

test("readFirstSearchParamOrEmpty normalizes a missing value for form defaults", () => {
  assert.equal(readFirstSearchParamOrEmpty(undefined), "");
  assert.equal(readFirstSearchParamOrEmpty([]), "");
  assert.equal(readFirstSearchParamOrEmpty(["first", "second"]), "first");
});
