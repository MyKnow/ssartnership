import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";
import { validateSsafyVerificationClaims } from "./claims";
import type { SsafyVerifyCallbackBody } from "./schema";
import type { SsafyVerifyServerConfig } from "./config";
import {
  emitSsafyVerifyApiTrace,
  summarizeSsafyVerifyFormTraceRequest,
  summarizeSsafyVerifyTraceResponsePayload,
  type SsafyVerifyApiTraceHandler,
} from "./api-trace";

type ExchangeOptions = {
  fetch?: typeof fetch;
  now?: () => number;
  trace?: SsafyVerifyApiTraceHandler | null;
};

const jwksByIssuer = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

const tokenSuccessSchema = z
  .object({
    verification_token: z.string().min(32).max(8192),
    scope: z.string().max(1000).nullable().optional(),
    result: z
      .object({
        verification_id: z.string().max(200).nullable().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

const tokenErrorSchema = z
  .object({
    error: z
      .object({
        code: z.string().min(1).max(80).optional(),
        request_id: z.string().min(1).max(120).nullable().optional(),
      })
      .optional(),
  })
  .passthrough();

function getJwks(issuer: string) {
  const cached = jwksByIssuer.get(issuer);
  if (cached) {
    return cached;
  }
  const jwks = createRemoteJWKSet(new URL(`${issuer}/verify/jwks`));
  jwksByIssuer.set(issuer, jwks);
  return jwks;
}

async function readResponseJson(response: Response) {
  return response.json().then(
    (value) => ({ ok: true as const, value }),
    () => ({ ok: false as const }),
  );
}

export async function exchangeSsafyVerificationCode(
  body: SsafyVerifyCallbackBody,
  config: SsafyVerifyServerConfig,
  options: ExchangeOptions = {},
) {
  const fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
  const now = options.now ?? (() => Date.now());
  const trace = options.trace ?? null;
  const params = new URLSearchParams({
    grant_type: "verification_code",
    client_id: config.clientId,
    code: body.code,
    code_verifier: body.codeVerifier,
  });

  if (config.clientSecret) {
    params.set("client_secret", config.clientSecret);
  }

  const startedAtMs = now();
  const traceRequest = summarizeSsafyVerifyFormTraceRequest(params);
  const tokenResponse = await fetchImpl(`${config.issuer}/verify/token`, {
    method: "POST",
    headers: {
      "cache-control": "no-store",
      "content-type": "application/x-www-form-urlencoded",
    },
    body: params,
    cache: "no-store",
  }).then((response) => response, () => null);

  if (!tokenResponse) {
    await emitSsafyVerifyApiTrace(trace, {
      source: "user-auth",
      operation: "verification_code_exchange",
      method: "POST",
      path: "/verify/token",
      scopes: [],
      startedAt: new Date(startedAtMs).toISOString(),
      durationMs: Math.max(0, now() - startedAtMs),
      status: null,
      ok: false,
      request: traceRequest,
      response: null,
      errorCode: "VERIFY_TOKEN_FAILED",
      providerRequestId: null,
    });
    return {
      ok: false as const,
      errorCode: "VERIFY_TOKEN_FAILED",
      requestId: null,
      status: 502,
    };
  }

  const tokenJson = await readResponseJson(tokenResponse);
  if (!tokenJson.ok) {
    await emitSsafyVerifyApiTrace(trace, {
      source: "user-auth",
      operation: "verification_code_exchange",
      method: "POST",
      path: "/verify/token",
      scopes: [],
      startedAt: new Date(startedAtMs).toISOString(),
      durationMs: Math.max(0, now() - startedAtMs),
      status: tokenResponse.status,
      ok: false,
      request: traceRequest,
      response: null,
      errorCode: "VERIFY_TOKEN_FAILED",
      providerRequestId: null,
    });
    return {
      ok: false as const,
      errorCode: "VERIFY_TOKEN_FAILED",
      requestId: null,
      status: 502,
    };
  }

  const responseSummary = summarizeSsafyVerifyTraceResponsePayload(tokenJson.value);
  if (!tokenResponse.ok) {
    const errorPayload = tokenErrorSchema.safeParse(tokenJson.value);
    const errorCode = errorPayload.success
      ? errorPayload.data.error?.code ?? "VERIFY_TOKEN_FAILED"
      : "VERIFY_TOKEN_FAILED";
    const requestId = errorPayload.success
      ? errorPayload.data.error?.request_id ?? null
      : null;
    await emitSsafyVerifyApiTrace(trace, {
      source: "user-auth",
      operation: "verification_code_exchange",
      method: "POST",
      path: "/verify/token",
      scopes: [],
      startedAt: new Date(startedAtMs).toISOString(),
      durationMs: Math.max(0, now() - startedAtMs),
      status: tokenResponse.status,
      ok: false,
      request: traceRequest,
      response: responseSummary,
      errorCode,
      providerRequestId: requestId,
    });
    return {
      ok: false as const,
      errorCode,
      requestId,
      status: tokenResponse.status,
    };
  }

  const tokenPayload = tokenSuccessSchema.safeParse(tokenJson.value);
  if (!tokenPayload.success) {
    await emitSsafyVerifyApiTrace(trace, {
      source: "user-auth",
      operation: "verification_code_exchange",
      method: "POST",
      path: "/verify/token",
      scopes: [],
      startedAt: new Date(startedAtMs).toISOString(),
      durationMs: Math.max(0, now() - startedAtMs),
      status: 502,
      ok: false,
      request: traceRequest,
      response: responseSummary,
      errorCode: "VERIFY_TOKEN_FAILED",
      providerRequestId: responseSummary.requestId,
    });
    return {
      ok: false as const,
      errorCode: "VERIFY_TOKEN_FAILED",
      requestId: null,
      status: 502,
    };
  }

  await emitSsafyVerifyApiTrace(trace, {
    source: "user-auth",
    operation: "verification_code_exchange",
    method: "POST",
    path: "/verify/token",
    scopes: [],
    startedAt: new Date(startedAtMs).toISOString(),
    durationMs: Math.max(0, now() - startedAtMs),
    status: tokenResponse.status,
    ok: true,
    request: traceRequest,
    response: responseSummary,
    errorCode: null,
    providerRequestId: responseSummary.requestId,
  });

  return {
    ok: true as const,
    verificationToken: tokenPayload.data.verification_token,
    verificationId: tokenPayload.data.result?.verification_id ?? null,
    scope: tokenPayload.data.scope ?? null,
  };
}

export async function verifySsafyVerificationToken(
  verificationToken: string,
  config: Pick<SsafyVerifyServerConfig, "issuer" | "clientId">,
) {
  const verified = await jwtVerify(verificationToken, getJwks(config.issuer), {
    issuer: config.issuer,
    audience: config.clientId,
  }).then(
    (result) => ({ ok: true as const, payload: result.payload }),
    () => ({ ok: false as const }),
  );

  if (!verified.ok) {
    return { ok: false as const, errorCode: "VERIFY_TOKEN_INVALID" };
  }

  return validateSsafyVerificationClaims(verified.payload, {
    issuer: config.issuer,
    clientId: config.clientId,
  });
}
