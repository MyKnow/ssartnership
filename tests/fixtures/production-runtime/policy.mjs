/**
 * Synthetic production-runtime E2E only; forbidden in normal compiler graphs.
 * Callers retain their existing mock-provider and individual fixture flags.
 * @param {{ NODE_ENV?: string }} environment
 */
export function allowsLocalFixtures(environment) {
  return environment.NODE_ENV === "production";
}
