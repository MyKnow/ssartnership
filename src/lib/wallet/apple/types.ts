export const APPLE_WALLET_CONFIG_CODES = [
  "ok",
  "disabled",
  "missing_env",
  "invalid_env",
] as const;

export type AppleWalletConfigCode = (typeof APPLE_WALLET_CONFIG_CODES)[number];

export type AppleWalletPassInput = {
  serialNumber: string;
  authenticationToken: string;
  verificationUrl: string;
  displayName: string;
  generationLabel: string;
  campusLabel: string;
  roleLabel: string;
  updatedAt: Date | string;
  voided?: boolean;
};

export type AppleWalletConfig = {
  enabled: true;
  teamIdentifier: string;
  passTypeIdentifier: string;
  organizationName: string;
  siteUrl: string;
  wwdr: Buffer;
  signerCert: Buffer;
  signerKey: Buffer;
  /**
   * Long-lived Wallet master key. Each token/hash purpose must derive its own
   * domain-separated subkey before use.
   */
  deviceTokenEncryptionKey: Buffer;
  signerKeyPassphrase?: string;
};

type AppleWalletBaseStatus = {
  code: AppleWalletConfigCode;
  enabled: boolean;
  message: string;
};

export type AppleWalletConfigOkStatus = AppleWalletBaseStatus & {
  code: "ok";
  enabled: true;
  ok: true;
  config: AppleWalletConfig;
};

export type AppleWalletConfigErrorStatus = AppleWalletBaseStatus & {
  code: "disabled" | "missing_env" | "invalid_env";
  ok: false;
  missingEnv?: string[];
  invalidEnv?: string;
};

export type AppleWalletConfigStatus =
  | AppleWalletConfigOkStatus
  | AppleWalletConfigErrorStatus;

export type AppleWalletPassErrorCode =
  | "wallet_disabled"
  | "wallet_config_invalid"
  | "wallet_pass_build_failed";
