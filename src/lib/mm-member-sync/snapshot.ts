import {
  MattermostApiError,
  type MattermostAuthenticatedSession,
  type MattermostUser,
  type MattermostUserImage,
} from "@/lib/mattermost/client";
import { MemberProfileSyncError } from "@/lib/member-profile-sync-errors";
import type { MemberSyncSnapshot } from "./shared";

type MattermostProfileSession = Pick<
  MattermostAuthenticatedSession,
  "getUserById" | "getUserImage"
>;

export function getMattermostDisplayName(
  user: Pick<MattermostUser, "username" | "nickname" | "firstName" | "lastName">,
) {
  const nickname = user.nickname.trim();
  if (nickname) {
    return nickname;
  }

  const fullName = [user.firstName, user.lastName]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" ");
  return fullName || user.username;
}

export function toMemberSyncSnapshot(input: {
  user: MattermostUser;
  image: MattermostUserImage | null;
}): MemberSyncSnapshot {
  return {
    mmUserId: input.user.id,
    mmUsername: input.user.username,
    displayName: getMattermostDisplayName(input.user),
    // Direct Mattermost is only authoritative for these three profile fields.
    // SSAFY profile claims (campus/track) are intentionally preserved locally.
    campus: null,
    track: null,
    trackName: null,
    avatarFetched: input.image !== null,
    avatarUrl: null,
    avatarContentType: input.image?.contentType ?? null,
    avatarBase64: input.image?.bytes.toString("base64") ?? null,
  };
}

async function getOptionalUserImage(
  userId: string,
  session: MattermostProfileSession,
) {
  try {
    return await session.getUserImage(userId);
  } catch (error) {
    // Missing avatar is not a profile lookup failure. Other errors leave all
    // local profile data untouched by propagating to the caller.
    if (error instanceof MattermostApiError && error.code === "not_found") {
      return null;
    }
    throw error;
  }
}

export async function fetchMemberSnapshotByUserId(
  userId: string,
  session: MattermostProfileSession,
): Promise<{ user: MattermostUser; snapshot: MemberSyncSnapshot }> {
  const user = await session.getUserById(userId);
  if (user.id !== userId) {
    throw new MemberProfileSyncError("identity_mismatch");
  }
  return {
    user,
    snapshot: await fetchMemberSnapshotForUser(user, session),
  };
}

export async function fetchMemberSnapshotForUser(
  user: MattermostUser,
  session: MattermostProfileSession,
): Promise<MemberSyncSnapshot> {
  if (!user.id) {
    throw new MemberProfileSyncError("provider_response_invalid");
  }
  const image = await getOptionalUserImage(user.id, session);
  return toMemberSyncSnapshot({ user, image });
}
