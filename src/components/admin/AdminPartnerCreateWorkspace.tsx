"use client";

import { useActionState, useMemo, useState } from "react";
import PartnerCardForm, {
  type PartnerCardCategoryOption,
  type PartnerCardCompanyOption,
  type PartnerCardFormField,
  type PartnerCardFormValues,
} from "@/components/PartnerCardForm";
import AdminPartnerFileImportForm from "@/components/admin/AdminPartnerFileImportForm";
import Tabs from "@/components/ui/Tabs";
import { createPartnerFormAction } from "@/app/admin/(protected)/actions";
import {
  PARTNER_CREATE_FORM_INITIAL_STATE,
  type PartnerCreateFormState,
} from "@/lib/partner-form-state";
import { partnerFormErrorMessages } from "@/lib/partner-form-errors";
import type { AdminPartnerFileDraft } from "@/lib/admin-partner-file-import";

type CreateMode = "single" | "csv";

const createModeOptions = [
  {
    value: "single",
    label: "단건 추가",
    description: "하나의 브랜드를 카드 폼으로 직접 입력합니다.",
  },
  {
    value: "csv",
    label: "파일로 채우기",
    description: "한 브랜드 XLSX 값을 단건 입력 폼에 반영합니다.",
  },
] satisfies Array<{
  value: CreateMode;
  label: string;
  description: string;
}>;

const partnerFormFocusByError: Record<string, PartnerCardFormField> = {
  partner_form_missing_required: "name",
  partner_form_missing_name: "name",
  partner_form_missing_category: "categoryId",
  partner_form_missing_location: "location",
  partner_form_invalid_detail_description: "detailDescription",
  partner_form_invalid_campus_slugs: "campusSlugs",
  partner_form_invalid_period: "periodStart",
  partner_form_invalid_map_url: "mapUrl",
  partner_form_invalid_benefit_action_type: "benefitActionType",
  partner_form_invalid_benefit_action_link: "benefitActionLink",
  partner_form_invalid_reservation_url: "reservationLink",
  partner_form_invalid_inquiry_url: "inquiryLink",
  partner_form_invalid_visibility: "visibility",
  partner_form_invalid_benefit_visibility: "benefitVisibility",
  partner_form_invalid_applies_to: "appliesTo",
  partner_company_missing_name: "companyName",
  partner_company_missing_email: "companyContactEmail",
  partner_company_invalid_email: "companyContactEmail",
};

function buildFieldErrors(state: PartnerCreateFormState) {
  if (state.status !== "error" || !state.errorCode) {
    return undefined;
  }
  const focusField = partnerFormFocusByError[state.errorCode];
  const message = partnerFormErrorMessages[state.errorCode];
  if (!focusField || !message) {
    return undefined;
  }
  return { [focusField]: message } as Partial<Record<PartnerCardFormField, string>>;
}

export default function AdminPartnerCreateWorkspace({
  partner,
  categoryOptions,
  companyOptions,
  categoryId,
}: {
  partner: PartnerCardFormValues;
  categoryOptions: PartnerCardCategoryOption[];
  companyOptions: PartnerCardCompanyOption[];
  categoryId: string;
}) {
  const [mode, setMode] = useState<CreateMode>("single");
  const [partnerDraft, setPartnerDraft] = useState(partner);
  const [draftCategoryId, setDraftCategoryId] = useState(categoryId);
  const [draftRevision, setDraftRevision] = useState(0);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const [state, formAction] = useActionState(
    createPartnerFormAction,
    PARTNER_CREATE_FORM_INITIAL_STATE,
  );
  const fieldErrors = useMemo(() => buildFieldErrors(state), [state]);
  const focusField =
    state.status === "error" && state.errorCode
      ? partnerFormFocusByError[state.errorCode]
      : undefined;
  const formError =
    state.status === "error" && state.errorCode && !fieldErrors
      ? partnerFormErrorMessages[state.errorCode] ??
        "브랜드를 추가하지 못했습니다. 입력값을 확인해 주세요."
      : null;

  return (
    <div className="mt-6 grid gap-6">
      <Tabs value={mode} onChange={setMode} options={createModeOptions} />

      {mode === "single" ? (
        <div className="grid gap-4">
          {draftNotice ? (
            <p className="rounded-[1rem] border border-success/20 bg-success/10 px-4 py-3 text-sm font-semibold text-success">
              {draftNotice}
            </p>
          ) : null}
          <PartnerCardForm
            key={draftRevision}
            mode="create"
            partner={partnerDraft}
            categoryOptions={categoryOptions}
            companyOptions={companyOptions}
            categoryId={draftCategoryId}
            formAction={formAction}
            submitLabel="브랜드 추가"
            focusField={focusField}
            fieldErrors={fieldErrors}
            formError={formError}
          />
        </div>
      ) : (
        <AdminPartnerFileImportForm
          onApplyDraft={(draft: AdminPartnerFileDraft) => {
            setPartnerDraft((current) => ({
              ...draft.partner,
              visibility: current.visibility,
              benefitVisibility: current.benefitVisibility,
              campusSlugs: current.campusSlugs,
              appliesTo: current.appliesTo,
            }));
            setDraftCategoryId(draft.categoryId || categoryId);
            setDraftRevision((current) => current + 1);
            setDraftNotice(
              "파일 값이 반영되었습니다. 검토 후 브랜드 추가를 눌러 저장하세요.",
            );
            setMode("single");
          }}
        />
      )}
    </div>
  );
}
