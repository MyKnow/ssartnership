"use server";

import { redirect } from "next/navigation";
import { isAdminSession } from "@/lib/auth";
import { partnerReviewRepository } from "@/lib/repositories";
import { logAdminAction, revalidateReviewPaths } from "./shared-helpers";
import { redirectAdminActionError } from "./shared-helpers";

function getSafeReturnTo(value: FormDataEntryValue | null) {
  const candidate = typeof value === "string" ? value : "";
  return candidate.startsWith("/") ? candidate : "/admin/reviews";
}

export async function hidePartnerReviewAction(formData: FormData) {
  const reviewId = String(formData.get("reviewId") ?? "").trim();
  const returnTo = getSafeReturnTo(formData.get("returnTo"));

  if (!(await isAdminSession())) {
    redirect("/admin/login");
  }
  if (!reviewId) {
    redirectAdminActionError(returnTo, "review_invalid_request");
  }

  const hidden = await partnerReviewRepository.hidePartnerReview(reviewId);
  if (!hidden) {
    redirectAdminActionError(returnTo, "review_not_found");
  }

  await logAdminAction("partner_review_hide", {
    targetType: "partner_review",
    targetId: hidden.reviewId,
    properties: {
      partnerId: hidden.partnerId,
    },
  });

  revalidateReviewPaths(hidden.partnerId);
  redirect(returnTo);
}

export async function restorePartnerReviewAction(formData: FormData) {
  const reviewId = String(formData.get("reviewId") ?? "").trim();
  const returnTo = getSafeReturnTo(formData.get("returnTo"));

  if (!(await isAdminSession())) {
    redirect("/admin/login");
  }
  if (!reviewId) {
    redirectAdminActionError(returnTo, "review_invalid_request");
  }

  const restored = await partnerReviewRepository.restorePartnerReview(reviewId);
  if (!restored) {
    redirectAdminActionError(returnTo, "review_not_found");
  }

  await logAdminAction("partner_review_restore", {
    targetType: "partner_review",
    targetId: restored.reviewId,
    properties: {
      partnerId: restored.partnerId,
    },
  });

  revalidateReviewPaths(restored.partnerId);
  redirect(returnTo);
}
