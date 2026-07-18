import { notFound } from "next/navigation";
import AdminMemberSignupApprovalDetail from "@/components/admin/AdminMemberSignupApprovalDetail";
import AdminShell from "@/components/admin/AdminShell";
import { requireMemberSignupRequestAdmin } from "@/lib/admin-access";
import { getMattermostSignupApprovalRequest } from "@/lib/mm-signup-approval/repository";
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
  searchParams?: Promise<{ error?: string }>;
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
  const errorMessage = query.error === "invalid_fields"
    ? "이름·기수·캠퍼스 입력을 확인해 주세요."
    : query.error === "invalid_reason"
      ? "반려 사유를 1~500자로 입력해 주세요."
      : query.error === "approval_failed"
        ? "승인하지 못했습니다. 요청이 이미 처리되었거나 회원 정보가 충돌했을 수 있습니다."
        : query.error === "rejection_failed"
          ? "반려하지 못했습니다. 요청이 이미 처리되었을 수 있습니다."
          : null;

  return (
    <AdminShell title="가입 승인 검토">
      <AdminMemberSignupApprovalDetail
        request={request}
        approveAction={approveMemberSignupRequestAction}
        rejectAction={rejectMemberSignupRequestAction}
        error={errorMessage}
      />
    </AdminShell>
  );
}
