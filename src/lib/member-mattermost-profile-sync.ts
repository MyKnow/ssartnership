import { buildMattermostProfileSyncPatch } from "@/lib/member-domain";
import { syncMemberProfileImage } from "@/lib/member-profile-images";
import { upsertMmUserDirectorySnapshot } from "@/lib/mm-directory";
import {
  createMemberSyncApiClient,
  fetchMemberLifecycleByUserId,
  fetchMemberSnapshotByUserId,
} from "@/lib/mm-member-sync/snapshot";
import {
  resolveMattermostLifecycle,
  type MattermostLifecycleResult,
} from "@/lib/mm-member-sync/lifecycle";
import { markMemberMattermostLoginUnavailable } from "@/lib/member-email-login-transition";
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
  providerRequestId: string | null;
  transitionReason: "generation_completed" | "member_departed";
};

async function loadMattermostDirectory(member: MemberMattermostSyncRow) {
  if (!member.mattermost_account_id) {
    return null;
  }

  const { data, error } = await getSupabaseAdminClient()
    .from("mm_user_directory")
    .select("id,mm_user_id,mm_username,is_staff")
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

  const supabase = getSupabaseAdminClient();
  try {
    await upsertMmUserDirectorySnapshot({
      mmUserId: snapshot.mmUserId,
      mmUsername: snapshot.mmUsername,
      displayName: snapshot.displayName,
      campus: snapshot.campus,
      isStaff: localStaffRole,
      sourceYears:
        member.generation && member.generation > 0 ? [member.generation] : [],
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

  const updatedAt = new Date().toISOString();
  if (Object.keys(patch.member).length > 0) {
    const { error: updateError } = await supabase
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

  const trackUpdated = await syncSsafyVerificationTrack({
    memberId: member.id,
    snapshot,
    updatedAt,
  });
  if (trackUpdated) {
    changedFields.push("track");
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
  const linkedDirectory = await loadMattermostDirectory(member);
  if (!linkedDirectory?.mm_user_id) {
    return null;
  }

  const client = createMemberSyncApiClient({
    identifier: linkedDirectory.mm_user_id,
    flow: "member_profile_sync",
  });
  let lifecycle: MattermostLifecycleResult | null;
  try {
    lifecycle = await fetchMemberLifecycleByUserId(
      linkedDirectory.mm_user_id,
      client,
    );
  } catch {
    throw new MemberProfileSyncError("lifecycle_response_invalid");
  }

  const isStaff = resolveLocalStaffRole(member, linkedDirectory);
  if (isStaff === null) {
    throw new MemberProfileSyncError("lifecycle_unresolved");
  }
  const resolution = resolveMattermostLifecycle({
    result: lifecycle,
    isStaff,
  });
  if (resolution.transitionReason) {
    const terminalLifecycleStatus = resolution.lifecycleStatus === "departed"
      ? "departed"
      : "graduated";

    try {
      await markMemberMattermostLoginUnavailable({
        memberId: member.id,
        reason: resolution.transitionReason,
      });
    } catch {
      throw new MemberProfileSyncError("mattermost_unavailable_mark_failed");
    }

    return {
      unavailable: true,
      member: getMemberSyncSubject(member, linkedDirectory),
      lifecycleStatus: terminalLifecycleStatus,
      detailCode: resolution.detailCode,
      providerRequestId: lifecycle?.requestId ?? null,
      transitionReason: resolution.transitionReason,
    };
  }

  if (resolution.lifecycleStatus !== "active") {
    throw new MemberProfileSyncError("lifecycle_unresolved");
  }

  const snapshot = await fetchMemberSnapshotByUserId(
    linkedDirectory.mm_user_id,
    client,
  );
  if (!snapshot) {
    throw new MemberProfileSyncError("provider_response_invalid");
  }

  return applyMattermostProfileSnapshot({
    member,
    directory: linkedDirectory,
    snapshot,
  });
}
