"use server";

import { redirect } from "next/navigation";
import { clearAdminSession } from "@/lib/auth";
import type { DirectMemberCreateFormState } from "@/lib/member-direct-create";
import type { ManualMemberAddFormState } from "@/lib/member-manual-add";
import type { PartnerCreateFormState } from "@/lib/partner-form-state";
import {
  applyAdminPermissionTemplateAction,
  createAdminAccountAction,
  grantMemberAdminPermissionAction,
  issueAdminInitialSetupLinkAction,
  updateAdminAccountStatusAction,
  updateAdminPermissionsAction,
} from "./_actions/admin-account-actions";
import {
  createPartnerAccountAction,
  createPartnerAccountInitialSetupUrlAction,
  sendPartnerAccountInitialSetupUrlAction,
  updatePartnerAccountAction,
  updatePartnerAccountCompanyConnectionAction,
} from "./_actions/account-actions";
import {
  createCategoryAction,
  createPartnerCompanyAction,
  deleteCategoryAction,
  deletePartnerCompanyAction,
  updateCategoryAction,
  updatePartnerCompanyAction,
} from "./_actions/catalog-actions";
import {
  deleteCohortCardThemeAction,
  earlyStartSsafyCycleAction,
  restoreSsafyCycleSettingsAction,
  updateSsafyCycleSettingsAction,
  upsertCohortCardThemeAction,
} from "./_actions/cycle-actions";
import {
  backfillMemberProfilesAction,
  createDirectMemberAction,
  deleteMemberAction,
  manualAddMembersAction,
  updateMemberAction,
} from "./_actions/member-actions";
import {
  approvePartnerChangeRequestAction,
  createPartnerFormActionImpl,
  deletePartnerAction,
  rejectPartnerChangeRequestAction,
  updatePartnerAction,
} from "./_actions/partner-actions";
import {
  approvePartnerPlanUpgradeRequestAction,
  confirmPartnerPlanBankTransferPaymentAction,
  rejectPartnerPlanUpgradeRequestAction,
  updatePartnerBrandPlanAction,
} from "./_actions/plan-actions";
import {
  deletePartnerReviewAction,
  hidePartnerReviewAction,
  restorePartnerReviewAction,
  updatePartnerReviewAction,
} from "./_actions/review-actions";
import { logAdminAction } from "./_actions/shared-helpers";

export async function updatePartnerAccount(formData: FormData) {
  return updatePartnerAccountAction(formData);
}

export async function createAdminAccount(formData: FormData) {
  return createAdminAccountAction(formData);
}

export async function grantMemberAdminPermission(formData: FormData) {
  return grantMemberAdminPermissionAction(formData);
}

export async function issueAdminInitialSetupLink(formData: FormData) {
  return issueAdminInitialSetupLinkAction(formData);
}

export async function updateAdminAccountStatus(formData: FormData) {
  return updateAdminAccountStatusAction(formData);
}

export async function updateAdminPermissions(formData: FormData) {
  return updateAdminPermissionsAction(formData);
}

export async function applyAdminPermissionTemplate(formData: FormData) {
  return applyAdminPermissionTemplateAction(formData);
}

export async function createPartnerAccount(formData: FormData) {
  return createPartnerAccountAction(formData);
}

export async function createPartnerAccountInitialSetupUrl(formData: FormData) {
  return createPartnerAccountInitialSetupUrlAction(formData);
}

export async function sendPartnerAccountInitialSetupUrl(formData: FormData) {
  return sendPartnerAccountInitialSetupUrlAction(formData);
}

export async function updatePartnerAccountCompanyConnection(formData: FormData) {
  return updatePartnerAccountCompanyConnectionAction(formData);
}

export async function createCategory(formData: FormData) {
  return createCategoryAction(formData);
}

export async function updateCategory(formData: FormData) {
  return updateCategoryAction(formData);
}

export async function deleteCategory(formData: FormData) {
  return deleteCategoryAction(formData);
}

export async function createPartnerCompany(formData: FormData) {
  return createPartnerCompanyAction(formData);
}

export async function updatePartnerCompany(formData: FormData) {
  return updatePartnerCompanyAction(formData);
}

export async function deletePartnerCompany(formData: FormData) {
  return deletePartnerCompanyAction(formData);
}

export async function updatePartnerBrandPlan(formData: FormData) {
  return updatePartnerBrandPlanAction(formData);
}

export async function approvePartnerPlanUpgradeRequest(formData: FormData) {
  return approvePartnerPlanUpgradeRequestAction(formData);
}

export async function confirmPartnerPlanBankTransferPayment(formData: FormData) {
  return confirmPartnerPlanBankTransferPaymentAction(formData);
}

export async function rejectPartnerPlanUpgradeRequest(formData: FormData) {
  return rejectPartnerPlanUpgradeRequestAction(formData);
}

export async function createPartnerFormAction(
  prevState: PartnerCreateFormState,
  formData: FormData,
): Promise<PartnerCreateFormState> {
  return createPartnerFormActionImpl(prevState, formData);
}

export async function updatePartner(formData: FormData) {
  return updatePartnerAction(formData);
}

export async function approvePartnerChangeRequest(formData: FormData) {
  return approvePartnerChangeRequestAction(formData);
}

export async function rejectPartnerChangeRequest(formData: FormData) {
  return rejectPartnerChangeRequestAction(formData);
}

export async function hidePartnerReview(formData: FormData) {
  return hidePartnerReviewAction(formData);
}

export async function restorePartnerReview(formData: FormData) {
  return restorePartnerReviewAction(formData);
}

export async function updatePartnerReview(formData: FormData) {
  return updatePartnerReviewAction(formData);
}

export async function deletePartnerReview(formData: FormData) {
  return deletePartnerReviewAction(formData);
}

export async function deletePartner(formData: FormData) {
  return deletePartnerAction(formData);
}

export async function backfillMemberProfiles() {
  return backfillMemberProfilesAction();
}

export async function updateMember(formData: FormData) {
  return updateMemberAction(formData);
}

export async function manualAddMembers(
  prevState: ManualMemberAddFormState,
  formData: FormData,
): Promise<ManualMemberAddFormState> {
  return manualAddMembersAction(prevState, formData);
}

export async function createDirectMember(
  prevState: DirectMemberCreateFormState,
  formData: FormData,
): Promise<DirectMemberCreateFormState> {
  return createDirectMemberAction(prevState, formData);
}

export async function updateSsafyCycleSettings(formData: FormData) {
  return updateSsafyCycleSettingsAction(formData);
}

export async function earlyStartSsafyCycle() {
  return earlyStartSsafyCycleAction();
}

export async function restoreSsafyCycleSettings() {
  return restoreSsafyCycleSettingsAction();
}

export async function upsertCohortCardTheme(formData: FormData) {
  return upsertCohortCardThemeAction(formData);
}

export async function deleteCohortCardTheme(formData: FormData) {
  return deleteCohortCardThemeAction(formData);
}

export async function deleteMember(formData: FormData) {
  return deleteMemberAction(formData);
}

export async function logout() {
  await logAdminAction("logout");
  await clearAdminSession();
  redirect("/");
}
