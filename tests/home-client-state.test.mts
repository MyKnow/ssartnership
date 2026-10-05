import assert from "node:assert/strict";
import test from "node:test";
import * as homeState from "../src/components/home-view/state-merge.ts";
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

test("home hydration never overwrites a newer local favorite mutation", () => {
  const current = Object.freeze({ a: true, b: false });
  const incoming = { partnerFavoriteStateById: { a: false, b: true } };
  assert.deepEqual(mergeFavoriteState(current, incoming, new Set(["a"])), { a: true, b: true });
});

test("favorite state, authoritative count and pending survive card remount and rollback", () => {
  const initial = homeState.createHomePartnerState({
    favorites: { a: false }, popularity: { a: { favoriteCount: 4 } }, loadedIds: ["a"],
  });
  let state = homeState.homePartnerStateReducer(initial, { type: "pending", partnerId: "a", pending: true });
  state = homeState.homePartnerStateReducer(state, { type: "favorite", partnerId: "a", favorite: true });
  assert.equal(state.favorites.a, true);
  assert.equal(state.popularity.a?.favoriteCount, 5);
  assert.ok(state.pendingIds.has("a")); // A remounted button reads this parent state.
  state = homeState.homePartnerStateReducer(state, { type: "hydrate", response: {
    partnerFavoriteStateById: { a: false, b: true }, loadedFavoritePartnerIds: ["a", "b"],
  } });
  assert.equal(state.favorites.a, true);
  assert.equal(state.favorites.b, true);
  state = homeState.homePartnerStateReducer(state, { type: "favorite", partnerId: "a", favorite: true, count: 8 });
  assert.equal(state.popularity.a?.favoriteCount, 8); // Same boolean must not increment twice.
  state = homeState.homePartnerStateReducer(state, { type: "pending", partnerId: "a", pending: false });
  assert.equal(state.pendingIds.has("a"), false);
  state = homeState.homePartnerStateReducer(state, { type: "favorite", partnerId: "a", favorite: false });
  assert.equal(state.popularity.a?.favoriteCount, 7);
  state = homeState.homePartnerStateReducer(state, { type: "favorite", partnerId: "a", favorite: true, count: 8 });
  assert.equal(state.favorites.a, true);
  assert.equal(state.popularity.a?.favoriteCount, 8);
  assert.equal(initial.favorites.a, false);
  assert.equal(initial.popularity.a?.favoriteCount, 4);
  assert.equal(initial.pendingIds.size, 0);
});

test("failed mutation of an unhydrated favorite restores unknown provenance and allows rereading", () => {
  let state = homeState.createHomePartnerState({});
  state = homeState.homePartnerStateReducer(state, { type: "pending", partnerId: "a", pending: true });
  state = homeState.homePartnerStateReducer(state, { type: "favorite", partnerId: "a", favorite: true });
  state = homeState.homePartnerStateReducer(state, { type: "hydrate", response: {
    partnerFavoriteStateById: { a: true, b: true }, loadedFavoritePartnerIds: ["a", "b"],
  } });
  state = homeState.homePartnerStateReducer(state, { type: "favorite", partnerId: "a", favorite: false, count: 0 });
  state = homeState.homePartnerStateReducer(state, { type: "pending", partnerId: "a", pending: false, outcome: "failure" });
  assert.equal(state.favorites.a, undefined);
  assert.equal(state.loadedIds.has("a"), false);
  assert.equal(state.locallyChangedIds.has("a"), false);
  assert.equal(state.pendingIds.has("a"), false);
  assert.equal(state.favorites.b, true);
  assert.ok(state.loadedIds.has("b"));
  state = homeState.homePartnerStateReducer(state, { type: "hydrate", response: {
    partnerFavoriteStateById: { a: true }, loadedFavoritePartnerIds: ["a"],
  } });
  assert.equal(state.favorites.a, true);
  assert.ok(state.loadedIds.has("a"));
});

test("rollback retains an earlier committed favorite and does not undo another card's mutation", () => {
  let state = homeState.createHomePartnerState({});
  state = homeState.homePartnerStateReducer(state, { type: "pending", partnerId: "a", pending: true });
  state = homeState.homePartnerStateReducer(state, { type: "favorite", partnerId: "a", favorite: true, count: 8 });
  state = homeState.homePartnerStateReducer(state, { type: "pending", partnerId: "a", pending: false, outcome: "success" });
  state = homeState.homePartnerStateReducer(state, { type: "hydrate", response: { partnerFavoriteStateById: { a: false } } });
  assert.equal(state.favorites.a, true);
  state = homeState.homePartnerStateReducer(state, { type: "pending", partnerId: "a", pending: true });
  state = homeState.homePartnerStateReducer(state, { type: "favorite", partnerId: "a", favorite: false });
  // Duplicate pending notifications must not replace the original snapshot.
  state = homeState.homePartnerStateReducer(state, { type: "pending", partnerId: "a", pending: true });
  state = homeState.homePartnerStateReducer(state, { type: "pending", partnerId: "b", pending: true });
  state = homeState.homePartnerStateReducer(state, { type: "favorite", partnerId: "b", favorite: true, count: 3 });
  state = homeState.homePartnerStateReducer(state, { type: "pending", partnerId: "a", pending: false, outcome: "failure" });
  assert.equal(state.favorites.a, true);
  assert.equal(state.popularity.a?.favoriteCount, 8);
  assert.ok(state.loadedIds.has("a"));
  assert.ok(state.locallyChangedIds.has("a"));
  assert.equal(state.favorites.b, true);
  assert.equal(state.popularity.b?.favoriteCount, 3);
  assert.ok(state.pendingIds.has("b"));
  state = homeState.homePartnerStateReducer(state, { type: "hydrate", response: { partnerFavoriteStateById: { a: false } } });
  assert.equal(state.favorites.a, true);
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
