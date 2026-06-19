import { z } from "zod";

export type SsafyVerifyCallbackBody = {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  iss: string;
};

export type SsafyVerifyParseResult =
  | { ok: true; data: SsafyVerifyCallbackBody }
  | { ok: false; errorCode: "INVALID_REQUEST" | "CALLBACK_ISSUER_MISMATCH" | "REDIRECT_URI_MISMATCH" };

const pkceVerifierPattern = /^[A-Za-z0-9._~-]{43,128}$/;

const callbackBodySchema = z
  .object({
    code: z.string().min(16).max(256),
    codeVerifier: z.string().regex(pkceVerifierPattern),
    redirectUri: z.string().url().max(2000),
    iss: z.string().url().max(2000),
  })
  .strict();

export function parseSsafyVerifyCallbackBody(
  input: unknown,
  expected: { issuer: string; redirectUris: readonly string[] },
): SsafyVerifyParseResult {
  const parsed = callbackBodySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errorCode: "INVALID_REQUEST" };
  }

  if (parsed.data.iss !== expected.issuer) {
    return { ok: false, errorCode: "CALLBACK_ISSUER_MISMATCH" };
  }

  if (!expected.redirectUris.includes(parsed.data.redirectUri)) {
    return { ok: false, errorCode: "REDIRECT_URI_MISMATCH" };
  }

  return { ok: true, data: parsed.data };
}

export async function readJson(request: Request) {
  return request.json().then(
    (value) => ({ ok: true as const, value }),
    () => ({ ok: false as const }),
  );
}
