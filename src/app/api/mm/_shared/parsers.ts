import type { ResetPasswordCompleteBody } from "./types";

async function parseJsonBody<T>(request: Request) {
  return (await request.json()) as T;
}

export async function parseResetPasswordCompleteBody(request: Request) {
  return parseJsonBody<ResetPasswordCompleteBody>(request);
}
