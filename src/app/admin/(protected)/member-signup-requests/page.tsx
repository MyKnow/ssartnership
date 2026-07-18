import AdminMemberSignupApprovalQueue, {
  getSignupApprovalStatusMessage,
} from "@/components/admin/AdminMemberSignupApprovalQueue";
import AdminShell from "@/components/admin/AdminShell";
import { requireMemberSignupRequestAdmin } from "@/lib/admin-access";
import { listMattermostSignupApprovalRequests } from "@/lib/mm-signup-approval/repository";

export const dynamic = "force-dynamic";

export default async function AdminMemberSignupRequestsPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  await requireMemberSignupRequestAdmin("read", {
    path: "/admin/member-signup-requests",
  });
  const params = (await searchParams) ?? {};
  const requests = await listMattermostSignupApprovalRequests("pending");

  return (
    <AdminShell title="가입 승인">
      <AdminMemberSignupApprovalQueue
        requests={requests}
        statusMessage={getSignupApprovalStatusMessage(params.status)}
      />
    </AdminShell>
  );
}
