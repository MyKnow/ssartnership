import { buildMattermostProfileSyncPatch } from "@/lib/member-domain";
import {
  syncMemberProfileImage,
} from "@/lib/member-profile-images";
import {
  findMmUserDirectoryEntryByUserId,
  upsertMmUserDirectorySnapshot,
} from "@/lib/mm-directory";
import {
  fetchMemberSnapshotByUserId,
  fetchMemberSnapshotByUsername,
} from "@/lib/mm-member-sync/snapshot";
import { markMemberMattermostLoginUnavailable } from "@/lib/member-email-login-transition";
import { MemberProfileSyncError } from "@/lib/member-profile-sync-errors";
import type {
  MemberSyncField,
  MemberSyncSnapshot,
  NormalizedMemberSyncSubject,
} from "@/lib/mm-member-sync/shared";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

type MemberMattermostSyncRow = {
  id: string;
  display_name: string | null;
  generation: number | null;
  mattermost_account_id: string | null;
};

type MattermostDirectoryRow = {
  id: string;
  mm_user_id: string;
  mm_username: string;
};

export type MattermostProfileSyncResult = {
  member: NormalizedMemberSyncSubject;
  snapshot: MemberSyncSnapshot;
  updated: boolean;
  changedFields: MemberSyncField[];
  imageUpdated: boolean;
  imageSkipped: boolean;
};

export type MattermostProfileUnavailableResult = {
  unavailable: true;
  member: NormalizedMemberSyncSubject;
};

async function loadMattermostDirectory(member: MemberMattermostSyncRow) {
  if (!member.mattermost_account_id) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("mm_user_directory")
    .select("id,mm_user_id,mm_username")
    .eq("id", member.mattermost_account_id)
    .maybeSingle();
  if (error) {
    throw new MemberProfileSyncError("directory_lookup_failed");
  }
  return (data as MattermostDirectoryRow | null) ?? null;
}

async function syncSsafyVerificationTrack(input: {
  memberId: string;
  snapshot: MemberSyncSnapshot;
  updatedAt: string;
}) {
  if (!input.snapshot.track) {
    return false;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("member_ssafy_verifications")
    .select("track,track_name")
    .eq("member_id", input.memberId)
    .maybeSingle();
  if (error) {
    throw new MemberProfileSyncError("verification_lookup_failed");
  }
  if (!data) {
    return false;
  }
  if (
    data.track === input.snapshot.track
    && data.track_name === input.snapshot.trackName
  ) {
    return false;
  }

  const { error: updateError } = await supabase
    .from("member_ssafy_verifications")
    .update({
      track: input.snapshot.track,
      track_name: input.snapshot.trackName,
      updated_at: input.updatedAt,
    })
    .eq("member_id", input.memberId);
  if (updateError) {
    throw new MemberProfileSyncError("verification_update_failed");
  }
  return true;
}

export async function syncMemberMattermostProfile(
  memberId: string,
): Promise<MattermostProfileSyncResult | MattermostProfileUnavailableResult | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("members")
    .select(
      "id,display_name,generation,mattermost_account_id",
    )
    .eq("id", memberId)
    .is("deleted_at", null)
    .is("mattermost_login_disabled_at", null)
    .maybeSingle();
  if (error) {
    throw new MemberProfileSyncError("member_lookup_failed");
  }
  if (!data?.id) {
    return null;
  }

  const member = data as MemberMattermostSyncRow;
  const linkedDirectory = await loadMattermostDirectory(member);
  if (!linkedDirectory?.mm_user_id) {
    return null;
  }

  let snapshot = await fetchMemberSnapshotByUserId(linkedDirectory.mm_user_id);
  if (snapshot && snapshot.mmUserId !== linkedDirectory.mm_user_id) {
    throw new MemberProfileSyncError("identity_mismatch");
  }
  if (!snapshot) {
    const usernameSnapshot = await fetchMemberSnapshotByUsername({
      username: linkedDirectory.mm_username,
      generation: member.generation,
    });
    if (!usernameSnapshot) {
      try {
        await markMemberMattermostLoginUnavailable({
          memberId: member.id,
          reason: "provider_not_found",
        });
      } catch {
        throw new MemberProfileSyncError("mattermost_unavailable_mark_failed");
      }
      return {
        unavailable: true,
        member: {
          id: member.id,
          generation: member.generation,
          mattermostAccountId: linkedDirectory.id,
          mmUserId: linkedDirectory.mm_user_id,
          mmUsername: linkedDirectory.mm_username,
        },
      };
    }
    if (usernameSnapshot.mmUserId !== linkedDirectory.mm_user_id) {
      throw new MemberProfileSyncError("identity_mismatch");
    }
    snapshot = usernameSnapshot;
  }

  let refreshedDirectory: Awaited<ReturnType<typeof findMmUserDirectoryEntryByUserId>>;
  try {
    await upsertMmUserDirectorySnapshot({
      mmUserId: snapshot.mmUserId,
      mmUsername: snapshot.mmUsername,
      displayName: snapshot.displayName,
      campus: snapshot.campus,
      isStaff: member.generation === 0,
      sourceYears:
        member.generation && member.generation > 0 ? [member.generation] : [],
    });
    refreshedDirectory = await findMmUserDirectoryEntryByUserId(snapshot.mmUserId);
  } catch {
    throw new MemberProfileSyncError("directory_sync_failed");
  }
  if (!refreshedDirectory?.id) {
    throw new MemberProfileSyncError("directory_sync_failed");
  }

  const patch = buildMattermostProfileSyncPatch(
    {
      displayName: member.display_name,
      mmUsername: linkedDirectory.mm_username,
    },
    {
      displayName: snapshot.displayName,
      campus: snapshot.campus,
      mmUsername: snapshot.mmUsername,
    },
  );
  const changedFields = [...patch.changedFields] as MemberSyncField[];
  let profileImage: Awaited<ReturnType<typeof syncMemberProfileImage>>;
  try {
    profileImage = await syncMemberProfileImage({
      memberId: member.id,
      imageSource: "mattermost",
      avatarBase64: snapshot.avatarBase64,
      avatarContentType: snapshot.avatarContentType,
      avatarUrl: snapshot.avatarUrl,
    });
  } catch {
    throw new MemberProfileSyncError("profile_image_failed");
  }
  const imageUpdated = profileImage.updated;
  const imageSkipped = profileImage.skipped;

  const updatedAt = new Date().toISOString();
  const memberUpdate = patch.member;
  if (Object.keys(memberUpdate).length > 0) {
    const { error: updateError } = await supabase
      .from("members")
      .update({
        ...memberUpdate,
        updated_at: updatedAt,
    })
      .eq("id", member.id)
      .is("deleted_at", null);
    if (updateError) {
      throw new MemberProfileSyncError("member_update_failed");
    }
  }

  if (imageUpdated) {
    changedFields.push("avatar");
  }

  const trackUpdated = await syncSsafyVerificationTrack({
    memberId: member.id,
    snapshot,
    updatedAt,
  });
  if (trackUpdated) {
    changedFields.push("track");
  }

  return {
    member: {
      id: member.id,
      generation: member.generation,
      mattermostAccountId: refreshedDirectory.id,
      mmUserId: snapshot.mmUserId,
      mmUsername: snapshot.mmUsername,
    },
    snapshot,
    updated: changedFields.length > 0,
    changedFields,
    imageUpdated,
    imageSkipped,
  };
}
