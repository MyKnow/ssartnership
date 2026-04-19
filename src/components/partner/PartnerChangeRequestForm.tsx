"use client";

import { useState } from "react";
import FormMessage from "@/components/ui/FormMessage";
import Tabs from "@/components/ui/Tabs";
import type {
  PartnerChangeRequestContext,
  PartnerChangeRequestSummary,
} from "@/lib/partner-change-requests";
import { ApprovalChangeForm } from "./partner-change-request-form/ApprovalChangeForm";
import { ImmediateChangeForm } from "./partner-change-request-form/ImmediateChangeForm";
import { PendingRequestNotice } from "./partner-change-request-form/PendingRequestNotice";

type PartnerChangeRequestTab = "immediate" | "approval";

type PartnerChangeRequestFormProps = {
  context: PartnerChangeRequestContext;
  pendingRequest: PartnerChangeRequestSummary | null;
  canCancelPendingRequest: boolean;
  errorMessage?: string | null;
  successMessage?: string | null;
  saveImmediateAction: (formData: FormData) => void | Promise<void>;
  createAction: (formData: FormData) => void | Promise<void>;
  cancelAction: (formData: FormData) => void | Promise<void>;
};

export default function PartnerChangeRequestForm({
  context,
  pendingRequest,
  canCancelPendingRequest,
  errorMessage,
  successMessage,
  saveImmediateAction,
  createAction,
  cancelAction,
}: PartnerChangeRequestFormProps) {
  const [activeTab, setActiveTab] =
    useState<PartnerChangeRequestTab>("immediate");

  return (
    <div className="space-y-6">
      {errorMessage ? <FormMessage variant="error">{errorMessage}</FormMessage> : null}
      {successMessage ? <FormMessage>{successMessage}</FormMessage> : null}

      {pendingRequest ? (
        <PendingRequestNotice
          pendingRequest={pendingRequest}
          canCancelPendingRequest={canCancelPendingRequest}
          cancelAction={cancelAction}
        />
      ) : null}

      <Tabs
        value={activeTab}
        onChange={setActiveTab}
        options={[
          {
            value: "immediate",
            label: "즉시 반영",
            description: "썸네일 · 추가 이미지 · 링크 · 태그",
          },
          {
            value: "approval",
            label: "승인 요청",
            description: "브랜드 정보 · 기간 · 조건 · 혜택 · 적용 대상",
          },
        ]}
      />

      <div hidden={activeTab !== "immediate"} className="space-y-6">
        <ImmediateChangeForm
          context={context}
          saveImmediateAction={saveImmediateAction}
        />
      </div>

      <div hidden={activeTab !== "approval"} className="space-y-6">
        <ApprovalChangeForm
          context={context}
          pendingRequest={pendingRequest}
          createAction={createAction}
        />
      </div>
    </div>
  );
}
