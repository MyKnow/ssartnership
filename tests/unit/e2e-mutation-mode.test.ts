import { describe, expect, it } from "vitest";
import { isE2eMockMutationEnabled } from "@/lib/e2e-mutation-mode";

describe("isE2eMockMutationEnabled", () => {
  it("requires an explicit non-production opt-in", () => {
    expect(
      isE2eMockMutationEnabled({
        NODE_ENV: "development",
        E2E_MOCK_MUTATIONS: "1",
      }),
    ).toBe(true);
    expect(
      isE2eMockMutationEnabled({
        NODE_ENV: "test",
        E2E_MOCK_MUTATIONS: "1",
      }),
    ).toBe(true);
    expect(
      isE2eMockMutationEnabled({
        NODE_ENV: "production",
        E2E_MOCK_MUTATIONS: "1",
      }),
    ).toBe(false);
    expect(
      isE2eMockMutationEnabled({
        NODE_ENV: "development",
        E2E_MOCK_MUTATIONS: "0",
      }),
    ).toBe(false);
  });
});
