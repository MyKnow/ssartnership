import {
  JsonRequestBodyError,
  readJsonRequestBodyWithinLimit,
} from "@/lib/request-body-limit";

export class PartnerPortalRouteBodyError extends Error {
  readonly status: 400 | 413;

  constructor(
    message = "요청 본문 형식을 확인해 주세요.",
    status: 400 | 413 = 400,
  ) {
    super(message);
    this.name = "PartnerPortalRouteBodyError";
    this.status = status;
  }
}

export const MAX_PARTNER_PORTAL_JSON_BODY_BYTES = 4 * 1024;

export async function readPartnerPortalJsonBody<T>(request: Request) {
  try {
    return await readJsonRequestBodyWithinLimit<T>(
      request,
      MAX_PARTNER_PORTAL_JSON_BODY_BYTES,
    );
  } catch (error) {
    if (error instanceof PartnerPortalRouteBodyError) {
      throw error;
    }
    if (error instanceof JsonRequestBodyError) {
      throw new PartnerPortalRouteBodyError(
        error.message,
        error.code === "body_too_large" ? 413 : 400,
      );
    }
    throw new PartnerPortalRouteBodyError();
  }
}
