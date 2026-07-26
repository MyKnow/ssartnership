import { getMemberProfilePhotoStates } from "@/lib/member-profile-images";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const PROFILE_PHOTO_QUEUE_LIMIT = 50;

export type AdminProfilePhotoReplacementReadModel = {
  id: string;
  member_id: string;
  created_at: string;
  member: {
    id: string;
    display_name: string | null;
    year: number | null;
  } | null;
};

export type AdminExistingProfilePhotoReadModel = {
  id: string;
  display_name: string | null;
  year: number | null;
  updated_at: string;
};

export type AdminProfilePhotoReplacementQueueReadModel = {
  replacements: AdminProfilePhotoReplacementReadModel[];
  queueLoadError: boolean;
};

export type AdminCurrentProfilePhotoQueueReadModel = {
  currentPhotos: AdminExistingProfilePhotoReadModel[];
  queueLoadError: boolean;
};

type MemberProfileImageRelation = {
  id: string;
  member_id: string | null;
  created_at: string | null;
  updated_at?: string | null;
  member:
    | {
        id: string;
        display_name: string | null;
        generation: number | null;
      }
    | Array<{
        id: string;
        display_name: string | null;
        generation: number | null;
      }>
    | null;
};

function getMember(
  value: MemberProfileImageRelation["member"],
) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function mapReplacementRows(
  rows: MemberProfileImageRelation[],
) {
  return rows.flatMap((replacement) => {
    const member = getMember(replacement.member);
    if (!member || !replacement.member_id || !replacement.created_at) {
      return [];
    }
    return [
      {
        id: replacement.id,
        member_id: replacement.member_id,
        created_at: replacement.created_at,
        member: {
          id: member.id,
          display_name: member.display_name,
          year: member.generation ?? null,
        },
      },
    ] satisfies AdminProfilePhotoReplacementReadModel[];
  });
}

function emptyReplacementQueue(): AdminProfilePhotoReplacementQueueReadModel {
  return {
    replacements: [],
    queueLoadError: true,
  };
}

function emptyCurrentPhotoQueue(): AdminCurrentProfilePhotoQueueReadModel {
  return {
    currentPhotos: [],
    queueLoadError: true,
  };
}

/**
 * Primary read model for the profile-photo replacement queue. Keep this
 * query independent from the slower active-photo ledger check so a reviewer
 * can start the highest-priority work immediately.
 */
export async function getAdminProfilePhotoReplacementQueueReadModel(): Promise<AdminProfilePhotoReplacementQueueReadModel> {
  try {
    const supabase = getSupabaseAdminClient();
    const result = await supabase
      .from("member_profile_images")
      .select(
        "id,member_id,created_at,member:members!member_profile_images_member_id_fkey(id,display_name,generation)",
      )
      .is("graduate_verification_request_id", null)
      .not("member_id", "is", null)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(PROFILE_PHOTO_QUEUE_LIMIT);
    if (result.error) return emptyReplacementQueue();
    return {
      replacements: mapReplacementRows(
        (result.data ?? []) as MemberProfileImageRelation[],
      ),
      queueLoadError: false,
    };
  } catch {
    return emptyReplacementQueue();
  }
}

/**
 * Deferred read model for the current approved-photo audit list. It performs
 * an additional active-photo ledger check and must not delay replacement
 * requests, which are the primary review task on this route.
 */
export async function getAdminCurrentProfilePhotoQueueReadModel(): Promise<AdminCurrentProfilePhotoQueueReadModel> {
  try {
    const supabase = getSupabaseAdminClient();
    const result = await supabase
      .from("member_profile_images")
      .select(
        "id,member_id,created_at,updated_at,member:members!member_profile_images_member_id_fkey(id,display_name,generation)",
      )
      .not("member_id", "is", null)
      .eq("status", "approved")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(PROFILE_PHOTO_QUEUE_LIMIT * 4);
    if (result.error) return emptyCurrentPhotoQueue();

    const rows = (result.data ?? []) as MemberProfileImageRelation[];
    const currentPhotoStates = await getMemberProfilePhotoStates(
      rows.flatMap((image) => (image.member_id ? [image.member_id] : [])),
    );
    const currentPhotos = rows
      .flatMap((image) => {
        const member = getMember(image.member);
        const state = member ? currentPhotoStates.get(member.id) : null;
        if (
          !member
          || state?.reviewStatus !== "approved"
          || state.activeProfileImageId !== image.id
        ) {
          return [];
        }
        return [
          {
            id: member.id,
            display_name: member.display_name,
            year: member.generation ?? null,
            updated_at: image.updated_at ?? image.created_at ?? "",
          },
        ] satisfies AdminExistingProfilePhotoReadModel[];
      })
      .slice(0, PROFILE_PHOTO_QUEUE_LIMIT);

    return { currentPhotos, queueLoadError: false };
  } catch {
    return emptyCurrentPhotoQueue();
  }
}

/**
 * Combined reader retained for callers that need both queues synchronously.
 * The route uses the focused readers above to stream the primary queue first.
 */
export async function getAdminProfilePhotoQueueReadModel() {
  const [replacementQueue, currentPhotoQueue] = await Promise.all([
    getAdminProfilePhotoReplacementQueueReadModel(),
    getAdminCurrentProfilePhotoQueueReadModel(),
  ]);

  return {
    replacements: replacementQueue.replacements,
    currentPhotos: currentPhotoQueue.currentPhotos,
    queueLoadError:
      replacementQueue.queueLoadError || currentPhotoQueue.queueLoadError,
  }
}
