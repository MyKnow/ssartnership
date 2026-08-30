export type RuntimeDataAccessCapability = "public" | "admin";

export type RuntimeDataAccessSource = "mock" | "supabase" | "unavailable";

export type RuntimeDataAccessEnvironment = {
  [key: string]: string | undefined;
  NEXT_PUBLIC_DATA_SOURCE?: string;
  NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

export type RuntimeDataAccessSelection = {
  capability: RuntimeDataAccessCapability;
  source: RuntimeDataAccessSource;
  reason:
    | "invalid_data_source"
    | "missing_credentials"
    | "unsupported_capability"
    | null;
};

type RuntimeDataAccessSourcePreference = "default" | "partner-portal";

type SelectRuntimeDataAccessInput = {
  capability: RuntimeDataAccessCapability;
  environment?: RuntimeDataAccessEnvironment;
  sourcePreference?: RuntimeDataAccessSourcePreference;
};

function hasText(value: string | undefined) {
  return Boolean(value?.trim());
}

function hasCapabilityCredentials(
  capability: RuntimeDataAccessCapability,
  environment: RuntimeDataAccessEnvironment,
) {
  if (!hasText(environment.SUPABASE_URL)) {
    return false;
  }

  if (capability === "admin") {
    return hasText(environment.SUPABASE_SERVICE_ROLE_KEY);
  }

  return (
    hasText(environment.SUPABASE_ANON_KEY) ||
    hasText(environment.SUPABASE_SERVICE_ROLE_KEY)
  );
}

function getConfiguredDataSource(
  environment: RuntimeDataAccessEnvironment,
  sourcePreference: RuntimeDataAccessSourcePreference,
) {
  if (
    sourcePreference === "partner-portal" &&
    environment.NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE !== undefined
  ) {
    return environment.NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE.trim();
  }

  return environment.NEXT_PUBLIC_DATA_SOURCE?.trim();
}

export function selectRuntimeDataAccess({
  capability,
  environment = process.env,
  sourcePreference = "default",
}: SelectRuntimeDataAccessInput): RuntimeDataAccessSelection {
  const configuredDataSource = getConfiguredDataSource(
    environment,
    sourcePreference,
  );

  if (configuredDataSource === "mock") {
    return { capability, source: "mock", reason: null };
  }

  if (
    configuredDataSource !== undefined &&
    configuredDataSource !== "supabase"
  ) {
    return {
      capability,
      source: "unavailable",
      reason: "invalid_data_source",
    };
  }

  if (hasCapabilityCredentials(capability, environment)) {
    return { capability, source: "supabase", reason: null };
  }

  return {
    capability,
    source: "unavailable",
    reason: "missing_credentials",
  };
}

export class RuntimeDataAccessUnavailableError extends Error {
  readonly code = "runtime_data_access_unavailable" as const;
  readonly capability: RuntimeDataAccessCapability;

  constructor(
    selection: RuntimeDataAccessSelection,
    message = "데이터 저장소를 사용할 수 없습니다.",
  ) {
    super(message);
    this.name = "RuntimeDataAccessUnavailableError";
    this.capability = selection.capability;
  }
}

export function assertRuntimeDataAccessAvailable(
  selection: RuntimeDataAccessSelection,
  message?: string,
) {
  if (selection.source === "unavailable") {
    throw new RuntimeDataAccessUnavailableError(selection, message);
  }
}

export function createUnavailableDataAccessProxy<T extends object>(
  selection: RuntimeDataAccessSelection,
  message?: string,
): T {
  const rejectUnavailableOperation = () =>
    Promise.reject(new RuntimeDataAccessUnavailableError(selection, message));

  return new Proxy({} as T, {
    get(_target, property) {
      if (property === Symbol.toStringTag) {
        return "UnavailableDataAccess";
      }
      if (property === "then") {
        return undefined;
      }
      return rejectUnavailableOperation;
    },
  });
}
