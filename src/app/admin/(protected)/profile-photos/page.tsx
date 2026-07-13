import AdminProfilePhotoReviewQueue, {
  type AdminExistingProfilePhoto,
  type AdminProfilePhotoReplacement,
} from "@/components/admin/AdminProfilePhotoReviewQueue";
import AdminShell from "@/components/admin/AdminShell";
import { requireAdminPermission } from "@/lib/admin-access";
import { getMemberProfilePhotoStates } from "@/lib/member-profile-images";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  approveMemberProfilePhotoAction,
  rejectMemberCurrentProfilePhotoAction,
  rejectMemberProfilePhotoAction,
} from "./actions";

export const dynamic = "force-dynamic";

const PHOTO_QUEUE_LIMIT = 50;

export default async function AdminProfilePhotosPage() {
  await requireAdminPermission("profile_images", "read", { path: "/admin/profile-photos" });
  const supabase = getSupabaseAdminClient();
  const [replacementsResult, currentPhotosResult] = await Promise.all([
    supabase
      .from("member_profile_images")
      .select("id,member_id,created_at,member:members!member_profile_images_member_id_fkey(id,display_name,generation)")
      .is("graduate_verification_request_id", null)
      .not("member_id", "is", null)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(PHOTO_QUEUE_LIMIT),
    supabase
      .from("member_profile_images")
      .select("id,member_id,created_at,updated_at,member:members!member_profile_images_member_id_fkey(id,display_name,generation)")
      .not("member_id", "is", null)
      .eq("status", "approved")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(PHOTO_QUEUE_LIMIT * 4),
  ]);

  if (replacementsResult.error || currentPhotosResult.error) {
    throw new Error("프로필 사진 검토 큐를 불러오지 못했습니다.");
  }

  const currentPhotoStates = await getMemberProfilePhotoStates(
    (currentPhotosResult.data ?? []).flatMap((image) =>
      image.member_id ? [image.member_id] : [],
    ),
  );

  const replacements = (replacementsResult.data ?? []).flatMap((replacement) => {
    const member = Array.isArray(replacement.member)
      ? replacement.member[0]
      : replacement.member;
    if (!member) return [];
    return [
      {
        ...replacement,
        member: {
          ...member,
          year: member.generation ?? null,
        },
      },
    ] as AdminProfilePhotoReplacement[];
  });
  const currentPhotos = (currentPhotosResult.data ?? []).flatMap((image) => {
    const member = Array.isArray(image.member) ? image.member[0] : image.member;
    const state = member ? currentPhotoStates.get(member.id) : null;
    if (
      !member
      || state?.reviewStatus !== "approved"
      || state.activeProfileImageId !== image.id
    ) return [];
    return [{
      id: member.id,
      display_name: member.display_name,
      year: member.generation ?? null,
      updated_at: image.updated_at ?? image.created_at ?? "",
    }] as AdminExistingProfilePhoto[];
  }).slice(0, PHOTO_QUEUE_LIMIT);

  return (
    <AdminShell title="프로필 사진">
      <AdminProfilePhotoReviewQueue
        replacements={replacements}
        currentPhotos={currentPhotos}
        actions={{
          approveReplacement: approveMemberProfilePhotoAction,
          rejectReplacement: rejectMemberProfilePhotoAction,
          rejectCurrentPhoto: rejectMemberCurrentProfilePhotoAction,
        }}
      />
    </AdminShell>
  );
}
