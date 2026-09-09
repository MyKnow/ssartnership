import {
  JsonRequestBodyError,
  type JsonRequestBodyErrorCode,
  readJsonRequestBodyWithinLimit,
} from "@/lib/request-body-limit";

type ReadRouteJsonBodyOptions = {
  maximumBytes: number;
  invalidMessage: string;
  tooLargeMessage?: string;
};

export class RouteJsonBodyError extends Error {
  readonly code: JsonRequestBodyErrorCode;
  readonly status: 400 | 413;

  constructor(input: {
    code: JsonRequestBodyErrorCode;
    message: string;
    status: 400 | 413;
  }) {
    super(input.message);
    this.name = "RouteJsonBodyError";
    this.code = input.code;
    this.status = input.status;
  }
}

export async function readRouteJsonBodyWithinLimit<T>(
  request: Request,
  options: ReadRouteJsonBodyOptions,
) {
  try {
    return await readJsonRequestBodyWithinLimit<T>(request, options.maximumBytes);
  } catch (error) {
    if (!(error instanceof JsonRequestBodyError)) {
      throw error;
    }

    const bodyTooLarge = error.code === "body_too_large";
    throw new RouteJsonBodyError({
      code: error.code,
      message: bodyTooLarge
        ? (options.tooLargeMessage ?? options.invalidMessage)
        : options.invalidMessage,
      status: bodyTooLarge ? 413 : 400,
    });
  }
}
