import { SITE_NAME } from "@/lib/site";
import {
  createSmtpTransport,
  getSmtpConfig,
  SmtpConfigError,
  type SmtpConfig,
} from "@/lib/smtp";

const RESEND_EMAIL_API_URL = "https://api.resend.com/emails";
const RESEND_REQUEST_TIMEOUT_MS = 10_000;
const EMAIL_ADDRESS_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

type EmailProvider = "resend" | "smtp";

type ResendEmailDeliveryConfig = Readonly<{
  provider: "resend";
  apiKey: string;
  from: string;
  replyTo: string;
}>;

type SmtpEmailDeliveryConfig = Readonly<{
  provider: "smtp";
  smtp: SmtpConfig;
  from: string;
  replyTo?: string;
}>;

export type EmailDeliveryConfig =
  | ResendEmailDeliveryConfig
  | SmtpEmailDeliveryConfig;

export type TransactionalEmailInput = Readonly<{
  to: string | readonly string[];
  bcc?: string | readonly string[];
  replyTo?: string;
  subject: string;
  text?: string;
  html?: string;
  idempotencyKey?: string;
  messageId?: string;
}>;

type EmailDeliveryConfigErrorInput = Readonly<{
  code:
    | "email_provider_invalid"
    | "resend_missing_env"
    | "resend_invalid_env";
  provider: EmailProvider | "unknown";
  missingEnv?: readonly string[];
  invalidEnv?: string;
  message: string;
}>;

export class EmailDeliveryConfigError extends Error {
  readonly code: EmailDeliveryConfigErrorInput["code"];
  readonly provider: EmailDeliveryConfigErrorInput["provider"];
  readonly missingEnv: readonly string[];
  readonly invalidEnv?: string;

  constructor(input: EmailDeliveryConfigErrorInput) {
    super(input.message);
    this.name = "EmailDeliveryConfigError";
    this.code = input.code;
    this.provider = input.provider;
    this.missingEnv = input.missingEnv ?? [];
    this.invalidEnv = input.invalidEnv;
  }
}

export type EmailProviderErrorCode =
  | "resend_auth_failed"
  | "resend_connection_failed"
  | "resend_provider_rate_limited"
  | "resend_recipient_rejected"
  | "resend_delivery_failed";

export class EmailProviderError extends Error {
  readonly code: EmailProviderErrorCode;
  readonly provider = "resend" as const;
  readonly status: number | null;

  constructor(code: EmailProviderErrorCode, status: number | null = null) {
    super(code);
    this.name = "EmailProviderError";
    this.code = code;
    this.status = status;
  }
}

function getMissingEnv(requiredEnv: Record<string, string | undefined>) {
  return Object.entries(requiredEnv)
    .filter(([, value]) => !value?.trim())
    .map(([name]) => name);
}

function extractAddress(value: string) {
  const trimmed = value.trim();
  const angleAddress = trimmed.match(/<([^<>]+)>$/)?.[1]?.trim();
  return angleAddress ?? trimmed;
}

function assertEmailAddress(value: string, envName: string) {
  if (!EMAIL_ADDRESS_PATTERN.test(extractAddress(value))) {
    throw new EmailDeliveryConfigError({
      code: "resend_invalid_env",
      provider: "resend",
      invalidEnv: envName,
      message: `${envName} 설정이 올바르지 않습니다.`,
    });
  }
}

export function getEmailDeliveryConfig(
  env: Partial<NodeJS.ProcessEnv> = process.env,
): EmailDeliveryConfig {
  const provider = env.EMAIL_PROVIDER?.trim().toLowerCase() || "smtp";

  if (provider === "smtp") {
    const smtp = getSmtpConfig(env);
    const replyTo = env.EMAIL_REPLY_TO?.trim();
    return {
      provider,
      smtp,
      from: `${SITE_NAME} <${smtp.fromEmail}>`,
      ...(replyTo ? { replyTo } : {}),
    };
  }

  if (provider !== "resend") {
    throw new EmailDeliveryConfigError({
      code: "email_provider_invalid",
      provider: "unknown",
      invalidEnv: "EMAIL_PROVIDER",
      message: "EMAIL_PROVIDER 설정이 올바르지 않습니다.",
    });
  }

  const missingEnv = getMissingEnv({
    RESEND_API_KEY: env.RESEND_API_KEY,
    EMAIL_FROM: env.EMAIL_FROM,
    EMAIL_REPLY_TO: env.EMAIL_REPLY_TO,
  });
  if (missingEnv.length > 0) {
    throw new EmailDeliveryConfigError({
      code: "resend_missing_env",
      provider,
      missingEnv,
      message: "Resend 메일 설정이 누락되었습니다.",
    });
  }

  const from = env.EMAIL_FROM!.trim();
  const replyTo = env.EMAIL_REPLY_TO!.trim();
  assertEmailAddress(from, "EMAIL_FROM");
  assertEmailAddress(replyTo, "EMAIL_REPLY_TO");

  return {
    provider,
    apiKey: env.RESEND_API_KEY!.trim(),
    from,
    replyTo,
  };
}

export function toEmailDeliveryConfigErrorLog(error: unknown) {
  if (error instanceof EmailDeliveryConfigError) {
    return {
      code: error.code,
      provider: error.provider,
      missingEnv: error.missingEnv,
      invalidEnv: error.invalidEnv,
    };
  }

  if (error instanceof SmtpConfigError) {
    return {
      code: error.code,
      provider: "smtp",
      missingEnv: error.missingEnv,
      invalidEnv: error.invalidEnv,
    };
  }

  return {
    code: "email_unknown_config_error",
    provider: "unknown",
  } as const;
}

function toArray(value: string | readonly string[] | undefined) {
  if (!value) return undefined;
  return Array.isArray(value) ? [...value] : [value];
}

function classifyResendStatus(status: number): EmailProviderErrorCode {
  if (status === 401 || status === 403) return "resend_auth_failed";
  if (status === 429) return "resend_provider_rate_limited";
  if (status === 422) return "resend_recipient_rejected";
  if (status >= 500) return "resend_connection_failed";
  return "resend_delivery_failed";
}

async function sendWithResend(
  config: ResendEmailDeliveryConfig,
  input: TransactionalEmailInput,
  fetchImpl: typeof fetch,
) {
  let response: Response;
  try {
    response = await fetchImpl(RESEND_EMAIL_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "ssartnership-email/1.0",
        ...(input.idempotencyKey
          ? { "Idempotency-Key": input.idempotencyKey }
          : {}),
      },
      body: JSON.stringify({
        from: config.from,
        to: toArray(input.to),
        ...(input.bcc ? { bcc: toArray(input.bcc) } : {}),
        reply_to: input.replyTo ?? config.replyTo,
        subject: input.subject,
        ...(input.text !== undefined ? { text: input.text } : {}),
        ...(input.html !== undefined ? { html: input.html } : {}),
      }),
      signal: AbortSignal.timeout(RESEND_REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new EmailProviderError("resend_connection_failed");
  }

  if (!response.ok) {
    throw new EmailProviderError(
      classifyResendStatus(response.status),
      response.status,
    );
  }
}

async function sendWithSmtp(
  config: SmtpEmailDeliveryConfig,
  input: TransactionalEmailInput,
) {
  const transport = createSmtpTransport(config.smtp);
  await transport.sendMail({
    from: config.from,
    to: toArray(input.to),
    ...(input.bcc ? { bcc: toArray(input.bcc) } : {}),
    ...(input.replyTo ?? config.replyTo
      ? { replyTo: input.replyTo ?? config.replyTo }
      : {}),
    subject: input.subject,
    ...(input.messageId ? { messageId: input.messageId } : {}),
    ...(input.text !== undefined ? { text: input.text } : {}),
    ...(input.html !== undefined ? { html: input.html } : {}),
  });
}

export async function sendTransactionalEmail(
  input: TransactionalEmailInput,
  options: Readonly<{
    env?: Partial<NodeJS.ProcessEnv>;
    fetchImpl?: typeof fetch;
  }> = {},
) {
  const config = getEmailDeliveryConfig(options.env);
  if (config.provider === "resend") {
    await sendWithResend(config, input, options.fetchImpl ?? fetch);
    return;
  }

  await sendWithSmtp(config, input);
}
