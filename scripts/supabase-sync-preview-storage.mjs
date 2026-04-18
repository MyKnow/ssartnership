import { setTimeout as sleep } from "node:timers/promises";

const RETRYABLE_STATUS_CODES = new Set([502, 503, 504]);
const RETRYABLE_ERROR_PATTERNS = [
  /bad gateway/i,
  /gateway timeout/i,
  /service unavailable/i,
  /fetch failed/i,
  /network error/i,
  /econnreset/i,
  /etimedout/i,
  /upstream connect error/i,
];

function extractStorageErrorDetails(error) {
  if (!error) {
    return {
      message: "Unknown storage error",
      status: undefined,
      code: undefined,
    };
  }

  if (typeof error === "string") {
    return {
      message: error,
      status: undefined,
      code: undefined,
    };
  }

  const message =
    typeof error.message === "string" && error.message.trim().length > 0
      ? error.message.trim()
      : "Unknown storage error";
  const status =
    typeof error.status === "number"
      ? error.status
      : typeof error.statusCode === "number"
        ? error.statusCode
        : undefined;
  const code =
    typeof error.code === "string" && error.code.trim().length > 0
      ? error.code.trim()
      : undefined;

  return { message, status, code };
}

export function formatStorageError(error) {
  const { message, status, code } = extractStorageErrorDetails(error);
  const statusLabel = typeof status === "number" ? ` (status ${status})` : "";
  const codeLabel = code ? ` [${code}]` : "";
  return `${message}${statusLabel}${codeLabel}`;
}

export function isRetryableStorageError(error) {
  const { message, status, code } = extractStorageErrorDetails(error);
  if (typeof status === "number" && RETRYABLE_STATUS_CODES.has(status)) {
    return true;
  }

  if (typeof code === "string" && RETRYABLE_ERROR_PATTERNS.some((pattern) => pattern.test(code))) {
    return true;
  }

  return RETRYABLE_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

export function toStorageError(error) {
  const { message, status, code } = extractStorageErrorDetails(error);
  const storageError = new Error(message);
  if (typeof status === "number") {
    storageError.status = status;
  }
  if (code) {
    storageError.code = code;
  }
  return storageError;
}

export async function withStorageRetry(taskName, operation, options = {}) {
  const attempts = Math.max(1, options.attempts ?? 3);
  const baseDelayMs = Math.max(0, options.baseDelayMs ?? 750);
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !isRetryableStorageError(error)) {
        throw error;
      }

      const waitMs = baseDelayMs * attempt;
      console.warn(
        `${taskName} failed on attempt ${attempt}/${attempts}: ${formatStorageError(error)}. Retrying in ${waitMs}ms...`,
      );
      await sleep(waitMs);
    }
  }

  throw lastError;
}

export async function runStorageOperation(taskName, operation, options = {}) {
  return withStorageRetry(
    taskName,
    async () => {
      const result = await operation();
      if (result && typeof result === "object" && "error" in result && result.error) {
        throw toStorageError(result.error);
      }

      if (result && typeof result === "object" && "data" in result) {
        return result.data;
      }

      return result ?? null;
    },
    options,
  );
}
