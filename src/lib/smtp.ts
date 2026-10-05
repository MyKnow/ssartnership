import nodemailer from "nodemailer";
import { warnDeprecatedEnvironmentAlias } from "@/lib/env-deprecation";

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

export function getSmtpConfig(
  env: Partial<NodeJS.ProcessEnv> = process.env,
): SmtpConfig {
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
  if (env.NAVER_SMTP_USER?.trim()) warnDeprecatedEnvironmentAlias("NAVER_SMTP_USER");
  if (env.NAVER_SMTP_PASS?.trim()) warnDeprecatedEnvironmentAlias("NAVER_SMTP_PASS");
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

export type SmtpTimeouts = Readonly<{
  /**
   * DNS 질의 시도 1회 상한. Node resolver는 기본 4회 시도하며 시도마다 대기를
   * 두 배로 늘리므로, 응답하지 않는 DNS 서버 앞에서는 IPv4·IPv6 해석이 각각
   * 이 값의 약 15배까지 걸릴 수 있다. 해석 실패는 `EDNS`로 보고된다.
   */
  dnsTimeoutMs: number;
  /** TCP(및 implicit TLS) 연결 수립 상한. */
  connectionTimeoutMs: number;
  /** 연결 후 SMTP 220 인사 수신 상한. */
  greetingTimeoutMs: number;
  /** 연결된 소켓의 무응답(유휴) 상한. 전송 전체 시간이 아니라 정지 구간을 끊는다. */
  socketTimeoutMs: number;
}>;

/**
 * nodemailer 기본값(DNS 30초·연결 2분·인사 30초·소켓 10분)은 요청 처리와
 * cron 상한(60~70초)보다 길어, 메일 서버 장애가 사용자 요청을 오래 붙잡는다.
 * 외부 호출 상한 규약(docs/operations/reliability.md)에 맞춘 고정값이다.
 */
export const SMTP_TIMEOUTS: SmtpTimeouts = Object.freeze({
  dnsTimeoutMs: 5_000,
  connectionTimeoutMs: 10_000,
  greetingTimeoutMs: 10_000,
  socketTimeoutMs: 20_000,
});

export function buildSmtpTransportOptions(
  config: SmtpConfig,
  timeouts: SmtpTimeouts = SMTP_TIMEOUTS,
) {
  const tls =
    config.tlsMinDhSize || config.tlsCiphers
      ? {
          ...(config.tlsMinDhSize ? { minDHSize: config.tlsMinDhSize } : {}),
          ...(config.tlsCiphers ? { ciphers: config.tlsCiphers } : {}),
        }
      : undefined;

  return {
    host: config.host,
    port: config.port,
    secure: config.secure,
    ...(tls ? { tls } : {}),
    auth: {
      user: config.user,
      pass: config.pass,
    },
    dnsTimeout: timeouts.dnsTimeoutMs,
    connectionTimeout: timeouts.connectionTimeoutMs,
    greetingTimeout: timeouts.greetingTimeoutMs,
    socketTimeout: timeouts.socketTimeoutMs,
  };
}

export function createSmtpTransport(
  config = getSmtpConfig(),
  timeouts: SmtpTimeouts = SMTP_TIMEOUTS,
) {
  return nodemailer.createTransport(buildSmtpTransportOptions(config, timeouts));
}
