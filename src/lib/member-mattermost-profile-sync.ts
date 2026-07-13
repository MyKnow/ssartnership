import {
  normalizeMattermostProfileImage,
} from "@/lib/graduate-verification-files";
import { storeMemberProfileImage } from "@/lib/graduate-verification-storage";
import { buildMattermostProfileSyncPatch } from "@/lib/member-domain";
import {
  findMmUserDirectoryEntryByUsername,
  upsertMmUserDirectorySnapshot,
} from "@/lib/mm-directory";
import { fetchMemberSnapshotByUserId } from "@/lib/mm-member-sync";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const ALLOWED_IMAGE_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type MemberMattermostSyncRow = {
  id: string;
  display_name: string | null;
  campus: string | null;
  generation: number | null;
  year: number | null;
  active_profile_image_id: string | null;
  mattermost_account_id: string | null;
  mm_user_id: string | null;
  mm_username: string | null;
};

type MattermostDirectoryRow = {
  id: string;
  mm_user_id: string;
  mm_username: string;
};

export type MattermostProfileSyncResult = {
  updated: boolean;
  changedFields: Array<"displayName" | "campus" | "mmUsername" | "avatar">;
  imageUpdated: boolean;
  imageSkipped: boolean;
};

function normalizeContentType(value: string | null) {
  const normalized = value?.trim().toLowerCase() ?? "";
  return ALLOWED_IMAGE_CONTENT_TYPES.has(normalized) ? normalized : null;
}

function isValidBase64(value: string) {
  const normalized = value.replace(/\s/g, "");
  if (!normalized || normalized.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
    return false;
  }
  const decoded = Buffer.from(normalized, "base64");
  return decoded.length > 0
    && decoded.toString("base64").replace(/=+$/u, "")
      === normalized.replace(/=+$/u, "");
}

export function decodeMattermostProfileImageData(
  value: string | null | undefined,
  fallbackContentType: string | null | undefined,
) {
  if (!value) {
    return null;
  }

  const dataUriMatch = value.match(/^data:([^;,]+);base64,([\s\S]+)$/iu);
  const contentType = normalizeContentType(
    dataUriMatch?.[1] ?? fallbackContentType ?? null,
  );
  const encoded = dataUriMatch?.[2] ?? value;
  if (!contentType || !isValidBase64(encoded)) {
    return null;
  }

  return {
    contentType,
    source: Buffer.from(encoded.replace(/\s/g, ""), "base64"),
  };
}

async function loadMattermostDirectory(member: MemberMattermostSyncRow) {
  const supabase = getSupabaseAdminClient();
  if (member.mattermost_account_id) {
    const { data } = await supabase
      .from("mm_user_directory")
      .select("id,mm_user_id,mm_username")
      .eq("id", member.mattermost_account_id)
      .maybeSingle();
    if (data?.id) {
      return data as MattermostDirectoryRow;
    }
  }

  if (!member.mm_user_id) {
    return null;
  }
  const { data } = await supabase
    .from("mm_user_directory")
    .select("id,mm_user_id,mm_username")
    .eq("mm_user_id", member.mm_user_id)
    .maybeSingle();
  return (data as MattermostDirectoryRow | null) ?? null;
}

async function createOrReuseMattermostProfileImage(input: {
  member: MemberMattermostSyncRow;
  contentType: string;
  source: Buffer;
}) {
  const normalized = await normalizeMattermostProfileImage({
    contentType: input.contentType,
    source: input.source,
  });
  const supabase = getSupabaseAdminClient();
  const { data: existing } = await supabase
    .from("member_profile_images")
    .select("id")
    .eq("member_id", input.member.id)
    .eq("sha256", normalized.sha256)
    .eq("status", "approved")
    .is("deleted_at", null)
    .maybeSingle();
  if (existing?.id) {
    return { imageId: existing.id as string, changed: existing.id !== input.member.active_profile_image_id };
  }

  const storagePath = await storeMemberProfileImage({
    memberId: input.member.id,
    sha256: normalized.sha256,
    buffer: normalized.buffer,
  });
  const { data: image, error } = await supabase
    .from("member_profile_images")
    .insert({
      member_id: input.member.id,
      storage_path: storagePath,
      sha256: normalized.sha256,
      content_type: normalized.contentType,
      width: normalized.width,
      height: normalized.height,
      source: "mattermost",
      status: "approved",
      reviewed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !image?.id) {
    throw new Error("Mattermost 프로필 사진 상태를 저장하지 못했습니다.");
  }
  return { imageId: image.id as string, changed: true };
}

export async function syncMemberMattermostProfile(memberId: string): Promise<MattermostProfileSyncResult | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("members")
    .select("id,display_name,campus,generation,year,active_profile_image_id,mattermost_account_id,mm_user_id,mm_username")
    .eq("id", memberId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !data?.id) {
    return null;
  }

  const member = data as MemberMattermostSyncRow;
  const linkedDirectory = await loadMattermostDirectory(member);
  const mmUserId = linkedDirectory?.mm_user_id ?? member.mm_user_id;
  if (!mmUserId) {
    return null;
  }

  const snapshot = await fetchMemberSnapshotByUserId(mmUserId);
  if (!snapshot) {
    return null;
  }

  const generation = member.generation ?? member.year;
  await upsertMmUserDirectorySnapshot({
    mmUserId: snapshot.mmUserId,
    mmUsername: snapshot.mmUsername,
    displayName: snapshot.displayName,
    campus: snapshot.campus,
    isStaff: generation === 0,
    sourceYears: generation && generation > 0 ? [generation] : [],
  });
  const refreshedDirectory = await findMmUserDirectoryEntryByUsername(snapshot.mmUsername);
  if (!refreshedDirectory?.id) {
    throw new Error("Mattermost 계정 연결을 저장하지 못했습니다.");
  }

  const patch = buildMattermostProfileSyncPatch(
    {
      displayName: member.display_name,
      campus: member.campus,
      mmUsername: linkedDirectory?.mm_username ?? member.mm_username,
    },
    {
      displayName: snapshot.displayName,
      campus: snapshot.campus,
      mmUsername: snapshot.mmUsername,
    },
  );
  const changedFields = [...patch.changedFields] as MattermostProfileSyncResult["changedFields"];
  let activeProfileImageId = member.active_profile_image_id;
  let imageUpdated = false;
  let imageSkipped = false;

  const decodedImage = decodeMattermostProfileImageData(
    snapshot.avatarBase64,
    snapshot.avatarContentType,
  );
  if (decodedImage) {
    try {
      const image = await createOrReuseMattermostProfileImage({
        member,
        ...decodedImage,
      });
      activeProfileImageId = image.imageId;
      imageUpdated = image.changed;
      if (image.changed) {
        changedFields.push("avatar");
      }
    } catch {
      // Mattermost avatar data is external input. A malformed or oversized image
      // must not block the independently valid name/campus profile update.
      imageSkipped = true;
    }
  }

  const updatedAt = new Date().toISOString();
  if (
    member.active_profile_image_id
    && activeProfileImageId
    && activeProfileImageId !== member.active_profile_image_id
  ) {
    await supabase
      .from("member_profile_images")
      .update({
        status: "superseded",
        delete_after: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: updatedAt,
      })
      .eq("id", member.active_profile_image_id)
      .eq("status", "approved");
  }

  const memberUpdate = {
    ...patch.member,
    mattermost_account_id: refreshedDirectory.id,
    // Compatibility fields are written until the contract migration removes
    // legacy MM columns after the deployed readers have switched.
    mm_user_id: snapshot.mmUserId,
    mm_username: snapshot.mmUsername,
    ...(activeProfileImageId
      ? {
          active_profile_image_id: activeProfileImageId,
          profile_photo_review_status: "approved",
        }
      : {}),
    updated_at: updatedAt,
  };
  const { error: updateError } = await supabase
    .from("members")
    .update(memberUpdate)
    .eq("id", member.id)
    .is("deleted_at", null);
  if (updateError) {
    throw new Error("Mattermost 프로필을 반영하지 못했습니다.");
  }

  return {
    updated: changedFields.length > 0,
    changedFields,
    imageUpdated,
    imageSkipped,
  };
}
