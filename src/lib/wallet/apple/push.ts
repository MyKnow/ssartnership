import { connect } from "node:http2";
import { forEachWithConcurrency } from "../../async-concurrency.ts";
import { getAppleWalletConfigStatus } from "./config";
import { normalizeApplePushToken } from "./apple-wallet-device-token";

const APNS_ORIGIN = "https://api.push.apple.com";
const MAX_PUSH_TOKENS_PER_BATCH = 1_000;
const DEFAULT_CONCURRENCY = 8;

type AppleWalletPushTransportInput = {
  pushToken: string;
  passTypeIdentifier: string;
  certificate: Buffer;
  privateKey: Buffer;
  privateKeyPassphrase?: string;
};

type AppleWalletPushTransportResult = {
  statusCode: number;
  reason?: string | null;
};

export type AppleWalletPushTransport = (
  input: AppleWalletPushTransportInput,
) => Promise<AppleWalletPushTransportResult>;

export type AppleWalletPushResult = {
  delivered: number;
  invalidTokens: string[];
  failed: number;
  reasonCodes: string[];
};

function getSafeApnsReason(body: string) {
  try {
    const value = JSON.parse(body) as { reason?: unknown };
    return typeof value.reason === "string" && /^[A-Za-z]{1,64}$/.test(value.reason)
      ? value.reason
      : null;
  } catch {
    return null;
  }
}

const defaultTransport: AppleWalletPushTransport = (input) =>
  new Promise((resolve, reject) => {
    const client = connect(APNS_ORIGIN, {
      cert: input.certificate,
      key: input.privateKey,
      ...(input.privateKeyPassphrase
        ? { passphrase: input.privateKeyPassphrase }
        : {}),
    });
    let settled = false;
    const finish = (
      outcome:
        | { ok: true; result: AppleWalletPushTransportResult }
        | { ok: false; error: Error },
    ) => {
      if (settled) return;
      settled = true;
      client.close();
      if (outcome.ok) resolve(outcome.result);
      else reject(outcome.error);
    };

    client.once("error", () =>
      finish({ ok: false, error: new Error("apple_wallet_apns_connection_failed") }),
    );
    client.setTimeout(10_000, () =>
      finish({ ok: false, error: new Error("apple_wallet_apns_timeout") }),
    );

    const request = client.request({
      ":method": "POST",
      ":path": `/3/device/${input.pushToken}`,
      "content-type": "application/json",
      "apns-topic": input.passTypeIdentifier,
      "apns-priority": "5",
      "apns-push-type": "background",
    });
    let statusCode = 0;
    let responseBody = "";
    request.on("response", (headers) => {
      statusCode = Number(headers[":status"] ?? 0);
    });
    request.on("data", (chunk: Buffer) => {
      if (responseBody.length < 2_048) {
        responseBody += chunk.toString("utf8");
      }
    });
    request.once("error", () =>
      finish({ ok: false, error: new Error("apple_wallet_apns_request_failed") }),
    );
    request.once("end", () =>
      finish({
        ok: true,
        result: {
          statusCode,
          reason: getSafeApnsReason(responseBody),
        },
      }),
    );
    request.end("{}");
  });

function mapReasonCode(statusCode: number, reason?: string | null) {
  if (statusCode === 410 || reason === "BadDeviceToken" || reason === "DeviceTokenNotForTopic") {
    return "invalid_token";
  }
  if (statusCode === 403) return "authentication_failed";
  if (statusCode === 429) return "rate_limited";
  if (statusCode >= 500) return "provider_unavailable";
  return "provider_rejected";
}

export async function sendAppleWalletPassUpdate(
  pushTokens: readonly string[],
  options: {
    transport?: AppleWalletPushTransport;
    concurrency?: number;
  } = {},
): Promise<AppleWalletPushResult> {
  const status = getAppleWalletConfigStatus();
  if (!status.ok) {
    return {
      delivered: 0,
      invalidTokens: [],
      failed: pushTokens.length,
      reasonCodes: [status.code === "disabled" ? "wallet_disabled" : "wallet_config_invalid"],
    };
  }

  const parsedTokens = pushTokens.map(normalizeApplePushToken);
  const invalidTokenCount = parsedTokens.filter((token) => !token).length;
  const uniqueValidTokens = [
    ...new Set(parsedTokens.filter((token): token is string => Boolean(token))),
  ];
  const normalizedTokens = uniqueValidTokens.slice(0, MAX_PUSH_TOKENS_PER_BATCH);
  const truncatedTokenCount = uniqueValidTokens.length - normalizedTokens.length;
  const result: AppleWalletPushResult = {
    delivered: 0,
    invalidTokens: [],
    failed: invalidTokenCount + truncatedTokenCount,
    reasonCodes:
      invalidTokenCount === 0
        ? truncatedTokenCount === 0
          ? []
          : ["batch_truncated"]
        : truncatedTokenCount === 0
          ? ["invalid_token_format"]
          : ["invalid_token_format", "batch_truncated"],
  };
  const transport = options.transport ?? defaultTransport;
  const concurrency = Math.max(
    1,
    Math.min(options.concurrency ?? DEFAULT_CONCURRENCY, 16),
  );
  await forEachWithConcurrency(
    normalizedTokens,
    concurrency,
    async (pushToken) => {
      try {
        const response = await transport({
          pushToken,
          passTypeIdentifier: status.config.passTypeIdentifier,
          certificate: status.config.signerCert,
          privateKey: status.config.signerKey,
          privateKeyPassphrase: status.config.signerKeyPassphrase,
        });
        if (response.statusCode === 200) {
          result.delivered += 1;
          return;
        }
        const reasonCode = mapReasonCode(response.statusCode, response.reason);
        result.failed += 1;
        if (reasonCode === "invalid_token") {
          result.invalidTokens.push(pushToken);
        }
        result.reasonCodes.push(reasonCode);
      } catch {
        result.failed += 1;
        result.reasonCodes.push("request_failed");
      }
    },
  );
  return {
    ...result,
    reasonCodes: [...new Set(result.reasonCodes)],
  };
}
