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

/**
 * Server read model for the profile-photo review queue. The page owns only
 * authorization, feedback, and action wiring; the model owns queue queries
 * and the active-photo ledger check.
 */
export async function getAdminProfilePhotoQueueReadModel() {
  try {
    const supabase = getSupabaseAdminClient();
    const [replacementsResult, currentPhotosResult] = await Promise.all([
      supabase
        .from("member_profile_images")
        .select(
          "id,member_id,created_at,member:members!member_profile_images_member_id_fkey(id,display_name,generation)",
        )
        .is("graduate_verification_request_id", null)
        .not("member_id", "is", null)
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(PROFILE_PHOTO_QUEUE_LIMIT),
      supabase
        .from("member_profile_images")
        .select(
          "id,member_id,created_at,updated_at,member:members!member_profile_images_member_id_fkey(id,display_name,generation)",
        )
        .not("member_id", "is", null)
        .eq("status", "approved")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(PROFILE_PHOTO_QUEUE_LIMIT * 4),
    ]);
    if (replacementsResult.error || currentPhotosResult.error) {
      return {
        replacements: [] as AdminProfilePhotoReplacementReadModel[],
        currentPhotos: [] as AdminExistingProfilePhotoReadModel[],
        queueLoadError: true,
      };
    }

    const replacementRows =
      (replacementsResult.data ?? []) as MemberProfileImageRelation[];
    const currentPhotoRows =
      (currentPhotosResult.data ?? []) as MemberProfileImageRelation[];
    const currentPhotoStates = await getMemberProfilePhotoStates(
      currentPhotoRows.flatMap((image) =>
        image.member_id ? [image.member_id] : [],
      ),
    );
    const replacements = replacementRows.flatMap((replacement) => {
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
    const currentPhotos = currentPhotoRows
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

    return {
      replacements,
      currentPhotos,
      queueLoadError: false,
    };
  } catch {
    return {
      replacements: [] as AdminProfilePhotoReplacementReadModel[],
      currentPhotos: [] as AdminExistingProfilePhotoReadModel[],
      queueLoadError: true,
    };
  }
}
