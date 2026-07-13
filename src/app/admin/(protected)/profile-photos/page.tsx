import AdminProfilePhotoReviewQueue, {
  type AdminExistingProfilePhoto,
  type AdminProfilePhotoReplacement,
} from "@/components/admin/AdminProfilePhotoReviewQueue";
import AdminShell from "@/components/admin/AdminShell";
import { requireAdminPermission } from "@/lib/admin-access";
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
      .select("id,member_id,created_at,member:members!member_profile_images_member_id_fkey(id,display_name,generation,profile_photo_review_status)")
      .is("graduate_verification_request_id", null)
      .not("member_id", "is", null)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(PHOTO_QUEUE_LIMIT),
    supabase
      .from("members")
      .select("id,display_name,generation,active_profile_image_id,profile_photo_review_status,updated_at")
      .eq("profile_photo_review_status", "approved")
      .not("active_profile_image_id", "is", null)
      .order("updated_at", { ascending: false })
      .limit(PHOTO_QUEUE_LIMIT),
  ]);

  if (replacementsResult.error || currentPhotosResult.error) {
    throw new Error("프로필 사진 검토 큐를 불러오지 못했습니다.");
  }

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
  const currentPhotos = (currentPhotosResult.data ?? []).map((member) => ({
    ...member,
    year: member.generation ?? null,
  })) as AdminExistingProfilePhoto[];

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
