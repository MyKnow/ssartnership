"use server";

import { redirect } from "next/navigation";
import {
  archivePartnerBillingProfile,
  createPartnerBillingProfile,
  setDefaultPartnerBillingProfile,
} from "@/lib/partner-billing-profiles";
import { getCompanyScopedPortalHref } from "@/lib/partner-portal-paths";
import { isPartnerPortalCompanyAllowed } from "@/lib/partner-portal-scope";
import { getPartnerSession } from "@/lib/partner-session";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function getAccountPath(companyId: string) {
  if (!companyId) {
    return "/partner";
  }
  return getCompanyScopedPortalHref(companyId, "account");
}

function redirectAccountInfo(
  companyId: string,
  param: "created" | "defaulted" | "archived",
): never {
  redirect(`${getAccountPath(companyId)}?status=${param}`);
}

function redirectAccountInfoError(companyId: string, error: unknown): never {
  const message = error instanceof Error ? error.message : "요청을 처리하지 못했습니다.";
  redirect(`${getAccountPath(companyId)}?error=${encodeURIComponent(message)}`);
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
    redirectAccountInfoError(companyId, new Error("협력사 접근 권한이 없습니다."));
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
    redirectAccountInfoError(companyId, error);
  }

  redirectAccountInfo(companyId, "created");
}

export async function setDefaultPartnerBillingProfileAction(formData: FormData) {
  const { session, companyId } = await readAuthorizedSessionCompany(formData);
  const profileId = getString(formData, "profileId");
  if (!profileId) {
    redirectAccountInfoError(companyId, new Error("계정 정보를 찾을 수 없습니다."));
  }

  try {
    await setDefaultPartnerBillingProfile({
      accountId: session.accountId,
      companyId,
      profileId,
    });
  } catch (error) {
    redirectAccountInfoError(companyId, error);
  }

  redirectAccountInfo(companyId, "defaulted");
}

export async function archivePartnerBillingProfileAction(formData: FormData) {
  const { session, companyId } = await readAuthorizedSessionCompany(formData);
  const profileId = getString(formData, "profileId");
  if (!profileId) {
    redirectAccountInfoError(companyId, new Error("계정 정보를 찾을 수 없습니다."));
  }

  try {
    await archivePartnerBillingProfile({
      accountId: session.accountId,
      companyId,
      profileId,
    });
  } catch (error) {
    redirectAccountInfoError(companyId, error);
  }

  redirectAccountInfo(companyId, "archived");
}
