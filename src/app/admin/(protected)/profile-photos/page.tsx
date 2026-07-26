import AdminProfilePhotoReviewQueue from "@/components/admin/AdminProfilePhotoReviewQueue";
import AdminShell from "@/components/admin/AdminShell";
import { requireAdminPermission } from "@/lib/admin-access";
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
  await requireAdminPermission("profile_images", "read", { path: "/admin/profile-photos" });
  const currentPhotosPromise = getAdminCurrentProfilePhotoQueueReadModel();
  const { replacements, queueLoadError } =
    await getAdminProfilePhotoReplacementQueueReadModel();
  const params = (await searchParams) ?? {};
  const returnTo = sanitizeReturnTo(params.returnTo, "/admin/profile-photos");

  return (
    <AdminShell title="프로필 사진">
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
      />
    </AdminShell>
  );
}
