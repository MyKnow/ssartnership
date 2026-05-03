import nodemailer from "nodemailer";

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromEmail: string;
  tlsMinDhSize?: number;
  tlsCiphers?: string;
};

type SmtpConfigErrorInput = {
  code: "smtp_missing_env" | "smtp_incomplete_env" | "smtp_invalid_env";
  mode: "generic" | "legacy" | "unknown";
  missingEnv?: string[];
  invalidEnv?: string;
  message: string;
};

export class SmtpConfigError extends Error {
  code: SmtpConfigErrorInput["code"];
  mode: SmtpConfigErrorInput["mode"];
  missingEnv: string[];
  invalidEnv?: string;

  constructor(input: SmtpConfigErrorInput) {
    super(input.message);
    this.name = "SmtpConfigError";
    this.code = input.code;
    this.mode = input.mode;
    this.missingEnv = input.missingEnv ?? [];
    this.invalidEnv = input.invalidEnv;
  }
}

function parseSmtpPort(value?: string) {
  if (!value) {
    return 465;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0) {
    throw new SmtpConfigError({
      code: "smtp_invalid_env",
      mode: "generic",
      invalidEnv: "SMTP_PORT",
      message: "SMTP_PORT 설정이 올바르지 않습니다.",
    });
  }

  return port;
}

function parseSmtpSecure(value: string | undefined, port: number) {
  if (!value) {
    return port === 465;
  }

  return value.trim().toLowerCase() !== "false";
}

function parseOptionalPositiveInteger(value: string | undefined, name: string) {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new SmtpConfigError({
      code: "smtp_invalid_env",
      mode: "unknown",
      invalidEnv: name,
      message: `${name} 설정이 올바르지 않습니다.`,
    });
  }

  return parsed;
}

function hasAnyValue(values: Array<string | undefined>) {
  return values.some((value) => Boolean(value?.trim()));
}

function getMissingEnv(requiredEnv: Record<string, string | undefined>) {
  return Object.entries(requiredEnv)
    .filter(([, value]) => !value?.trim())
    .map(([name]) => name);
}

export function toSmtpConfigErrorLog(error: unknown) {
  if (error instanceof SmtpConfigError) {
    return {
      code: error.code,
      mode: error.mode,
      missingEnv: error.missingEnv,
      invalidEnv: error.invalidEnv,
      message: error.message,
    };
  }

  return {
    code: "smtp_unknown_config_error",
    mode: "unknown",
    message: error instanceof Error ? error.message : String(error),
  };
}

export function getSmtpConfig(env: NodeJS.ProcessEnv = process.env): SmtpConfig {
  const hasGenericSmtpConfig = hasAnyValue([
    env.SMTP_HOST,
    env.SMTP_PORT,
    env.SMTP_SECURE,
    env.SMTP_USER,
    env.SMTP_PASS,
    env.SMTP_FROM_EMAIL,
  ]);

  if (hasGenericSmtpConfig) {
    const port = parseSmtpPort(env.SMTP_PORT);
    const secure = parseSmtpSecure(env.SMTP_SECURE, port);
    const fromEmailValue = env.SMTP_FROM_EMAIL ?? env.SMTP_USER;
    const tlsMinDhSize = parseOptionalPositiveInteger(
      env.SMTP_TLS_MIN_DH_SIZE,
      "SMTP_TLS_MIN_DH_SIZE",
    );
    const tlsCiphers = env.SMTP_TLS_CIPHERS;
    const missingEnv = getMissingEnv({
      SMTP_HOST: env.SMTP_HOST,
      SMTP_USER: env.SMTP_USER,
      SMTP_PASS: env.SMTP_PASS,
      SMTP_FROM_EMAIL: fromEmailValue,
    });

    if (missingEnv.length > 0) {
      throw new SmtpConfigError({
        code: "smtp_incomplete_env",
        mode: "generic",
        missingEnv,
        message: "SMTP 설정이 불완전합니다.",
      });
    }

    const host = env.SMTP_HOST!;
    const user = env.SMTP_USER!;
    const pass = env.SMTP_PASS!;
    const fromEmail = fromEmailValue!;

    return {
      host,
      port,
      secure,
      user,
      pass,
      fromEmail,
      ...(tlsMinDhSize ? { tlsMinDhSize } : {}),
      ...(tlsCiphers ? { tlsCiphers } : {}),
    };
  }

  const port = 465;
  const secure = true;
  const fromEmailValue = env.NAVER_SMTP_USER;
  const tlsMinDhSize = parseOptionalPositiveInteger(
    env.SMTP_TLS_MIN_DH_SIZE,
    "SMTP_TLS_MIN_DH_SIZE",
  );
  const tlsCiphers = env.SMTP_TLS_CIPHERS;
  const missingEnv = getMissingEnv({
    NAVER_SMTP_USER: env.NAVER_SMTP_USER,
    NAVER_SMTP_PASS: env.NAVER_SMTP_PASS,
  });

    if (missingEnv.length > 0) {
      throw new SmtpConfigError({
        code: "smtp_missing_env",
        mode: "legacy",
        missingEnv,
        message: "메일 설정이 누락되었습니다.",
      });
    }

  const user = env.NAVER_SMTP_USER!;
  const pass = env.NAVER_SMTP_PASS!;
  const fromEmail = fromEmailValue!;

  return {
    host: "smtp.naver.com",
    port,
    secure,
    user,
    pass,
    fromEmail,
    ...(tlsMinDhSize ? { tlsMinDhSize } : {}),
    ...(tlsCiphers ? { tlsCiphers } : {}),
  };
}

export function createSmtpTransport(config = getSmtpConfig()) {
  const tls =
    config.tlsMinDhSize || config.tlsCiphers
      ? {
          ...(config.tlsMinDhSize ? { minDHSize: config.tlsMinDhSize } : {}),
          ...(config.tlsCiphers ? { ciphers: config.tlsCiphers } : {}),
        }
      : undefined;

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    ...(tls ? { tls } : {}),
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
}
