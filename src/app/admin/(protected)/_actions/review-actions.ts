"use server";

import { redirect } from "next/navigation";
import { isAdminSession } from "@/lib/auth";
import { partnerReviewRepository } from "@/lib/repositories";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
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

export async function updatePartnerReviewAction(formData: FormData) {
  const reviewId = String(formData.get("reviewId") ?? "").trim();
  const returnTo = getSafeReturnTo(formData.get("returnTo"));
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const rating = Number.parseInt(String(formData.get("rating") ?? "").trim(), 10);

  if (!(await isAdminSession())) {
    redirect("/admin/login");
  }
  if (!reviewId || !title || !body || !Number.isFinite(rating) || rating < 1 || rating > 5) {
    redirectAdminActionError(returnTo, "review_invalid_request");
  }

  const supabase = getSupabaseAdminClient();
  const { data: review, error } = await supabase
    .from("partner_reviews")
    .update({
      title,
      body,
      rating,
      updated_at: new Date().toISOString(),
    })
    .eq("id", reviewId)
    .is("deleted_at", null)
    .select("id,partner_id")
    .maybeSingle();

  if (error) {
    redirectAdminActionError(returnTo, "review_invalid_request");
  }
  if (!review) {
    redirectAdminActionError(returnTo, "review_not_found");
  }

  await logAdminAction("partner_review_update", {
    targetType: "partner_review",
    targetId: review.id,
    properties: {
      partnerId: review.partner_id,
      rating,
      titleLength: title.length,
      bodyLength: body.length,
    },
  });

  revalidateReviewPaths(review.partner_id);
  redirect(returnTo);
}

export async function deletePartnerReviewAction(formData: FormData) {
  const reviewId = String(formData.get("reviewId") ?? "").trim();
  const returnTo = getSafeReturnTo(formData.get("returnTo"));

  if (!(await isAdminSession())) {
    redirect("/admin/login");
  }
  if (!reviewId) {
    redirectAdminActionError(returnTo, "review_invalid_request");
  }

  const deleted = await partnerReviewRepository.deletePartnerReview(reviewId);
  if (!deleted) {
    redirectAdminActionError(returnTo, "review_not_found");
  }

  await logAdminAction("partner_review_delete", {
    targetType: "partner_review",
    targetId: deleted.reviewId,
    properties: {
      partnerId: deleted.partnerId,
    },
  });

  revalidateReviewPaths(deleted.partnerId);
  redirect(returnTo);
}
