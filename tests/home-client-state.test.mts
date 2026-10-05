import assert from "node:assert/strict";
import test from "node:test";
import { homeDirectoryKey, isHomeHistoryReturn, mergeFavoriteState, mergeLoadedPartnerIds, parseHomeReturnState, searchEventDedupeKey } from "../src/components/home-view/state-merge.ts";

test("home hydration merges without changing inputs and deduplicates loaded ids", () => {
  const current = Object.freeze({ a: true });
  const ids = new Set(["a"]);
  const response = { loadedFavoritePartnerIds: ["a", "b"], partnerFavoriteStateById: { b: false } };
  assert.deepEqual(mergeFavoriteState(current, response), { a: true, b: false });
  assert.deepEqual([...mergeLoadedPartnerIds(ids, response)], ["a", "b"]);
  assert.deepEqual([...ids], ["a"]);
  assert.notEqual(searchEventDedupeKey("all", "all", "all", "new", "q"), searchEventDedupeKey("all", "all", "all", "popular", "q"));
});

test("home return state only accepts bounded counts and matching filters", () => {
  assert.deepEqual(parseHomeReturnState('{"key":"a","limit":36,"scrollY":500}', "a"), { key: "a", limit: 36, scrollY: 500 });
  for (const value of ['bad', '{"key":"b","limit":36,"scrollY":500}', '{"key":"a","limit":-1,"scrollY":0}']) assert.equal(parseHomeReturnState(value, "a"), null);
});

test("return-state identity includes submitted search and every directory filter", () => {
  const state = { category: "all", campus: "all", audience: "all", q: "찾기", sort: "popular", view: "card" } as const;
  assert.equal(homeDirectoryKey(state), "all:all:all:찾기:popular:card");
  assert.notEqual(homeDirectoryKey(state), homeDirectoryKey({ ...state, q: "" }));
  assert.notEqual(homeDirectoryKey(state), homeDirectoryKey({ ...state, view: "list" }));
});

test("full-document Back restores scroll when popstate preceded hydration, while fresh visits and reloads do not", () => {
  assert.equal(isHomeHistoryReturn(null, "back_forward"), true);
  assert.equal(isHomeHistoryReturn("1", "navigate"), true);
  for (const type of [undefined, "navigate", "reload"]) assert.equal(isHomeHistoryReturn(null, type), false);
});
