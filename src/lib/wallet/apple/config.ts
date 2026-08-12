import type {
  AppleWalletConfig,
  AppleWalletConfigStatus,
} from "./types";

const ENABLED_ENV_NAME = "APPLE_WALLET_ENABLED";
const TEAM_ID_ENV_NAME = "APPLE_WALLET_TEAM_ID";
const PASS_TYPE_ID_ENV_NAME = "APPLE_WALLET_PASS_TYPE_ID";
const ORGANIZATION_NAME_ENV_NAME = "APPLE_WALLET_ORGANIZATION_NAME";
const CERTIFICATE_ENV_NAME = "APPLE_WALLET_CERTIFICATE_BASE64";
const PRIVATE_KEY_ENV_NAME = "APPLE_WALLET_PRIVATE_KEY_BASE64";
const PRIVATE_KEY_PASSPHRASE_ENV_NAME = "APPLE_WALLET_PRIVATE_KEY_PASSPHRASE";
const WWDR_ENV_NAME = "APPLE_WALLET_WWDR_CERTIFICATE_BASE64";
const DEVICE_TOKEN_ENCRYPTION_KEY_ENV_NAME =
  "APPLE_WALLET_DEVICE_TOKEN_ENCRYPTION_KEY_BASE64";
const SITE_URL_ENV_NAME = "NEXT_PUBLIC_SITE_URL";

const REQUIRED_ENV_NAMES = [
  TEAM_ID_ENV_NAME,
  PASS_TYPE_ID_ENV_NAME,
  ORGANIZATION_NAME_ENV_NAME,
  CERTIFICATE_ENV_NAME,
  PRIVATE_KEY_ENV_NAME,
  WWDR_ENV_NAME,
  DEVICE_TOKEN_ENCRYPTION_KEY_ENV_NAME,
  SITE_URL_ENV_NAME,
] as const;

function parseEnabled(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function getTrimmedEnv(
  env: Partial<NodeJS.ProcessEnv>,
  name: string,
) {
  return env[name]?.trim() ?? "";
}

function getMissingEnv(
  env: Partial<NodeJS.ProcessEnv>,
  names: readonly string[],
) {
  return names.filter((name) => !getTrimmedEnv(env, name));
}

function parseBase64Buffer(name: string, value: string) {
  const normalized = value.replace(/\s+/g, "");
  if (
    normalized.length === 0 ||
    normalized.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/=]+$/.test(normalized)
  ) {
    return {
      ok: false as const,
      invalidEnv: name,
      message: `${name} 값이 올바른 Base64 형식이 아닙니다.`,
    };
  }

  try {
    const buffer = Buffer.from(normalized, "base64");
    if (buffer.length === 0) {
      throw new Error("empty buffer");
    }

    return { ok: true as const, buffer };
  } catch {
    return {
      ok: false as const,
      invalidEnv: name,
      message: `${name} 값을 디코딩하지 못했습니다.`,
    };
  }
}

export function getAppleWalletMasterKeyStatus(
  env: Partial<NodeJS.ProcessEnv> = process.env,
) {
  const value = getTrimmedEnv(env, DEVICE_TOKEN_ENCRYPTION_KEY_ENV_NAME);
  if (!value) {
    return {
      ok: false as const,
      code: "missing_env" as const,
      missingEnv: [DEVICE_TOKEN_ENCRYPTION_KEY_ENV_NAME],
      message: "Apple Wallet master key 설정이 누락되었습니다.",
    };
  }

  const parsed = parseBase64Buffer(DEVICE_TOKEN_ENCRYPTION_KEY_ENV_NAME, value);
  if (!parsed.ok || parsed.buffer.length !== 32) {
    return {
      ok: false as const,
      code: "invalid_env" as const,
      invalidEnv: DEVICE_TOKEN_ENCRYPTION_KEY_ENV_NAME,
      message: `${DEVICE_TOKEN_ENCRYPTION_KEY_ENV_NAME} 값은 정확히 32바이트 Base64여야 합니다.`,
    };
  }

  return { ok: true as const, key: parsed.buffer };
}

function parsePassTypeIdentifier(value: string) {
  return /^pass\.[A-Za-z0-9.-]+$/.test(value);
}

function isPemBuffer(buffer: Buffer, labelPattern: RegExp) {
  const value = buffer.toString("utf8");
  return labelPattern.test(value) && /-----END [A-Z ]+-----/.test(value);
}

function parseSiteUrl(siteUrl: string) {
  try {
    const url = new URL(siteUrl);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      throw new Error("invalid url");
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function getAppleWalletEnvironmentNames() {
  return {
    enabled: ENABLED_ENV_NAME,
    teamIdentifier: TEAM_ID_ENV_NAME,
    passTypeIdentifier: PASS_TYPE_ID_ENV_NAME,
    organizationName: ORGANIZATION_NAME_ENV_NAME,
    signerCertificate: CERTIFICATE_ENV_NAME,
    signerPrivateKey: PRIVATE_KEY_ENV_NAME,
    signerPrivateKeyPassphrase: PRIVATE_KEY_PASSPHRASE_ENV_NAME,
    wwdrCertificate: WWDR_ENV_NAME,
    deviceTokenEncryptionKey: DEVICE_TOKEN_ENCRYPTION_KEY_ENV_NAME,
    siteUrl: SITE_URL_ENV_NAME,
  } as const;
}

export function getAppleWalletConfigStatus(
  env: Partial<NodeJS.ProcessEnv> = process.env,
): AppleWalletConfigStatus {
  if (!parseEnabled(env[ENABLED_ENV_NAME])) {
    return {
      ok: false,
      code: "disabled",
      enabled: false,
      message: "Apple Wallet 패스 발급이 비활성화되어 있습니다.",
    };
  }

  const missingEnv = getMissingEnv(env, REQUIRED_ENV_NAMES);
  if (missingEnv.length > 0) {
    return {
      ok: false,
      code: "missing_env",
      enabled: true,
      missingEnv,
      message: "Apple Wallet 설정이 누락되었습니다.",
    };
  }

  const teamIdentifier = getTrimmedEnv(env, TEAM_ID_ENV_NAME);
  const passTypeIdentifier = getTrimmedEnv(env, PASS_TYPE_ID_ENV_NAME);
  const organizationName = getTrimmedEnv(env, ORGANIZATION_NAME_ENV_NAME);
  const signerCertificateValue = getTrimmedEnv(env, CERTIFICATE_ENV_NAME);
  const signerPrivateKeyValue = getTrimmedEnv(env, PRIVATE_KEY_ENV_NAME);
  const wwdrValue = getTrimmedEnv(env, WWDR_ENV_NAME);
  const signerKeyPassphrase = getTrimmedEnv(env, PRIVATE_KEY_PASSPHRASE_ENV_NAME);
  const siteUrl = parseSiteUrl(getTrimmedEnv(env, SITE_URL_ENV_NAME));

  if (!/^[A-Z0-9]+$/.test(teamIdentifier)) {
    return {
      ok: false,
      code: "invalid_env",
      enabled: true,
      invalidEnv: TEAM_ID_ENV_NAME,
      message: `${TEAM_ID_ENV_NAME} 형식을 확인해 주세요.`,
    };
  }

  if (!parsePassTypeIdentifier(passTypeIdentifier)) {
    return {
      ok: false,
      code: "invalid_env",
      enabled: true,
      invalidEnv: PASS_TYPE_ID_ENV_NAME,
      message: `${PASS_TYPE_ID_ENV_NAME} 형식을 확인해 주세요.`,
    };
  }

  if (organizationName.length === 0) {
    return {
      ok: false,
      code: "invalid_env",
      enabled: true,
      invalidEnv: ORGANIZATION_NAME_ENV_NAME,
      message: `${ORGANIZATION_NAME_ENV_NAME} 값을 확인해 주세요.`,
    };
  }

  if (!siteUrl) {
    return {
      ok: false,
      code: "invalid_env",
      enabled: true,
      invalidEnv: SITE_URL_ENV_NAME,
      message: "NEXT_PUBLIC_SITE_URL 형식을 확인해 주세요.",
    };
  }

  const signerCert = parseBase64Buffer(
    CERTIFICATE_ENV_NAME,
    signerCertificateValue,
  );
  if (!signerCert.ok) {
    return {
      ok: false,
      code: "invalid_env",
      enabled: true,
      invalidEnv: signerCert.invalidEnv,
      message: signerCert.message,
    };
  }
  if (!isPemBuffer(signerCert.buffer, /-----BEGIN CERTIFICATE-----/)) {
    return {
      ok: false,
      code: "invalid_env",
      enabled: true,
      invalidEnv: CERTIFICATE_ENV_NAME,
      message: `${CERTIFICATE_ENV_NAME} 값은 PEM 인증서여야 합니다.`,
    };
  }

  const signerKey = parseBase64Buffer(PRIVATE_KEY_ENV_NAME, signerPrivateKeyValue);
  if (!signerKey.ok) {
    return {
      ok: false,
      code: "invalid_env",
      enabled: true,
      invalidEnv: signerKey.invalidEnv,
      message: signerKey.message,
    };
  }
  if (
    !isPemBuffer(
      signerKey.buffer,
      /-----BEGIN (?:(?:RSA|EC|ENCRYPTED) )?PRIVATE KEY-----/,
    )
  ) {
    return {
      ok: false,
      code: "invalid_env",
      enabled: true,
      invalidEnv: PRIVATE_KEY_ENV_NAME,
      message: `${PRIVATE_KEY_ENV_NAME} 값은 PEM 개인 키여야 합니다.`,
    };
  }

  const wwdr = parseBase64Buffer(WWDR_ENV_NAME, wwdrValue);
  if (!wwdr.ok) {
    return {
      ok: false,
      code: "invalid_env",
      enabled: true,
      invalidEnv: wwdr.invalidEnv,
      message: wwdr.message,
    };
  }
  if (!isPemBuffer(wwdr.buffer, /-----BEGIN CERTIFICATE-----/)) {
    return {
      ok: false,
      code: "invalid_env",
      enabled: true,
      invalidEnv: WWDR_ENV_NAME,
      message: `${WWDR_ENV_NAME} 값은 PEM 인증서여야 합니다.`,
    };
  }

  const masterKeyStatus = getAppleWalletMasterKeyStatus(env);
  if (!masterKeyStatus.ok) {
    return {
      ok: false,
      code: masterKeyStatus.code,
      enabled: true,
      ...(masterKeyStatus.code === "missing_env"
        ? { missingEnv: masterKeyStatus.missingEnv }
        : { invalidEnv: masterKeyStatus.invalidEnv }),
      message: masterKeyStatus.message,
    };
  }

  const config: AppleWalletConfig = {
    enabled: true,
    teamIdentifier,
    passTypeIdentifier,
    organizationName,
    siteUrl,
    wwdr: wwdr.buffer,
    signerCert: signerCert.buffer,
    signerKey: signerKey.buffer,
    deviceTokenEncryptionKey: masterKeyStatus.key,
    ...(signerKeyPassphrase ? { signerKeyPassphrase } : {}),
  };

  return {
    ok: true,
    code: "ok",
    enabled: true,
    message: "Apple Wallet 설정을 사용할 수 있습니다.",
    config,
  };
}
