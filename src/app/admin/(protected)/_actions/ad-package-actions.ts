"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAdminSession } from "@/lib/auth";
import { requireAdminPermission } from "@/lib/admin-access";
import {
  parseCreateAdCampaignForm,
  parseCreateAdCouponForm,
} from "@/lib/ad-package-validation";
import type { AdCampaignStatus } from "@/lib/ad-packages";
import { adPackageRepository } from "@/lib/repositories";
import { logAdminAction } from "./shared-helpers";

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
  await requireAdminPermission("home_ads", "create", { path: "/admin/advertisement" });
  const input = parseCreateAdCouponForm(formData);
  const coupon = await adPackageRepository.createCoupon(input);

  await logAdminAction("ad_coupon_create", {
    targetType: "ad_coupon",
    targetId: coupon.id,
    properties: {
      issue: 64,
      partnerId: coupon.partnerId,
      campaignId: coupon.campaignId,
      redemptionType: coupon.redemptionType,
    },
  });
  revalidateAdPackagePaths(coupon.partnerId);
  redirectAdvertisement("ad-coupon-created");
}
