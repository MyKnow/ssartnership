import { buildMattermostProfileSyncPatch } from "@/lib/member-domain";
import {
  activateMemberProfileImage,
  createOrReuseMemberProfileImage,
  decodeMemberProfileImageData,
} from "@/lib/member-profile-images";
import {
  findMmUserDirectoryEntryByUsername,
  upsertMmUserDirectorySnapshot,
} from "@/lib/mm-directory";
import { fetchMemberSnapshotByUserId } from "@/lib/mm-member-sync/snapshot";
import type {
  MemberSyncField,
  MemberSyncSnapshot,
  NormalizedMemberSyncSubject,
} from "@/lib/mm-member-sync/shared";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

type MemberMattermostSyncRow = {
  id: string;
  display_name: string | null;
  campus: string | null;
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
    throw new Error("Mattermost 계정 디렉터리를 불러오지 못했습니다.");
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
    throw new Error("SSAFY 인증 정보를 불러오지 못했습니다.");
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
    throw new Error("SSAFY 트랙 정보를 반영하지 못했습니다.");
  }
  return true;
}

export async function syncMemberMattermostProfile(
  memberId: string,
): Promise<MattermostProfileSyncResult | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("members")
    .select(
      "id,display_name,campus,generation,mattermost_account_id",
    )
    .eq("id", memberId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !data?.id) {
    return null;
  }

  const member = data as MemberMattermostSyncRow;
  const linkedDirectory = await loadMattermostDirectory(member);
  if (!linkedDirectory?.mm_user_id) {
    return null;
  }

  const snapshot = await fetchMemberSnapshotByUserId(linkedDirectory.mm_user_id);
  if (!snapshot) {
    return null;
  }

  await upsertMmUserDirectorySnapshot({
    mmUserId: snapshot.mmUserId,
    mmUsername: snapshot.mmUsername,
    displayName: snapshot.displayName,
    campus: snapshot.campus,
    isStaff: member.generation === 0,
    sourceYears:
      member.generation && member.generation > 0 ? [member.generation] : [],
  });
  const refreshedDirectory = await findMmUserDirectoryEntryByUsername(
    snapshot.mmUsername,
  );
  if (!refreshedDirectory?.id) {
    throw new Error("Mattermost 계정 연결을 저장하지 못했습니다.");
  }

  const patch = buildMattermostProfileSyncPatch(
    {
      displayName: member.display_name,
      campus: member.campus,
      mmUsername: linkedDirectory.mm_username,
    },
    {
      displayName: snapshot.displayName,
      campus: snapshot.campus,
      mmUsername: snapshot.mmUsername,
    },
  );
  const changedFields = [...patch.changedFields] as MemberSyncField[];
  let nextProfileImageId: string | null = null;
  let imageUpdated = false;
  let imageSkipped = false;

  const decodedImage = decodeMemberProfileImageData(
    snapshot.avatarBase64,
    snapshot.avatarContentType,
  );
  if (decodedImage) {
    try {
      const image = await createOrReuseMemberProfileImage({
        memberId: member.id,
        ...decodedImage,
        imageSource: "mattermost",
      });
      nextProfileImageId = image.changed ? image.imageId : null;
    } catch {
      // An external profile image must never block independent profile fields.
      imageSkipped = true;
    }
  }

  const updatedAt = new Date().toISOString();
  const memberUpdate = {
    ...patch.member,
    ...(member.mattermost_account_id !== refreshedDirectory.id
      ? { mattermost_account_id: refreshedDirectory.id }
      : {}),
  };
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
      throw new Error("Mattermost 프로필을 반영하지 못했습니다.");
    }
  }

  if (nextProfileImageId) {
    try {
      await activateMemberProfileImage({
        memberId: member.id,
        nextImageId: nextProfileImageId,
        updatedAt,
      });
      imageUpdated = true;
      changedFields.push("avatar");
    } catch {
      imageSkipped = true;
    }
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
