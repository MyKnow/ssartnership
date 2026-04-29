export type PartnerSetupSchemaCapabilities = {
  supportsPlainToken: boolean;
  supportsHash: boolean;
  supportsExpiry: boolean;
};

export function isMissingPartnerSetupSchemaColumn(
  errorMessage: string,
  columnName: string,
) {
  return errorMessage.includes(`'${columnName}'`);
}

export function hasMissingPartnerSetupSchemaColumnError(errorMessage: string) {
  return (
    isMissingPartnerSetupSchemaColumn(errorMessage, "initial_setup_token") ||
    isMissingPartnerSetupSchemaColumn(errorMessage, "initial_setup_token_hash") ||
    isMissingPartnerSetupSchemaColumn(errorMessage, "initial_setup_expires_at")
  );
}

export function resolvePartnerSetupSchemaCapabilitiesFromError(
  errorMessage: string,
): PartnerSetupSchemaCapabilities {
  return {
    supportsPlainToken: !isMissingPartnerSetupSchemaColumn(errorMessage, "initial_setup_token"),
    supportsHash: !isMissingPartnerSetupSchemaColumn(errorMessage, "initial_setup_token_hash"),
    supportsExpiry: !isMissingPartnerSetupSchemaColumn(errorMessage, "initial_setup_expires_at"),
  };
}

export function resolvePartnerSetupSchemaCapabilitiesFromAccount(account: {
  initial_setup_token?: string | null;
  initial_setup_token_hash?: string | null;
  initial_setup_expires_at?: string | null;
}) {
  return {
    supportsPlainToken: "initial_setup_token" in account,
    supportsHash: "initial_setup_token_hash" in account,
    supportsExpiry: "initial_setup_expires_at" in account,
  } satisfies PartnerSetupSchemaCapabilities;
}

export function buildPartnerSetupSelect(
  baseSelect: string,
  capabilities: PartnerSetupSchemaCapabilities,
) {
  const columns = [
    baseSelect,
    capabilities.supportsHash ? "initial_setup_token_hash" : "initial_setup_token",
    "initial_setup_link_sent_at",
    capabilities.supportsExpiry ? "initial_setup_expires_at" : null,
    "updated_at",
  ].filter(Boolean);

  return columns.join(",");
}

export function buildPartnerSetupCompletionPayload<T extends Record<string, unknown>>(
  commonPayload: T,
  capabilities: PartnerSetupSchemaCapabilities,
) {
  return {
    ...commonPayload,
    ...(capabilities.supportsPlainToken ? { initial_setup_token: null } : {}),
    ...(capabilities.supportsHash ? { initial_setup_token_hash: null } : {}),
    ...(capabilities.supportsExpiry ? { initial_setup_expires_at: null } : {}),
  };
}

export function buildPartnerSetupIssuePayload(
  basePayload: {
    initial_setup_link_sent_at: string | null;
    must_change_password: boolean;
    email_verified_at: string | null;
    updated_at: string;
  },
  values: {
    setupToken: string;
    setupTokenHash: string;
    expiresAt: string;
  },
  capabilities: PartnerSetupSchemaCapabilities,
) {
  return {
    ...basePayload,
    ...(capabilities.supportsHash
      ? { initial_setup_token_hash: values.setupTokenHash }
      : capabilities.supportsPlainToken
        ? { initial_setup_token: values.setupToken }
        : {}),
    ...(capabilities.supportsExpiry ? { initial_setup_expires_at: values.expiresAt } : {}),
  };
}

export function getPartnerSetupLookupPlans(baseSelect: string) {
  return [
    {
      label: "hash+expiry",
      capabilities: {
        supportsPlainToken: false,
        supportsHash: true,
        supportsExpiry: true,
      } satisfies PartnerSetupSchemaCapabilities,
      matchColumn: "initial_setup_token_hash",
      usesHashedToken: true,
    },
    {
      label: "hash",
      capabilities: {
        supportsPlainToken: false,
        supportsHash: true,
        supportsExpiry: false,
      } satisfies PartnerSetupSchemaCapabilities,
      matchColumn: "initial_setup_token_hash",
      usesHashedToken: true,
    },
    {
      label: "plain+expiry",
      capabilities: {
        supportsPlainToken: true,
        supportsHash: false,
        supportsExpiry: true,
      } satisfies PartnerSetupSchemaCapabilities,
      matchColumn: "initial_setup_token",
      usesHashedToken: false,
    },
    {
      label: "plain",
      capabilities: {
        supportsPlainToken: true,
        supportsHash: false,
        supportsExpiry: false,
      } satisfies PartnerSetupSchemaCapabilities,
      matchColumn: "initial_setup_token",
      usesHashedToken: false,
    },
  ].map((plan) => ({
    ...plan,
    select: buildPartnerSetupSelect(baseSelect, plan.capabilities),
  }));
}
