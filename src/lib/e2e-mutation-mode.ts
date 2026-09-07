import { allowsLocalFixtures } from "@/lib/local-fixture-policy.mjs";

type RuntimeEnvironment = {
  readonly NODE_ENV?: string;
  readonly E2E_MOCK_MUTATIONS?: string;
};

/**
 * Keeps destructive E2E submissions local to the isolated Playwright fixture.
 * Production builds ignore the flag even if it is configured accidentally.
 */
export function isE2eMockMutationEnabled(
  environment: RuntimeEnvironment = process.env,
) {
  return (
    allowsLocalFixtures(environment) &&
    environment.E2E_MOCK_MUTATIONS === "1"
  );
}
