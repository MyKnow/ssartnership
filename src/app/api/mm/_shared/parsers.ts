import type {
  ResetPasswordBody,
  ResetPasswordCompleteBody,
  ResetPasswordVerifyBody,
} from "./types";

async function parseJsonBody<T>(request: Request) {
  return (await request.json()) as T;
}

export async function parseResetPasswordBody(request: Request) {
  return parseJsonBody<ResetPasswordBody>(request);
}

export async function parseResetPasswordVerifyBody(request: Request) {
  return parseJsonBody<ResetPasswordVerifyBody>(request);
}

export async function parseResetPasswordCompleteBody(request: Request) {
  return parseJsonBody<ResetPasswordCompleteBody>(request);
}
