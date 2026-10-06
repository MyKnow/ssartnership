import "server-only";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
export const PROFILE_IMAGE_RETENTION_DAYS = 30;

export async function activateMemberProfileImageRecord(memberId: string, imageId: string) {
  const { data, error } = await getSupabaseAdminClient().rpc(
    "activate_member_profile_image_atomic",
    { input_member_id: memberId, input_image_id: imageId },
  );
  if (error || data !== true) {
    throw new Error("현재 프로필 사진을 반영하지 못했습니다.");
  }
  return true;
}

export async function findActiveProfileImageMember(memberId: string) {
  const { data, error } = await getSupabaseAdminClient().from("members")
    .select("id").eq("id", memberId).is("deleted_at", null).maybeSingle();
  if (error) throw new Error("회원 정보를 확인하지 못했습니다.");
  return data?.id ? { id: String(data.id) } : null;
}

export async function findMemberProfileImageByStoragePath(storagePath: string) {
  const { data, error } = await getSupabaseAdminClient().from("member_profile_images")
    .select("id,member_id,status").eq("storage_path", storagePath).maybeSingle();
  if (error) throw new Error("프로필 사진 상태를 확인하지 못했습니다.");
  return data ? { id: String(data.id), memberId: data.member_id as string | null, status: String(data.status) } : null;
}

export function supersedePendingProfileImages(memberId: string) {
  return getSupabaseAdminClient().from("member_profile_images").update({
    status: "superseded",
    delete_after: new Date(Date.now() + PROFILE_IMAGE_RETENTION_DAYS * 86_400_000).toISOString(),
  }).eq("member_id", memberId).is("graduate_verification_request_id", null).eq("status", "pending");
}
export function insertPendingProfileImage(row: Record<string, unknown>) {
  return getSupabaseAdminClient().from("member_profile_images").insert({ ...row, status: "pending" }).select("id").single();
}
export function deletePendingProfileImage(imageId: string) {
  return getSupabaseAdminClient().from("member_profile_images").delete().eq("id", imageId).eq("status", "pending");
}
