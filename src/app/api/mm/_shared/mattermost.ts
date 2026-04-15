import {
  type MMUser,
  MattermostApiError,
  getSenderCredentials,
  loginWithPassword,
} from "../../../../lib/mattermost.ts";
import { parseSsafyProfileFromUser } from "../../../../lib/mm-profile.ts";
import { upsertMmUserDirectorySnapshot } from "../../../../lib/mm-directory.ts";

export function isMattermostApiError(error: unknown): error is MattermostApiError {
  return error instanceof MattermostApiError;
}

export async function loginAsSsafySender(year: number) {
  const senderCredentials = getSenderCredentials(year);
  const senderLogin = await loginWithPassword(
    senderCredentials.loginId,
    senderCredentials.password,
  );

  return {
    year,
    token: senderLogin.token,
    user: senderLogin.user,
  };
}

export function getMattermostProfileSummary(user: MMUser) {
  const profile = parseSsafyProfileFromUser(user);

  return {
    displayName: profile.displayName ?? user.nickname ?? user.username,
    campus: profile.campus ?? null,
    isStaff: Boolean(profile.isStaff),
  };
}

export async function upsertDirectorySnapshotFromMmUser(
  user: MMUser,
  sourceYears: number[],
) {
  const summary = getMattermostProfileSummary(user);
  await upsertMmUserDirectorySnapshot({
    mmUserId: user.id,
    mmUsername: user.username,
    displayName: summary.displayName,
    campus: summary.campus,
    isStaff: summary.isStaff,
    sourceYears,
  });
  return summary;
}
