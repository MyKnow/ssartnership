import { getBaseUrl } from "./config.ts";
import { MattermostApiError } from "./types.ts";

export async function mmFetch(path: string, init: RequestInit = {}) {
  const url = `${getBaseUrl()}${path}`;
  return fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

export function toMattermostApiError(response: Response, fallbackMessage: string) {
  return new MattermostApiError(
    `${fallbackMessage} (status ${response.status})`,
    response.status,
  );
}
