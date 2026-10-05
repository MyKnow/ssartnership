import type { Instrumentation } from "next";

/**
 * Self-hosted error visibility: every server error Next.js captures (render,
 * route handler, server action, proxy) becomes one sanitized JSON line on the
 * container log. No external SDK, network call or in-process counter.
 */
export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }
  try {
    const { reportRequestError } = await import("@/lib/request-error-report");
    reportRequestError(error, request, context);
  } catch {
    // Reporting must never throw from the framework error hook.
  }
};
