export class RequestBodyTooLargeError extends Error {
  constructor() {
    super('Request body exceeds the configured byte limit.');
    this.name = 'RequestBodyTooLargeError';
  }
}

export type JsonRequestBodyErrorCode = 'invalid_json' | 'body_too_large';

export const MAX_STANDARD_JSON_BODY_BYTES = 4 * 1024;
export const MAX_EXTENDED_JSON_BODY_BYTES = 16 * 1024;
export const MAX_PUSH_SUBSCRIPTION_JSON_BODY_BYTES =
  MAX_EXTENDED_JSON_BODY_BYTES;
export const MAX_BULK_JSON_BODY_BYTES = 128 * 1024;

export class JsonRequestBodyError extends Error {
  readonly code: JsonRequestBodyErrorCode;

  constructor(code: JsonRequestBodyErrorCode) {
    super(
      code === 'body_too_large'
        ? '요청 본문이 너무 큽니다.'
        : '요청 본문 형식을 확인해 주세요.',
    );
    this.name = 'JsonRequestBodyError';
    this.code = code;
  }
}

export async function readRequestBodyWithinLimit(
  body: ReadableStream<Uint8Array> | null,
  maximumBytes: number,
): Promise<string> {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 0) {
    throw new TypeError('maximumBytes must be a non-negative safe integer.');
  }

  if (!body) {
    return '';
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      totalBytes += value.byteLength;
      if (totalBytes > maximumBytes) {
        await reader.cancel().catch(() => undefined);
        throw new RequestBodyTooLargeError();
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export async function readJsonRequestBodyWithinLimit<T>(
  request: Request,
  maximumBytes: number,
): Promise<T> {
  const declaredContentLength = request.headers.get('content-length');
  if (declaredContentLength !== null) {
    const contentLength = Number(declaredContentLength);
    if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
      throw new JsonRequestBodyError('body_too_large');
    }
  }

  try {
    const rawBody = await readRequestBodyWithinLimit(request.body, maximumBytes);
    return JSON.parse(rawBody) as T;
  } catch (error) {
    if (error instanceof JsonRequestBodyError) {
      throw error;
    }
    if (error instanceof RequestBodyTooLargeError) {
      throw new JsonRequestBodyError('body_too_large');
    }
    throw new JsonRequestBodyError('invalid_json');
  }
}
