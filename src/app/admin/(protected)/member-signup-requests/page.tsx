import AdminMemberSignupApprovalQueue, {
  getSignupApprovalStatusMessage,
} from "@/components/admin/AdminMemberSignupApprovalQueue";
import AdminShell from "@/components/admin/AdminShell";
import { requireMemberSignupRequestAdmin } from "@/lib/admin-access";
import { listMattermostSignupApprovalRequests } from "@/lib/mm-signup-approval/repository";
import { getAdminReviewQueueFeedback } from "@/lib/admin-review-queue";
import { sanitizeReturnTo } from "@/lib/return-to";

export const dynamic = "force-dynamic";

export default async function AdminMemberSignupRequestsPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; error?: string; success?: string; returnTo?: string }>;
}) {
  await requireMemberSignupRequestAdmin("read", {
    path: "/admin/member-signup-requests",
  });
  const params = (await searchParams) ?? {};
  const requests = await listMattermostSignupApprovalRequests("pending");
  const returnTo = sanitizeReturnTo(
    params.returnTo,
    "/admin/member-signup-requests",
  );

  return (
    <AdminShell title="가입 승인">
      <AdminMemberSignupApprovalQueue
        requests={requests}
        statusMessage={getSignupApprovalStatusMessage(params.status)}
        returnTo={returnTo}
        feedback={getAdminReviewQueueFeedback({
          error: params.error,
          success: params.success ?? params.status,
        })}
      />
    </AdminShell>
  );
}
