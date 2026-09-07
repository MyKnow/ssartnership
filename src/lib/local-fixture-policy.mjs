/**
 * The deployable policy. Runtime E2E flags never unlock production fixtures.
 * Only the isolated test compiler may replace this module, never this check.
 * @param {{ NODE_ENV?: string }} environment
 */
export function allowsLocalFixtures(environment) {
  return environment.NODE_ENV !== "production";
}
