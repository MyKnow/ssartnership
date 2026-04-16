import {
  findMmUserDirectoryStaffEntryByUsername,
  findMmUserDirectoryStudentEntryByUsernameAndYear,
} from "@/lib/mm-directory";
import {
  findUserInChannelByUsername,
  getStudentChannelConfig,
} from "@/lib/mattermost";
import { getPreferredStaffSourceYear } from "@/lib/ssafy-year";
import {
  isMattermostApiError,
  loginAsSsafySender,
  upsertDirectorySnapshotFromMmUser,
} from "./mattermost";

type RequestCodeTargetUser = {
  id: string;
  username: string;
  nickname?: string;
  first_name?: string;
  last_name?: string;
  is_bot?: boolean;
};

export type RequestCodeTargetResolution = {
  directoryEntry: Awaited<
    ReturnType<typeof findMmUserDirectoryStaffEntryByUsername>
  >;
  targetUser: RequestCodeTargetUser | null;
  targetDisplayName: string | null;
  targetCampus: string | null;
  resolvedFromDirectory: boolean;
  resolvedYearFromLive: number | null;
  lastInaccessibleStatus: number | null;
  attemptedLiveSearches: number;
  inaccessibleLiveSearches: number;
};

export async function resolveSignupTarget(
  username: string,
  year: number,
): Promise<RequestCodeTargetResolution> {
  const directoryEntry =
    year === 0
      ? await findMmUserDirectoryStaffEntryByUsername(username)
      : await findMmUserDirectoryStudentEntryByUsernameAndYear(username, year);

  let targetUser: RequestCodeTargetUser | null = null;
  let targetDisplayName = directoryEntry?.display_name ?? null;
  let targetCampus = directoryEntry?.campus ?? null;
  let resolvedFromDirectory = Boolean(directoryEntry);
  let resolvedYearFromLive: number | null = null;
  let lastInaccessibleStatus: number | null = null;
  let attemptedLiveSearches = 0;
  let inaccessibleLiveSearches = 0;

  if (directoryEntry) {
    targetUser = {
      id: directoryEntry.mm_user_id,
      username: directoryEntry.mm_username,
      nickname: directoryEntry.display_name,
    };
  } else {
    const searchYears = year === 0 ? [15, 14] : [year];

    for (const searchYear of searchYears) {
      try {
        const senderLogin = await loginAsSsafySender(searchYear);
        attemptedLiveSearches += 1;
        const channelConfig = getStudentChannelConfig(searchYear);
        const candidate = await findUserInChannelByUsername(
          senderLogin.token,
          username,
          channelConfig,
        );
        if (!candidate) {
          continue;
        }

        const summary = await upsertDirectorySnapshotFromMmUser(candidate, [searchYear]);
        const isExpectedMatch = year === 0 ? summary.isStaff : !summary.isStaff;
        if (!isExpectedMatch) {
          continue;
        }

        targetUser = candidate;
        targetDisplayName = summary.displayName;
        targetCampus = summary.campus;
        resolvedFromDirectory = false;
        resolvedYearFromLive = searchYear;
        break;
      } catch (error) {
        if (isMattermostApiError(error)) {
          lastInaccessibleStatus = error.status;
          inaccessibleLiveSearches += 1;
          attemptedLiveSearches += 1;
          continue;
        }
        throw error;
      }
    }
  }

  return {
    directoryEntry,
    targetUser,
    targetDisplayName,
    targetCampus,
    resolvedFromDirectory,
    resolvedYearFromLive,
    lastInaccessibleStatus,
    attemptedLiveSearches,
    inaccessibleLiveSearches,
  };
}

export function resolveRequestCodeSenderYear(input: {
  year: number;
  resolvedYearFromLive: number | null;
  directorySourceYears: number[];
}) {
  return input.year === 0
    ? input.resolvedYearFromLive ??
        getPreferredStaffSourceYear(input.directorySourceYears) ??
        15
    : input.year;
}
