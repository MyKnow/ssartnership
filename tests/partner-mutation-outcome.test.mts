import assert from "node:assert/strict";
import test from "node:test";
import { awaitPartnerMutation, PartnerMutationOutcomeUnknownError, requirePartnerMutationReceipt, requirePartnerMutationRow } from "../src/lib/partner-admin/mutation-outcome.ts";

test("mutation await rejection keeps the original cause and fixed stage", async () => {
  const cause = new TypeError("fixture connection closed");
  await assert.rejects(awaitPartnerMutation(Promise.reject(cause), "company_insert"), (error: unknown) => {
    assert.ok(error instanceof PartnerMutationOutcomeUnknownError);
    assert.equal(error.cause, cause);
    assert.equal(error.stage, "company_insert");
    assert.equal(error.message, "partner_mutation_outcome_unknown");
    return true;
  });
});

test("cleanup receipt must contain each expected identity exactly once", () => {
  const expected = [{ id: "one" }, { id: "two" }];
  assert.doesNotThrow(() => requirePartnerMutationReceipt([{ id: "two" }, { id: "one" }], expected, "cleanup"));
  for (const receipt of [null, [], [{ id: "one" }], [{ id: "one" }, { id: "other" }], [{ id: "one" }, { id: "one" }]]) {
    assert.throws(() => requirePartnerMutationReceipt(receipt, expected, "cleanup"), PartnerMutationOutcomeUnknownError);
  }
});

test("account restore receipt must confirm every saved field, not only its id", () => {
  const expected = { id: "account", display_name: "previous", email: null, is_active: false };
  assert.doesNotThrow(() => requirePartnerMutationReceipt([expected], [expected], "restore"));
  for (const receipt of [{ id: "account" }, { ...expected, display_name: "current" }, { ...expected, is_active: true }, { ...expected, email: "current@example.invalid" }]) {
    assert.throws(() => requirePartnerMutationReceipt([receipt], [expected], "restore"), PartnerMutationOutcomeUnknownError);
  }
});

test("single mutation receipt requires a nonempty generated ID and the stored keys", () => {
  const expected = { name: "fixture" };
  assert.doesNotThrow(() => requirePartnerMutationRow({ id: "generated", ...expected }, expected, "insert"));
  for (const receipt of [null, [], {}, { id: "" }, { id: " " }, { id: "generated" }, { id: "generated", name: "other" }]) {
    assert.throws(() => requirePartnerMutationRow(receipt, expected, "insert"), PartnerMutationOutcomeUnknownError);
  }
  assert.throws(() => requirePartnerMutationRow({ id: "other" }, { id: "expected" }, "update"), PartnerMutationOutcomeUnknownError);
});

test("SDK status identifies uncertainty without interpreting provider messages", async () => {
  for (const status of [0, 500, 502, 503, 504]) {
    await assert.rejects(awaitPartnerMutation(Promise.resolve({ status, error: { message: "arbitrary" } }), "company_insert"), PartnerMutationOutcomeUnknownError);
  }
  for (const status of [200, 201, 204, 400, 401, 403, 404, 409, 422]) {
    const response = { status, error: status >= 400 ? { code: "23505", message: "TimeoutError: arbitrary provider text" } : null };
    assert.equal(await awaitPartnerMutation(Promise.resolve(response), "company_insert"), response);
  }
});
