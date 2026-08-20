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
    environment.NODE_ENV !== "production" &&
    environment.E2E_MOCK_MUTATIONS === "1" &&
    environment.NEXT_PUBLIC_DATA_SOURCE === "mock"
  );
}

export function shouldBypassProductEventTransport(
  environment: ProductEventTransportEnvironment,
) {
  return (
    environment.NODE_ENV !== "production" &&
    environment.NEXT_PUBLIC_DATA_SOURCE === "mock"
  );
}
