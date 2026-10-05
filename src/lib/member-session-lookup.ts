import { logServerError } from "./server-log.ts";

export type MemberSessionLookup<T> =
  | { ok: true; session: T | null }
  | { ok: false };

/**
 * Separates "signed out" from "could not check the session".
 *
 * The member session helpers return `null` both for a missing cookie and for
 * a member lookup that failed (page gates must never loop on an outage). A
 * route that must not answer 401 during a database outage loads the session
 * first and, only when it comes back empty, asks `isLookupUnavailable`
 * whether a signed cookie exists while the member row cannot be read.
 * Signed-in requests and requests without a cookie never pay for the probe.
 */
export async function lookupMemberSession<T>(
  event: string,
  loadSession: () => Promise<T | null>,
  isLookupUnavailable: () => Promise<boolean>,
): Promise<MemberSessionLookup<T>> {
  try {
    const session = await loadSession();
    if (session) {
      return { ok: true, session };
    }
    if (!(await isLookupUnavailable())) {
      return { ok: true, session: null };
    }
    logServerError(event, undefined, { reasonCode: "member_lookup_unavailable" });
    return { ok: false };
  } catch (error) {
    logServerError(event, error);
    return { ok: false };
  }
}
