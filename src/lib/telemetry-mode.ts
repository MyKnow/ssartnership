/**
 * Self-hosted Web Vitals are the only browser performance telemetry. Mock
 * builds (E2E, Storybook, local demos) never mount the collector.
 */
export function shouldLoadSelfHostedTelemetry(environment: {
  NEXT_PUBLIC_DATA_SOURCE?: string;
}) {
  return environment.NEXT_PUBLIC_DATA_SOURCE === "supabase";
}
