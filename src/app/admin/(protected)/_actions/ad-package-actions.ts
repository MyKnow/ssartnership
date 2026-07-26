"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAdminSession } from "@/lib/auth";
import { requireAdminPermission } from "@/lib/admin-access";
import { assertAdminCanAccessManagedCampuses } from "@/lib/admin-scope";
import {
  parseCreateAdCampaignForm,
  parseCreateAdCouponForm,
  parseUpdateAdCouponForm,
} from "@/lib/ad-package-validation";
import { getSafeAdminActionErrorCode } from "@/lib/admin-action-errors";
import type { AdCampaignStatus } from "@/lib/ad-packages";
import type { DeleteAdCouponResult } from "@/lib/repositories/ad-package-repository";
import { adPackageRepository } from "@/lib/repositories";
import { normalizeCouponCodeRows } from "@/lib/ad-coupon-domain";
import { isUuid } from "@/lib/uuid";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { logAdminAction, redirectAdminActionError } from "./shared-helpers";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function redirectAdvertisement(status: string): never {
  redirect(`/admin/advertisement?status=${encodeURIComponent(status)}`);
}

function revalidateAdPackagePaths(partnerId?: string | null) {
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/advertisement");
  if (partnerId) {
    revalidatePath(`/partners/${partnerId}`);
    revalidatePath(`/admin/partners/${partnerId}`);
  }
}

function parseCampaignStatus(value: string): AdCampaignStatus {
  if (
    value === "draft" ||
    value === "active" ||
    value === "paused" ||
    value === "ended"
  ) {
    return value;
  }
  throw new Error("캠페인 상태를 확인해 주세요.");
}

async function assertManagedAdPartner(
  session: Awaited<ReturnType<typeof requireAdminPermission>>,
  partnerId: string,
) {
  if (!isUuid(partnerId)) {
    throw new Error("제휴처 정보를 확인해 주세요.");
  }
  const { data, error } = await getSupabaseAdminClient()
    .from("partners")
    .select("id,managed_campus_slugs,period_end")
    .eq("id", partnerId)
    .maybeSingle();
  if (error || !data) {
    throw new Error("제휴처를 찾을 수 없습니다.");
  }
  try {
    assertAdminCanAccessManagedCampuses(
      session.account,
      (data as { managed_campus_slugs?: string[] | null }).managed_campus_slugs,
    );
  } catch {
    throw new Error("제휴처 권한을 확인해 주세요.");
  }
  return {
    periodEnd:
      typeof (data as { period_end?: string | null }).period_end === "string"
        ? (data as { period_end: string }).period_end
        : null,
  };
}

async function assertCampaignBelongsToPartner(
  campaignId: string | null | undefined,
  partnerId: string,
) {
  if (!campaignId) {
    return;
  }
  if (!isUuid(campaignId)) {
    throw new Error("캠페인 정보를 확인해 주세요.");
  }
  const { data, error } = await getSupabaseAdminClient()
    .from("ad_campaigns")
    .select("partner_id")
    .eq("id", campaignId)
    .maybeSingle();
  if (error || !data || data.partner_id !== partnerId) {
    throw new Error("같은 제휴처의 캠페인만 연결할 수 있습니다.");
  }
}

function requireCouponId(formData: FormData) {
  const couponId = getString(formData, "couponId");
  if (!isUuid(couponId)) {
    throw new Error("쿠폰 정보를 확인해 주세요.");
  }
  return couponId;
}

function getCouponDetailPath(partnerId: string) {
  return isUuid(partnerId)
    ? `/admin/partners/${encodeURIComponent(partnerId)}`
    : "/admin/partners";
}

export async function createAdCampaignAction(formData: FormData) {
  await requireAdminPermission("home_ads", "create", { path: "/admin/advertisement" });
  const adminSession = await getAdminSession();
  const input = {
    ...parseCreateAdCampaignForm(formData),
    createdByAdminId: adminSession?.adminId ?? null,
  };
  const campaign = await adPackageRepository.createCampaign(input);

  await logAdminAction("ad_campaign_create", {
    targetType: "ad_campaign",
    targetId: campaign.id,
    properties: {
      issue: 64,
      partnerId: campaign.partnerId,
      packageTier: campaign.packageTier,
      channels: campaign.channels,
    },
  });
  revalidateAdPackagePaths(campaign.partnerId);
  redirectAdvertisement("ad-campaign-created");
}

export async function updateAdCampaignStatusAction(formData: FormData) {
  await requireAdminPermission("home_ads", "update", { path: "/admin/advertisement" });
  const campaignId = getString(formData, "campaignId");
  if (!campaignId) {
    throw new Error("캠페인을 찾을 수 없습니다.");
  }
  const status = parseCampaignStatus(getString(formData, "status"));
  await adPackageRepository.updateCampaignStatus({ campaignId, status });

  await logAdminAction("ad_campaign_status_update", {
    targetType: "ad_campaign",
    targetId: campaignId,
    properties: {
      issue: 64,
      status,
    },
  });
  revalidateAdPackagePaths();
  redirectAdvertisement("ad-campaign-updated");
}

export async function createAdCouponAction(formData: FormData) {
  const partnerId = getString(formData, "partnerId");
  const session = await requireAdminPermission("home_ads", "create", { path: "/admin/partners" });
  const detailPath = getCouponDetailPath(partnerId);
  let coupon: Awaited<ReturnType<typeof adPackageRepository.createCoupon>>;
  try {
    const managedPartner = await assertManagedAdPartner(session, partnerId);
    const input = parseCreateAdCouponForm(formData, {
      partnerPeriodEnd: managedPartner.periodEnd,
    });
    await assertCampaignBelongsToPartner(input.campaignId, input.partnerId);
    coupon = await adPackageRepository.createCoupon(input);
    const codePool = normalizeCouponCodeRows(
      String(formData.get("codePool") ?? "").split(/\r?\n/),
    );
    if (coupon.issuanceType === "partner_code_pool" && codePool.codes.length > 0) {
      await adPackageRepository.addCouponCodes({ couponId: coupon.id, codes: codePool.codes });
    }
  } catch (error) {
    redirectAdminActionError(
      detailPath,
      getSafeAdminActionErrorCode(error, "ad_coupon_create_failed"),
      {
        action: "ad_coupon_create",
        targetType: "ad_coupon",
        properties: { issue: 236, partnerId: isUuid(partnerId) ? partnerId : null },
      },
    );
  }

  await logAdminAction("ad_coupon_create", {
    targetType: "ad_coupon",
    targetId: coupon.id,
    properties: {
      issue: 64,
      partnerId: coupon.partnerId,
      campaignId: coupon.campaignId,
      redemptionType: coupon.redemptionType,
      issuanceType: coupon.issuanceType,
    },
  });
  revalidateAdPackagePaths(coupon.partnerId);
  redirect(
    `/admin/partners/${encodeURIComponent(coupon.partnerId)}?success=ad-coupon-created`,
  );
}

export async function updateAdCouponAction(formData: FormData) {
  const submittedPartnerId = getString(formData, "partnerId");
  const fallbackPath = getCouponDetailPath(submittedPartnerId);
  let couponId: string;
  try {
    couponId = requireCouponId(formData);
  } catch (error) {
    redirectAdminActionError(
      fallbackPath,
      getSafeAdminActionErrorCode(error, "ad_coupon_update_invalid_request"),
    );
  }
  const session = await requireAdminPermission("home_ads", "update", { path: "/admin/partners" });
  let existing: Awaited<ReturnType<typeof adPackageRepository.getAdminCouponById>>;
  try {
    existing = await adPackageRepository.getAdminCouponById(couponId);
  } catch {
    redirectAdminActionError(fallbackPath, "ad_coupon_update_failed");
  }
  if (!existing) {
    redirectAdminActionError(fallbackPath, "ad_coupon_update_not_found");
  }
  if (submittedPartnerId !== existing.partnerId) {
    redirectAdminActionError(
      getCouponDetailPath(existing.partnerId),
      "ad_coupon_update_invalid_request",
    );
  }
  let coupon: Awaited<ReturnType<typeof adPackageRepository.updateCoupon>>;
  try {
    const managedPartner = await assertManagedAdPartner(session, existing.partnerId);
    const parsedInput = parseUpdateAdCouponForm(formData, {
      partnerPeriodEnd: managedPartner.periodEnd,
    });
    const input = {
      ...parsedInput,
      // The legacy static code is no longer editable in the UI, but must not be
      // erased when an existing coupon is otherwise updated.
      code: formData.has("code") ? parsedInput.code : existing.code,
    };
    await assertCampaignBelongsToPartner(input.campaignId, existing.partnerId);
    coupon = await adPackageRepository.updateCoupon({
      ...input,
      partnerId: existing.partnerId,
    });
    const codePool = normalizeCouponCodeRows(
      String(formData.get("codePool") ?? "").split(/\r?\n/),
    );
    if (coupon.issuanceType === "partner_code_pool" && codePool.codes.length > 0) {
      await adPackageRepository.addCouponCodes({ couponId: coupon.id, codes: codePool.codes });
    }
  } catch (error) {
    redirectAdminActionError(
      getCouponDetailPath(existing.partnerId),
      getSafeAdminActionErrorCode(error, "ad_coupon_update_failed"),
      {
        action: "ad_coupon_update",
        targetType: "ad_coupon",
        targetId: couponId,
        properties: { issue: 236, partnerId: existing.partnerId },
      },
    );
  }
  await logAdminAction("ad_coupon_update", {
    targetType: "ad_coupon",
    targetId: coupon.id,
    properties: {
      issue: 64,
      partnerId: coupon.partnerId,
      campaignId: coupon.campaignId,
      redemptionType: coupon.redemptionType,
      issuanceType: coupon.issuanceType,
    },
  });
  revalidateAdPackagePaths(coupon.partnerId);
  redirect(`/admin/partners/${encodeURIComponent(coupon.partnerId)}?success=ad-coupon-updated`);
}

export async function duplicateAdCouponAction(formData: FormData) {
  const submittedPartnerId = getString(formData, "partnerId");
  const fallbackPath = getCouponDetailPath(submittedPartnerId);
  let couponId: string;
  try {
    couponId = requireCouponId(formData);
  } catch (error) {
    redirectAdminActionError(
      fallbackPath,
      getSafeAdminActionErrorCode(error, "ad_coupon_duplicate_invalid_request"),
    );
  }
  const session = await requireAdminPermission("home_ads", "create", { path: "/admin/partners" });
  let existing: Awaited<ReturnType<typeof adPackageRepository.getAdminCouponById>>;
  try {
    existing = await adPackageRepository.getAdminCouponById(couponId);
  } catch {
    redirectAdminActionError(fallbackPath, "ad_coupon_duplicate_failed");
  }
  if (!existing) {
    redirectAdminActionError(fallbackPath, "ad_coupon_duplicate_not_found");
  }
  let coupon: Awaited<ReturnType<typeof adPackageRepository.duplicateCoupon>>;
  try {
    await assertManagedAdPartner(session, existing.partnerId);
    coupon = await adPackageRepository.duplicateCoupon({ couponId });
  } catch (error) {
    redirectAdminActionError(
      getCouponDetailPath(existing.partnerId),
      getSafeAdminActionErrorCode(error, "ad_coupon_duplicate_failed"),
      {
        action: "ad_coupon_duplicate",
        targetType: "ad_coupon",
        targetId: couponId,
        properties: { issue: 236, partnerId: existing.partnerId },
      },
    );
  }
  await logAdminAction("ad_coupon_duplicate", {
    targetType: "ad_coupon",
    targetId: coupon.id,
    properties: {
      issue: 64,
      sourceCouponId: existing.id,
      partnerId: coupon.partnerId,
    },
  });
  revalidateAdPackagePaths(coupon.partnerId);
  redirect(`/admin/partners/${encodeURIComponent(coupon.partnerId)}?success=ad-coupon-duplicated`);
}

export async function deleteAdCouponAction(formData: FormData) {
  const submittedPartnerId = getString(formData, "partnerId");
  const fallbackPath = isUuid(submittedPartnerId)
    ? `/admin/partners/${encodeURIComponent(submittedPartnerId)}`
    : "/admin/partners";
  const session = await requireAdminPermission("home_ads", "delete", { path: "/admin/partners" });
  let couponId: string;
  try {
    couponId = requireCouponId(formData);
  } catch {
    redirectAdminActionError(fallbackPath, "ad_coupon_delete_invalid_request");
  }
  let existing: Awaited<ReturnType<typeof adPackageRepository.getAdminCouponById>>;
  try {
    existing = await adPackageRepository.getAdminCouponById(couponId);
  } catch {
    redirectAdminActionError(fallbackPath, "ad_coupon_delete_failed");
  }
  if (!existing) {
    redirectAdminActionError(fallbackPath, "ad_coupon_delete_not_found");
  }
  const detailPath = `/admin/partners/${encodeURIComponent(existing.partnerId)}`;
  if (submittedPartnerId !== existing.partnerId) {
    redirectAdminActionError(detailPath, "ad_coupon_delete_invalid_request", {
      action: "ad_coupon_delete",
      targetType: "ad_coupon",
      targetId: couponId,
      properties: { issue: 236, partnerId: existing.partnerId },
    });
  }
  try {
    await assertManagedAdPartner(session, existing.partnerId);
  } catch {
    redirectAdminActionError(detailPath, "ad_coupon_delete_failed", {
      action: "ad_coupon_delete",
      targetType: "ad_coupon",
      targetId: couponId,
      properties: { issue: 236, partnerId: existing.partnerId },
    });
  }
  let deletion: DeleteAdCouponResult;
  try {
    deletion = await adPackageRepository.deleteCoupon(couponId);
  } catch {
    redirectAdminActionError(detailPath, "ad_coupon_delete_failed", {
      action: "ad_coupon_delete",
      targetType: "ad_coupon",
      targetId: couponId,
      properties: { issue: 236, partnerId: existing.partnerId },
    });
  }
  if (!deletion.ok) {
    redirectAdminActionError(detailPath, "ad_coupon_delete_has_history", {
      action: "ad_coupon_delete",
      targetType: "ad_coupon",
      targetId: couponId,
      properties: { issue: 236, partnerId: existing.partnerId },
    });
  }
  await logAdminAction("ad_coupon_delete", {
    targetType: "ad_coupon",
    targetId: couponId,
    properties: {
      issue: 64,
      partnerId: existing.partnerId,
    },
  });
  revalidateAdPackagePaths(existing.partnerId);
  redirect(`/admin/partners/${encodeURIComponent(existing.partnerId)}?success=ad-coupon-deleted`);
}
