import assert from "node:assert/strict";
import test from "node:test";

type E2eModeModule = typeof import("../src/lib/e2e-mutation-mode");

const modulePromise = import(
  new URL("../src/lib/e2e-mutation-mode.ts", import.meta.url).href
) as Promise<E2eModeModule>;

test("E2E mock mutations require an explicit non-production opt-in", async () => {
  const { isE2eMockMutationEnabled } = await modulePromise;

  assert.equal(
    isE2eMockMutationEnabled({
      NODE_ENV: "development",
      E2E_MOCK_MUTATIONS: "1",
    }),
    true,
  );
  assert.equal(
    isE2eMockMutationEnabled({
      NODE_ENV: "test",
      E2E_MOCK_MUTATIONS: "1",
    }),
    true,
  );
  assert.equal(
    isE2eMockMutationEnabled({
      NODE_ENV: "development",
      E2E_MOCK_MUTATIONS: "0",
    }),
    false,
  );
  assert.equal(
    isE2eMockMutationEnabled({
      NODE_ENV: "production",
      E2E_MOCK_MUTATIONS: "1",
    }),
    false,
  );
});
