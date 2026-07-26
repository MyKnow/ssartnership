import { notFound } from "next/navigation";
import AdminMemberSignupApprovalDetail from "@/components/admin/AdminMemberSignupApprovalDetail";
import AdminShell from "@/components/admin/AdminShell";
import { requireMemberSignupRequestAdmin } from "@/lib/admin-access";
import { getMattermostSignupApprovalRequest } from "@/lib/mm-signup-approval/repository";
import { getAdminReviewQueueFeedback } from "@/lib/admin-review-queue";
import { sanitizeReturnTo } from "@/lib/return-to";
import {
  approveMemberSignupRequestAction,
  rejectMemberSignupRequestAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminMemberSignupRequestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ requestId: string }>;
  searchParams?: Promise<{ error?: string; success?: string; returnTo?: string }>;
}) {
  await requireMemberSignupRequestAdmin("read", {
    path: "/admin/member-signup-requests",
  });
  const { requestId } = await params;
  const request = await getMattermostSignupApprovalRequest(requestId);
  if (!request) {
    notFound();
  }
  const query = (await searchParams) ?? {};
  const returnTo = sanitizeReturnTo(
    query.returnTo,
    "/admin/member-signup-requests",
  );

  return (
    <AdminShell title="가입 승인 검토">
      <AdminMemberSignupApprovalDetail
        request={request}
        approveAction={approveMemberSignupRequestAction}
        rejectAction={rejectMemberSignupRequestAction}
        returnTo={returnTo}
        focusRejectReason={query.error === "invalid_reason"}
        feedback={getAdminReviewQueueFeedback({
          error: query.error,
          success: query.success,
        })}
      />
    </AdminShell>
  );
}
