export class RequestBodyTooLargeError extends Error {
  constructor() {
    super('Request body exceeds the configured byte limit.');
    this.name = 'RequestBodyTooLargeError';
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
