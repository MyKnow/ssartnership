export type AdminDataUnavailableReason =
  | "migration_pending"
  | "timeout"
  | "query_failed"
  | "unexpected_failure";

type ErrorLike = {
  code?: unknown;
  message?: unknown;
  name?: unknown;
};

function toErrorLike(error: unknown): ErrorLike {
  return error && typeof error === "object" ? error as ErrorLike : {};
}

export function getAdminDataUnavailableReason(
  error: unknown,
): AdminDataUnavailableReason {
  const candidate = toErrorLike(error);
  const code = typeof candidate.code === "string" ? candidate.code : "";
  const message = typeof candidate.message === "string"
    ? candidate.message.toLowerCase()
    : "";
  const name = typeof candidate.name === "string" ? candidate.name : "";

  if (
    code === "PGRST202"
    || message.includes("schema cache")
    || message.includes("could not find the function")
  ) {
    return "migration_pending";
  }
  if (
    name === "AbortError"
    || name === "TimeoutError"
    || message.includes("timeout")
    || message.includes("aborted")
  ) {
    return "timeout";
  }
  if (code || message) {
    return "query_failed";
  }
  return "unexpected_failure";
}

export function logAdminDataUnavailable(scope: string, error: unknown) {
  console.info(`[${scope}] unavailable`, {
    reasonCode: getAdminDataUnavailableReason(error),
  });
}
