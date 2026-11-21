export class ClientRequestError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ClientRequestError";
    this.status = status;
  }
}

export function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export async function requestJson<T>(
  input: RequestInfo | URL,
  init: RequestInit,
  options: { fallbackMessage: string; parse: (value: unknown) => T | null },
): Promise<T> {
  let status = 0;
  try {
    const response = await fetch(input, init);
    status = response.status;
    const body: unknown = await response.json().catch((error: unknown) => {
      if (isAbortError(error)) throw error;
      return null;
    });
    if (!response.ok) {
      const message = isJsonRecord(body) && typeof body.message === "string"
        && body.message.trim().length > 0 && body.message.length <= 500
        ? body.message : options.fallbackMessage;
      throw new ClientRequestError(message, status);
    }
    const parsed = options.parse(body);
    if (parsed === null) throw new ClientRequestError(options.fallbackMessage, status);
    return parsed;
  } catch (error) {
    if (isAbortError(error) || error instanceof ClientRequestError) throw error;
    throw new ClientRequestError(options.fallbackMessage, status);
  }
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}
