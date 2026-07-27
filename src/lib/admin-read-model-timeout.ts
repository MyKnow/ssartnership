/**
 * Keeps an admin route from leaving its shell in an indeterminate skeleton
 * when an external read-model dependency is slow or unavailable.
 *
 * The underlying promise is deliberately not exposed to the caller after a
 * timeout. Its rejection is consumed so a late database failure cannot become
 * an unhandled server error after the safe fallback has rendered.
 */
export function withAdminReadModelTimeout<T>(
  promise: Promise<T>,
  fallback: T,
  timeoutMs: number,
): Promise<T> {
  return new Promise<T>((resolve) => {
    let settled = false;

    const settle = (value: T) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      resolve(value);
    };

    const timer = setTimeout(() => settle(fallback), Math.max(0, timeoutMs));
    void promise.then(settle, () => settle(fallback));
  });
}

/**
 * Auxiliary panels must never compete with the primary admin task surface.
 * Keep this boundary below the interaction budget while allowing the main
 * route to continue rendering when an aggregate RPC is slow.
 */
export const ADMIN_AUXILIARY_READ_MODEL_TIMEOUT_MS = 500;
