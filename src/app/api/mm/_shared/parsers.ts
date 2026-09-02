import type { ResetPasswordCompleteBody } from "./types";
import {
  JsonRequestBodyError,
  readJsonRequestBodyWithinLimit,
} from "@/lib/request-body-limit";

export const MAX_MEMBER_AUTH_JSON_BODY_BYTES = 4 * 1024;

export class MemberAuthRouteBodyError extends Error {
  readonly code: JsonRequestBodyError["code"];

  constructor(error: JsonRequestBodyError) {
    super(error.message);
    this.name = "MemberAuthRouteBodyError";
    this.code = error.code;
  }
}

export async function parseMemberAuthJsonBody<T>(request: Request) {
  try {
    return await readJsonRequestBodyWithinLimit<T>(
      request,
      MAX_MEMBER_AUTH_JSON_BODY_BYTES,
    );
  } catch (error) {
    if (error instanceof JsonRequestBodyError) {
      throw new MemberAuthRouteBodyError(error);
    }
    throw error;
  }
}

export async function parseResetPasswordCompleteBody(request: Request) {
  return parseMemberAuthJsonBody<ResetPasswordCompleteBody>(request);
}
