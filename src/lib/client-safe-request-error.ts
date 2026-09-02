export type ClientSafeRequestErrorCode =
  | "request_failed"
  | "network_unavailable"
  | "invalid_response";

export class ClientSafeRequestError extends Error {
  readonly code: ClientSafeRequestErrorCode;

  constructor(code: ClientSafeRequestErrorCode, message: string) {
    super(message);
    this.name = "ClientSafeRequestError";
    this.code = code;
  }
}

export type ClientSafeRequestErrorMessages = {
  requestFailed: string;
  networkUnavailable: string;
};

export function getClientSafeRequestError(
  error: unknown,
  messages: ClientSafeRequestErrorMessages,
) {
  if (error instanceof ClientSafeRequestError) {
    return error;
  }

  if (error instanceof TypeError) {
    return new ClientSafeRequestError(
      "network_unavailable",
      messages.networkUnavailable,
    );
  }

  return new ClientSafeRequestError("request_failed", messages.requestFailed);
}
