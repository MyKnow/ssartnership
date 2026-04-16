import type { MmUserDirectoryRow } from "@/lib/mm-directory";
import { findMmUserDirectoryEntryByUsername } from "@/lib/mm-directory";
import { resolveSelectableMemberByUsername } from "@/lib/mattermost";
import {
  isMattermostApiError,
  upsertDirectorySnapshotFromMmUser,
} from "./mattermost";

type ResolvedStudent = {
  year: number;
  token: string;
  user: {
    id: string;
    username: string;
    nickname?: string;
    first_name?: string;
    last_name?: string;
    is_bot?: boolean;
  };
};

export type VerifyCodeIdentityResult =
  | {
      kind: "resolved";
      directoryEntry: MmUserDirectoryRow | null;
      resolvedStudent: ResolvedStudent | null;
      mmUserId: string;
      resolvedDisplayName: string | null;
      resolvedCampus: string | null;
    }
  | {
      kind: "inaccessible";
      status: number;
    }
  | {
      kind: "not-found";
    };

export async function resolveVerifyCodeIdentity(
  username: string,
): Promise<VerifyCodeIdentityResult> {
  let resolvedStudent: ResolvedStudent | null = null;
  const directoryEntry = await findMmUserDirectoryEntryByUsername(username);
  let mmUserId = directoryEntry?.mm_user_id ?? null;
  let resolvedDisplayName = directoryEntry?.display_name ?? null;
  let resolvedCampus = directoryEntry?.campus ?? null;

  if (!mmUserId) {
    try {
      const resolved = await resolveSelectableMemberByUsername(username);
      if (resolved) {
        resolvedStudent = {
          year: resolved.year,
          token: "",
          user: resolved.user,
        };
        const summary = await upsertDirectorySnapshotFromMmUser(
          resolved.user,
          [resolved.year],
        );
        resolvedDisplayName = summary.displayName;
        resolvedCampus = summary.campus;
        mmUserId = resolved.user.id;
      }
    } catch (error) {
      if (isMattermostApiError(error)) {
        return {
          kind: "inaccessible",
          status: error.status,
        };
      }
      throw error;
    }
  }

  if (!mmUserId) {
    return { kind: "not-found" };
  }

  return {
    kind: "resolved",
    directoryEntry,
    resolvedStudent,
    mmUserId,
    resolvedDisplayName,
    resolvedCampus,
  };
}
