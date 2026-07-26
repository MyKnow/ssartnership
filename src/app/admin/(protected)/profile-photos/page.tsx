import { Suspense } from "react";
import AdminProfilePhotoReviewQueue from "@/components/admin/AdminProfilePhotoReviewQueue";
import AdminShell from "@/components/admin/AdminShell";
import { AdminProfilePhotosSkeletonContent } from "@/components/loading/AdminPageSkeletons";
import { requireAdminPermission } from "@/lib/admin-access";
import { canAdmin } from "@/lib/admin-permissions";
import {
  getAdminCurrentProfilePhotoQueueReadModel,
  getAdminProfilePhotoReplacementQueueReadModel,
} from "@/lib/admin-profile-photo-queue.server";
import { getAdminReviewQueueFeedback } from "@/lib/admin-review-queue";
import { sanitizeReturnTo } from "@/lib/return-to";
import {
  approveMemberProfilePhotoAction,
  rejectMemberCurrentProfilePhotoAction,
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
  const currentPhotosPromise = getAdminCurrentProfilePhotoQueueReadModel();
  const { replacements, queueLoadError } =
    await getAdminProfilePhotoReplacementQueueReadModel();
  const returnTo = sanitizeReturnTo(params.returnTo, "/admin/profile-photos");

  return (
    <AdminProfilePhotoReviewQueue
        replacements={replacements}
        currentPhotosPromise={currentPhotosPromise}
        actions={{
          approveReplacement: approveMemberProfilePhotoAction,
          rejectReplacement: rejectMemberProfilePhotoAction,
          rejectCurrentPhoto: rejectMemberCurrentProfilePhotoAction,
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
      <Suspense fallback={<AdminProfilePhotosSkeletonContent />}>
        <AdminProfilePhotosContent session={session} params={params} />
      </Suspense>
    </AdminShell>
  );
}
