import AdminGraduateVerificationQueue, {
  type AdminGraduateProfileImageReplacement,
  type AdminGraduateSetupEmailRetry,
  type AdminGraduateVerificationRequest,
} from "@/components/admin/AdminGraduateVerificationQueue";
import AdminShell from "@/components/admin/AdminShell";
import { requireAdminPermission } from "@/lib/admin-access";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  approveGraduateProfileImageAction,
  approveGraduateVerificationAction,
  rejectGraduateProfileImageAction,
  rejectGraduateVerificationAction,
  resendGraduateAccountSetupEmailAction,
  requestGraduateVerificationResubmissionAction,
  startGraduateVerificationReviewAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminGraduateVerificationsPage() {
  await requireAdminPermission("graduate_verifications", "read", { path: "/admin/graduate-verifications" });
  const supabase = getSupabaseAdminClient();
  const [requestsResult, setupEmailRetriesResult, photosResult] = await Promise.all([
    supabase.from("graduate_verification_requests").select("id,email,legal_name,completion_stage,education_start_year,education_start_month,education_end_year,education_end_month,inferred_cohort,campus,status,profile_image_id,created_at").in("status", ["submitted", "in_review"]).order("created_at", { ascending: false }),
    supabase
      .from("graduate_verification_requests")
      .select("id,email,legal_name,setup_email_last_error_at")
      .eq("status", "approved")
      .not("setup_email_last_error_at", "is", null)
      .order("setup_email_last_error_at", { ascending: false }),
    supabase.from("member_profile_images").select("id,member_id,created_at,member:members(display_name,year)").is("graduate_verification_request_id", null).not("member_id", "is", null).eq("status", "pending").order("created_at", { ascending: false }),
  ]);
  if (requestsResult.error || setupEmailRetriesResult.error || photosResult.error) throw new Error("수료생 인증 검토 큐를 불러오지 못했습니다.");

  const photoReplacements: AdminGraduateProfileImageReplacement[] = (photosResult.data ?? []).map((image) => ({
    id: image.id,
    member_id: image.member_id,
    created_at: image.created_at,
    member: Array.isArray(image.member) ? image.member[0] ?? null : image.member ?? null,
  }));

  return (
    <AdminShell title="수료생 인증">
      <AdminGraduateVerificationQueue
        requests={(requestsResult.data ?? []) as AdminGraduateVerificationRequest[]}
        setupEmailRetries={(setupEmailRetriesResult.data ?? []) as AdminGraduateSetupEmailRetry[]}
        photoReplacements={photoReplacements}
        actions={{
          startReview: startGraduateVerificationReviewAction,
          requestResubmission: requestGraduateVerificationResubmissionAction,
          approveRequest: approveGraduateVerificationAction,
          rejectRequest: rejectGraduateVerificationAction,
          resendSetupEmail: resendGraduateAccountSetupEmailAction,
          approvePhoto: approveGraduateProfileImageAction,
          rejectPhoto: rejectGraduateProfileImageAction,
        }}
      />
    </AdminShell>
  );
}
