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
  const response = await fetch(input, init);
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = isJsonRecord(body) && typeof body.message === "string"
      && body.message.trim().length > 0 && body.message.length <= 500
      ? body.message : options.fallbackMessage;
    throw new ClientRequestError(message, response.status);
  }
  const parsed = options.parse(body);
  if (parsed === null) throw new ClientRequestError(options.fallbackMessage, response.status);
  return parsed;
}
