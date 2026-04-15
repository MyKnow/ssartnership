"use server";

import { cancelPartnerChangeRequestActionImpl } from "./_actions/cancel";
import { submitPartnerChangeRequestAction } from "./_actions/approval";
import { savePartnerImmediateChangesAction } from "./_actions/immediate";

export async function savePartnerImmediateChanges(formData: FormData) {
  return savePartnerImmediateChangesAction(formData);
}

export async function submitPartnerChangeRequest(formData: FormData) {
  return submitPartnerChangeRequestAction(formData);
}

export async function cancelPartnerChangeRequestAction(formData: FormData) {
  return cancelPartnerChangeRequestActionImpl(formData);
}
