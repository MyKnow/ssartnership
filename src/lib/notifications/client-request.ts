import {
  ClientSafeRequestError,
  getClientSafeRequestError,
} from "@/lib/client-safe-request-error";

type NotificationApiResponse = {
  message?: string;
};

type NotificationRequestOptions = {
  requestFailureMessage: string;
  responseFailureMessage?: string;
};

function buildNetworkFailureMessage(requestFailureMessage: string) {
  const normalizedMessage = requestFailureMessage.trim().replace(/[.!?]+$/u, "");
  return `${normalizedMessage}. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.`;
}

export function getNotificationClientError(
  error: unknown,
  requestFailureMessage: string,
) {
  return getClientSafeRequestError(error, {
    requestFailed: requestFailureMessage,
    networkUnavailable: buildNetworkFailureMessage(requestFailureMessage),
  });
}

export async function requestNotificationJson<
  T extends NotificationApiResponse,
>(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  options: NotificationRequestOptions,
): Promise<T> {
  try {
    const response = await fetch(input, init);
    const data = (await response.json().catch(() => ({}))) as T;

    if (!response.ok) {
      const responseMessage = data
        && typeof data === "object"
        && typeof data.message === "string"
        ? data.message
        : undefined;
      throw new ClientSafeRequestError(
        "request_failed",
        responseMessage
          ?? options.responseFailureMessage
          ?? "알림을 처리하지 못했습니다.",
      );
    }

    return data;
  } catch (error) {
    throw getNotificationClientError(error, options.requestFailureMessage);
  }
}
