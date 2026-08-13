type ActivityLogRuntimeEnvironment = {
  NODE_ENV?: string;
  E2E_MOCK_MUTATIONS?: string;
  NEXT_PUBLIC_DATA_SOURCE?: string;
};

export function shouldBypassActivityLogPersistence(
  environment: ActivityLogRuntimeEnvironment = process.env,
) {
  return (
    environment.NODE_ENV !== "production"
    && environment.E2E_MOCK_MUTATIONS === "1"
    && environment.NEXT_PUBLIC_DATA_SOURCE === "mock"
  );
}
