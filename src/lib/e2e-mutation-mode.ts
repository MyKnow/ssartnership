type RuntimeEnvironment = {
  readonly NODE_ENV?: string;
  readonly E2E_MOCK_MUTATIONS?: string;
};

/**
 * Keeps destructive E2E submissions local to the Playwright development server.
 * Production builds ignore the flag even if it is configured accidentally.
 */
export function isE2eMockMutationEnabled(
  environment: RuntimeEnvironment = process.env,
) {
  return (
    environment.NODE_ENV !== "production" &&
    environment.E2E_MOCK_MUTATIONS === "1"
  );
}
