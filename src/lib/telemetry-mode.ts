export function shouldLoadSelfHostedTelemetry(environment: {
  VERCEL?: string;
  NEXT_PUBLIC_DATA_SOURCE?: string;
}) {
  return environment.VERCEL !== "1"
    && environment.NEXT_PUBLIC_DATA_SOURCE === "supabase";
}
