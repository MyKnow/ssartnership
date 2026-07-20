"use server";

import { revalidatePath } from "next/cache";
import { requireAdminPermission } from "@/lib/admin-access";
import { assertAdminCanAccessManagedCampuses } from "@/lib/admin-scope";
import {
  buildPartnerPreviewUrl,
  createPartnerPreviewToken,
  hashPartnerPreviewToken,
} from "@/lib/partner-preview";
import { encryptPartnerPreviewToken } from "@/lib/partner-preview-token-crypto";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";
import { logAdminAction } from "@/app/admin/(protected)/_actions/shared-helpers";

async function requireManagedPartner(partnerId: string) {
  if (!isUuid(partnerId)) {
    throw new Error("미리보기 링크 대상이 올바르지 않습니다.");
  }

  const adminSession = await requireAdminPermission("brands", "update", {
    path: "/admin/partners",
  });
  const supabase = getSupabaseAdminClient();
  const { data: partner, error } = await supabase
    .from("partners")
    .select("id,managed_campus_slugs")
    .eq("id", partnerId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!partner) {
    throw new Error("미리보기 링크 대상 제휴처를 찾을 수 없습니다.");
  }

  assertAdminCanAccessManagedCampuses(
    adminSession.account,
    partner.managed_campus_slugs,
  );

  return { adminSession, supabase, partner };
}

export async function generatePartnerPreviewLink(partnerId: string) {
  const normalizedPartnerId = typeof partnerId === "string" ? partnerId.trim() : "";
  const { adminSession, supabase } = await requireManagedPartner(normalizedPartnerId);
  const token = createPartnerPreviewToken();
  const encryptedToken = encryptPartnerPreviewToken(normalizedPartnerId, token);
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("partner_preview_tokens")
    .upsert(
      {
        partner_id: normalizedPartnerId,
        token_hash: hashPartnerPreviewToken(token),
        token_ciphertext: encryptedToken.ciphertext,
        token_nonce: encryptedToken.nonce,
        token_auth_tag: encryptedToken.authTag,
        token_key_version: encryptedToken.keyVersion,
        created_at: now,
      },
      { onConflict: "partner_id" },
    );

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction("partner_preview_link_create", {
    targetType: "partner",
    targetId: normalizedPartnerId,
    properties: {
      adminId: adminSession.adminId,
      createdAt: now,
    },
  });
  revalidatePath(`/admin/partners/${normalizedPartnerId}`);
  revalidatePath(`/partners/${normalizedPartnerId}`);

  return {
    previewUrl: buildPartnerPreviewUrl(normalizedPartnerId, token),
  };
}

export async function removePartnerPreviewLink(partnerId: string) {
  const normalizedPartnerId = typeof partnerId === "string" ? partnerId.trim() : "";
  const { adminSession, supabase } = await requireManagedPartner(normalizedPartnerId);
  const { error } = await supabase
    .from("partner_preview_tokens")
    .delete()
    .eq("partner_id", normalizedPartnerId);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction("partner_preview_link_remove", {
    targetType: "partner",
    targetId: normalizedPartnerId,
    properties: {
      adminId: adminSession.adminId,
    },
  });
  revalidatePath(`/admin/partners/${normalizedPartnerId}`);
  revalidatePath(`/partners/${normalizedPartnerId}`);
}
