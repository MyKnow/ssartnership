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

function parseSmtpPort(value?: string) {
  if (!value) {
    return 465;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("SMTP_PORT 설정이 올바르지 않습니다.");
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
    throw new Error(`${name} 설정이 올바르지 않습니다.`);
  }

  return parsed;
}

function hasAnyValue(values: Array<string | undefined>) {
  return values.some((value) => Boolean(value?.trim()));
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
    const fromEmail = env.SMTP_FROM_EMAIL ?? env.SMTP_USER;
    const tlsMinDhSize = parseOptionalPositiveInteger(
      env.SMTP_TLS_MIN_DH_SIZE,
      "SMTP_TLS_MIN_DH_SIZE",
    );
    const tlsCiphers = env.SMTP_TLS_CIPHERS;

    if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS || !fromEmail) {
      throw new Error("SMTP 설정이 불완전합니다.");
    }

    return {
      host: env.SMTP_HOST,
      port,
      secure,
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
      fromEmail,
      ...(tlsMinDhSize ? { tlsMinDhSize } : {}),
      ...(tlsCiphers ? { tlsCiphers } : {}),
    };
  }

  const port = 465;
  const secure = true;
  const fromEmail = env.NAVER_SMTP_USER;
  const tlsMinDhSize = parseOptionalPositiveInteger(
    env.SMTP_TLS_MIN_DH_SIZE,
    "SMTP_TLS_MIN_DH_SIZE",
  );
  const tlsCiphers = env.SMTP_TLS_CIPHERS;

  if (!env.NAVER_SMTP_USER || !env.NAVER_SMTP_PASS || !fromEmail) {
    throw new Error("메일 설정이 누락되었습니다.");
  }

  return {
    host: "smtp.naver.com",
    port,
    secure,
    user: env.NAVER_SMTP_USER,
    pass: env.NAVER_SMTP_PASS,
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
