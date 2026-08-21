import { Suspense } from "react";
import AdminProfilePhotoReviewQueue from "@/components/admin/AdminProfilePhotoReviewQueue";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminShell from "@/components/admin/AdminShell";
import { AdminProfilePhotosSkeletonContent } from "@/components/loading/AdminPageSkeletons";
import { requireAdminPermission } from "@/lib/admin-access";
import { canAdmin } from "@/lib/admin-permissions";
import { getAdminProfilePhotoReplacementQueueReadModel } from "@/lib/admin-profile-photo-queue.server";
import { getAdminReviewQueueFeedback } from "@/lib/admin-review-queue";
import { sanitizeReturnTo } from "@/lib/return-to";
import {
  approveMemberProfilePhotoAction,
  rejectMemberProfilePhotoAction,
} from "./actions";

export const dynamic = "force-dynamic";

async function AdminProfilePhotosContent({
  session,
  params,
}: {
  session: Awaited<ReturnType<typeof requireAdminPermission>>;
  params: {
    error?: string;
    success?: string;
    returnTo?: string;
    focus?: string;
  };
}) {
  const { replacements, queueLoadError } =
    await getAdminProfilePhotoReplacementQueueReadModel();
  const returnTo = sanitizeReturnTo(params.returnTo, "/admin/profile-photos");

  return (
    <AdminProfilePhotoReviewQueue
        replacements={replacements}
        actions={{
          approveReplacement: approveMemberProfilePhotoAction,
          rejectReplacement: rejectMemberProfilePhotoAction,
        }}
        feedback={getAdminReviewQueueFeedback({
          error: params.error,
          success: params.success,
        })}
        returnTo={returnTo}
        loadError={queueLoadError}
        focusReasonTarget={params.focus}
        canUpdate={canAdmin(
          session.account.permissions,
          "profile_images",
          "update",
        )}
        showPageHeader={false}
    />
  );
}

export default async function AdminProfilePhotosPage({
  searchParams,
}: {
  searchParams?: Promise<{
    error?: string;
    success?: string;
    returnTo?: string;
    focus?: string;
  }>;
}) {
  const session = await requireAdminPermission("profile_images", "read", {
    path: "/admin/profile-photos",
  });
  const params = (await searchParams) ?? {};

  return (
    <AdminShell title="프로필 사진">
      <div className="grid min-w-0 gap-6">
        <AdminPageHeader
          eyebrow="작업함"
          title="프로필 사진 검토"
          description="새 사진 교체 요청을 확인하고, 회원 인증에 영향을 주는 작업을 안전하게 처리합니다."
        />
        <Suspense fallback={<AdminProfilePhotosSkeletonContent showHeader={false} />}>
          <AdminProfilePhotosContent session={session} params={params} />
        </Suspense>
      </div>
    </AdminShell>
  );
}
