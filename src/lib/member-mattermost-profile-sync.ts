import { buildMattermostProfileSyncPatch } from "@/lib/member-domain";
import { markMemberMattermostLoginUnavailable } from "@/lib/member-email-login-transition";
import { syncMemberProfileImage } from "@/lib/member-profile-images";
import { upsertMmUserDirectorySnapshot } from "@/lib/mm-directory";
import { withActiveMattermostSenderForSubject } from "@/lib/mattermost-senders/service";
import {
  resolveMattermostLifecycle,
  toMattermostLifecycleResult,
} from "@/lib/mm-member-sync/lifecycle";
import { fetchMemberSnapshotForUser } from "@/lib/mm-member-sync/snapshot";
import { MemberProfileSyncError } from "@/lib/member-profile-sync-errors";
import type {
  MemberSyncField,
  MemberSyncSnapshot,
  NormalizedMemberSyncSubject,
} from "@/lib/mm-member-sync/shared";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export type MemberMattermostSyncRow = {
  id: string;
  display_name: string | null;
  generation: number | null;
  mattermost_account_id: string | null;
};

export type MattermostDirectoryRow = {
  id: string;
  mm_user_id: string;
  mm_username: string;
  is_staff: boolean;
  source_years: number[];
};

export type MattermostSyncTarget = {
  member: MemberMattermostSyncRow;
  directory: MattermostDirectoryRow;
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
  lifecycleStatus: "graduated" | "departed";
  detailCode: string;
  providerRequestId: null;
  transitionReason: "generation_completed" | "member_departed";
};

async function loadMattermostDirectory(member: MemberMattermostSyncRow) {
  if (!member.mattermost_account_id) {
    return null;
  }

  const { data, error } = await getSupabaseAdminClient()
    .from("mm_user_directory")
    .select("id,mm_user_id,mm_username,is_staff,source_years")
    .eq("id", member.mattermost_account_id)
    .maybeSingle();
  if (error) {
    throw new MemberProfileSyncError("directory_lookup_failed");
  }
  return (data as MattermostDirectoryRow | null) ?? null;
}

export function getMemberSyncSubject(
  member: MemberMattermostSyncRow,
  directory: MattermostDirectoryRow,
  mmUsername = directory.mm_username,
): NormalizedMemberSyncSubject {
  return {
    id: member.id,
    generation: member.generation,
    mattermostAccountId: directory.id,
    mmUserId: directory.mm_user_id,
    mmUsername,
  };
}

export function resolveLocalStaffRole(
  member: MemberMattermostSyncRow,
  directory: MattermostDirectoryRow,
) {
  if (member.generation === null || typeof directory.is_staff !== "boolean") {
    return null;
  }
  const generationIndicatesStaff = member.generation === 0;
  return generationIndicatesStaff === directory.is_staff
    ? generationIndicatesStaff
    : null;
}

export async function applyMattermostProfileSnapshot(input: {
  member: MemberMattermostSyncRow;
  directory: MattermostDirectoryRow;
  snapshot: MemberSyncSnapshot;
}) {
  const { member, directory, snapshot } = input;
  if (snapshot.mmUserId !== directory.mm_user_id) {
    throw new MemberProfileSyncError("identity_mismatch");
  }
  const localStaffRole = resolveLocalStaffRole(member, directory);
  if (localStaffRole === null) {
    throw new MemberProfileSyncError("lifecycle_unresolved");
  }

  const sourceYears = localStaffRole
    ? directory.source_years
    : member.generation && member.generation > 0
      ? [member.generation]
      : [];
  try {
    await upsertMmUserDirectorySnapshot({
      mmUserId: snapshot.mmUserId,
      mmUsername: snapshot.mmUsername,
      displayName: snapshot.displayName,
      campus: null,
      isStaff: localStaffRole,
      sourceYears,
    });
  } catch {
    throw new MemberProfileSyncError("directory_sync_failed");
  }

  const patch = buildMattermostProfileSyncPatch(
    {
      displayName: member.display_name,
      mmUsername: directory.mm_username,
    },
    {
      displayName: snapshot.displayName,
      campus: null,
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
      avatarUrl: null,
    });
  } catch {
    throw new MemberProfileSyncError("profile_image_failed");
  }

  const updatedAt = new Date().toISOString();
  if (Object.keys(patch.member).length > 0) {
    const { error: updateError } = await getSupabaseAdminClient()
      .from("members")
      .update({
        ...patch.member,
        updated_at: updatedAt,
      })
      .eq("id", member.id)
      .is("deleted_at", null);
    if (updateError) {
      throw new MemberProfileSyncError("member_update_failed");
    }
  }

  if (profileImage.updated) {
    changedFields.push("avatar");
  }

  return {
    member: getMemberSyncSubject(member, directory, snapshot.mmUsername),
    snapshot,
    updated: changedFields.length > 0,
    changedFields,
    imageUpdated: profileImage.updated,
    imageSkipped: profileImage.skipped,
  } satisfies MattermostProfileSyncResult;
}

export async function syncMemberMattermostProfile(
  memberId: string,
): Promise<MattermostProfileSyncResult | MattermostProfileUnavailableResult | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("members")
    .select("id,display_name,generation,mattermost_account_id")
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
  const directory = await loadMattermostDirectory(member);
  if (!directory?.mm_user_id) {
    return null;
  }

  const isStaff = resolveLocalStaffRole(member, directory);
  if (isStaff === null) {
    throw new MemberProfileSyncError("lifecycle_unresolved");
  }

  const directLookup = await withActiveMattermostSenderForSubject(
    {
      generation: member.generation,
      isStaff,
      sourceYears: directory.source_years,
    },
    async (session) => {
      const user = await session.getUserById(directory.mm_user_id);
      if (user.id !== directory.mm_user_id) {
        throw new MemberProfileSyncError("identity_mismatch");
      }

      const lifecycle = toMattermostLifecycleResult(user);
      const resolution = resolveMattermostLifecycle({ result: lifecycle, isStaff });
      if (resolution.transitionReason) {
        return { lifecycle, resolution, snapshot: null };
      }
      const snapshot = await fetchMemberSnapshotForUser(user, session);
      return { lifecycle, resolution, snapshot };
    },
  );

  if (directLookup.resolution.transitionReason) {
    try {
      await markMemberMattermostLoginUnavailable({
        memberId: member.id,
        reason: directLookup.resolution.transitionReason,
      });
    } catch {
      throw new MemberProfileSyncError("mattermost_unavailable_mark_failed");
    }

    return {
      unavailable: true,
      member: getMemberSyncSubject(member, directory),
      lifecycleStatus: directLookup.resolution.lifecycleStatus === "departed"
        ? "departed"
        : "graduated",
      detailCode: directLookup.resolution.detailCode,
      providerRequestId: null,
      transitionReason: directLookup.resolution.transitionReason,
    };
  }

  if (!directLookup.snapshot || directLookup.resolution.lifecycleStatus !== "active") {
    throw new MemberProfileSyncError("lifecycle_unresolved");
  }

  return applyMattermostProfileSnapshot({
    member,
    directory,
    snapshot: directLookup.snapshot,
  });
}
