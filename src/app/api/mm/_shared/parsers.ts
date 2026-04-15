import type {
  RequestCodeBody,
  ResetPasswordBody,
  VerifyCodeBody,
} from "./types";

async function parseJsonBody<T>(request: Request) {
  return (await request.json()) as T;
}

export async function parseRequestCodeBody(request: Request) {
  return parseJsonBody<RequestCodeBody>(request);
}

export async function parseVerifyCodeBody(request: Request) {
  return parseJsonBody<VerifyCodeBody>(request);
}

export async function parseResetPasswordBody(request: Request) {
  return parseJsonBody<ResetPasswordBody>(request);
}

