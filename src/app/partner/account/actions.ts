"use server";

import { redirect } from "next/navigation";
import {
  archivePartnerBillingProfile,
  createPartnerBillingProfile,
  setDefaultPartnerBillingProfile,
} from "@/lib/partner-billing-profiles";
import type { PartnerBillingActionErrorCode } from "@/lib/partner-billing-action-errors";
import {
  appendPartnerPortalSearchParam,
  getPartnerGlobalPortalHref,
} from "@/lib/partner-portal-paths";
import { isPartnerPortalCompanyAllowed } from "@/lib/partner-portal-scope";
import { getPartnerSession } from "@/lib/partner-session";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function getAccountPath(companyId: string) {
  return getPartnerGlobalPortalHref("account", companyId);
}

function getAccountPathWithStatus(
  companyId: string,
  key: "status" | "error",
  value: string,
) {
  return appendPartnerPortalSearchParam(getAccountPath(companyId), key, value);
}

function redirectAccountInfo(
  companyId: string,
  param: "created" | "defaulted" | "archived",
): never {
  redirect(getAccountPathWithStatus(companyId, "status", param));
}

function redirectAccountInfoError(
  companyId: string,
  code: PartnerBillingActionErrorCode,
): never {
  redirect(getAccountPathWithStatus(companyId, "error", code));
}

async function readAuthorizedSessionCompany(formData: FormData) {
  const session = await getPartnerSession();
  if (!session) {
    redirect("/partner/login");
  }
  if (session.mustChangePassword) {
    redirect("/partner/change-password");
  }

  const companyId = getString(formData, "companyId");
  if (!companyId || !isPartnerPortalCompanyAllowed(session, companyId)) {
    redirectAccountInfoError(companyId, "access_denied");
  }

  return { session, companyId };
}

export async function createPartnerBillingProfileAction(formData: FormData) {
  const { session, companyId } = await readAuthorizedSessionCompany(formData);

  try {
    await createPartnerBillingProfile({
      accountId: session.accountId,
      companyId,
      form: {
        label: getString(formData, "label"),
        payerName: getString(formData, "payerName"),
        businessRegistrationNumber: getString(
          formData,
          "businessRegistrationNumber",
        ),
        businessName: getString(formData, "businessName"),
        representativeName: getString(formData, "representativeName"),
        businessAddress: getString(formData, "businessAddress"),
        businessType: getString(formData, "businessType"),
        businessItem: getString(formData, "businessItem"),
        taxInvoiceEmail: getString(formData, "taxInvoiceEmail"),
        isDefault: formData.get("isDefault") === "on",
      },
    });
  } catch (error) {
    console.error("[partner-account] billing profile create failed", {
      accountId: session.accountId,
      companyId,
      error,
    });
    redirectAccountInfoError(companyId, "profile_create_failed");
  }

  redirectAccountInfo(companyId, "created");
}

export async function setDefaultPartnerBillingProfileAction(formData: FormData) {
  const { session, companyId } = await readAuthorizedSessionCompany(formData);
  const profileId = getString(formData, "profileId");
  if (!profileId) {
    redirectAccountInfoError(companyId, "profile_not_found");
  }

  try {
    await setDefaultPartnerBillingProfile({
      accountId: session.accountId,
      companyId,
      profileId,
    });
  } catch (error) {
    console.error("[partner-account] default billing profile failed", {
      accountId: session.accountId,
      companyId,
      profileId,
      error,
    });
    redirectAccountInfoError(companyId, "profile_default_failed");
  }

  redirectAccountInfo(companyId, "defaulted");
}

export async function archivePartnerBillingProfileAction(formData: FormData) {
  const { session, companyId } = await readAuthorizedSessionCompany(formData);
  const profileId = getString(formData, "profileId");
  if (!profileId) {
    redirectAccountInfoError(companyId, "profile_not_found");
  }

  try {
    await archivePartnerBillingProfile({
      accountId: session.accountId,
      companyId,
      profileId,
    });
  } catch (error) {
    console.error("[partner-account] billing profile archive failed", {
      accountId: session.accountId,
      companyId,
      profileId,
      error,
    });
    redirectAccountInfoError(companyId, "profile_archive_failed");
  }

  redirectAccountInfo(companyId, "archived");
}
