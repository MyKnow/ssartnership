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

export async function readRequestBodyBytesWithinLimit(
  body: ReadableStream<Uint8Array> | null,
  maximumBytes: number,
): Promise<Uint8Array> {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 0) {
    throw new TypeError('maximumBytes must be a non-negative safe integer.');
  }

  if (!body) {
    return new Uint8Array(0);
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

  return bytes;
}

export async function readRequestBodyWithinLimit(
  body: ReadableStream<Uint8Array> | null,
  maximumBytes: number,
): Promise<string> {
  const bytes = await readRequestBodyBytesWithinLimit(body, maximumBytes);
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

function declaresBodyLargerThan(request: Request, maximumBytes: number) {
  const declaredContentLength = request.headers.get('content-length');
  if (declaredContentLength === null) {
    return false;
  }
  const contentLength = Number(declaredContentLength);
  return Number.isFinite(contentLength) && contentLength > maximumBytes;
}

/** multipart 경계·필드 헤더 등 파일 본문 외 여유분 */
export const MULTIPART_FORM_OVERHEAD_BYTES = 64 * 1024;

export type MultipartRequestBodyErrorCode = 'invalid_form' | 'body_too_large';

export class MultipartRequestBodyError extends Error {
  readonly code: MultipartRequestBodyErrorCode;

  constructor(code: MultipartRequestBodyErrorCode) {
    super(
      code === 'body_too_large'
        ? '업로드 요청이 너무 큽니다.'
        : '업로드 요청 형식을 확인해 주세요.',
    );
    this.name = 'MultipartRequestBodyError';
    this.code = code;
  }
}

/**
 * `request.formData()` 대신 사용한다. 선언된 Content-Length가 한도를 넘으면 본문을 읽기 전에
 * 거부하고, 길이를 선언하지 않은 스트림도 한도까지만 읽은 뒤 multipart를 해석한다.
 */
export async function readMultipartFormDataWithinLimit(
  request: Request,
  maximumBytes: number,
): Promise<FormData> {
  if (declaresBodyLargerThan(request, maximumBytes)) {
    throw new MultipartRequestBodyError('body_too_large');
  }

  let bytes: Uint8Array;
  try {
    bytes = await readRequestBodyBytesWithinLimit(request.body, maximumBytes);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      throw new MultipartRequestBodyError('body_too_large');
    }
    throw new MultipartRequestBodyError('invalid_form');
  }

  try {
    return await new Response(bytes, {
      headers: { 'content-type': request.headers.get('content-type') ?? '' },
    }).formData();
  } catch {
    throw new MultipartRequestBodyError('invalid_form');
  }
}

export async function readJsonRequestBodyWithinLimit<T>(
  request: Request,
  maximumBytes: number,
): Promise<T> {
  if (declaresBodyLargerThan(request, maximumBytes)) {
    throw new JsonRequestBodyError('body_too_large');
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
