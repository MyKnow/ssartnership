type ActivityLogRuntimeEnvironment = {
  NODE_ENV?: string;
  E2E_MOCK_MUTATIONS?: string;
  NEXT_PUBLIC_DATA_SOURCE?: string;
};

type ProductEventTransportEnvironment = Pick<
  ActivityLogRuntimeEnvironment,
  "NODE_ENV" | "NEXT_PUBLIC_DATA_SOURCE"
>;

export function shouldBypassActivityLogPersistence(
  environment: ActivityLogRuntimeEnvironment = process.env,
) {
  return (
    environment.NODE_ENV !== "production"
    && environment.E2E_MOCK_MUTATIONS === "1"
    && environment.NEXT_PUBLIC_DATA_SOURCE === "mock"
  );
}

/**
 * The browser-side mock application has no durable analytics sink. Avoid
 * opening keepalive requests that can outlive a short Playwright page while
 * leaving every Production and Supabase-backed runtime unchanged.
 */
export function shouldBypassProductEventTransport(
  environment: ProductEventTransportEnvironment,
) {
  return (
    environment.NODE_ENV !== "production"
    && environment.NEXT_PUBLIC_DATA_SOURCE === "mock"
  );
}
