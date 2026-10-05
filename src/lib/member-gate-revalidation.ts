import { revalidatePath } from "next/cache";

/**
 * Member gate screens whose rendered state depends on the session flags that a
 * login, consent, or password change just rewrote. The home page is not listed:
 * it reads the session per request already, and purging "/" only forces the
 * shared partner/category/promotion snapshots to be refetched.
 */
export const MEMBER_GATE_REVALIDATE_PATHS = [
  "/auth/consent",
  "/auth/change-password",
  "/certification",
] as const;

export function revalidateMemberGatePaths(
  revalidate: (path: string) => void = revalidatePath,
) {
  for (const path of MEMBER_GATE_REVALIDATE_PATHS) {
    revalidate(path);
  }
}
