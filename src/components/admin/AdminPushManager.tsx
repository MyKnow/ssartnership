"use client";

import { useState } from "react";
import Tabs from "@/components/ui/Tabs";
import { getMemberLabel } from "./push-manager/constants";
import { PushComposerSection } from "./push-manager/PushComposerSection";
import { PushLogsSection } from "./push-manager/PushLogsSection";
import { useAdminPushManager } from "./push-manager/useAdminPushManager";
import type { AdminPushManagerProps } from "./push-manager/types";

export type {
  AdminPushComposerState,
  AdminPushLogFilterState,
  AdminPushManagerProps,
  MemberOption,
  PartnerOption,
  SortOption,
} from "./push-manager/types";
export {
  createAudienceYearOptions,
  createCampusOptions,
  createYearOptions,
  countTargetableMembers,
  filterPushLogs,
} from "./push-manager/selectors";

type AdminPushTab = "logs" | "send";

const adminPushTabOptions = [
  {
    value: "logs",
    label: "로그 조회",
    description: "발송 이력과 자동 규칙을 확인합니다.",
  },
  {
    value: "send",
    label: "알림 전송",
    description: "대상과 메시지를 정리해 발송합니다.",
  },
] as const satisfies ReadonlyArray<{
  value: AdminPushTab;
  label: string;
  description: string;
}>;

export default function AdminPushManager({
  pushConfigured,
  mattermostConfigured,
  members,
  partners,
  recentLogs,
  automaticSummaries,
}: AdminPushManagerProps) {
  const controller = useAdminPushManager({
    pushConfigured,
    members,
    partners,
    recentLogs,
  });
  const [activeTab, setActiveTab] = useState<AdminPushTab>("logs");

  return (
    <div className="grid min-w-0 gap-8 overflow-x-hidden">
      <Tabs value={activeTab} onChange={setActiveTab} options={adminPushTabOptions} />

      {activeTab === "logs" ? (
        <PushLogsSection
          automaticSummaries={automaticSummaries}
          filteredLogs={controller.filteredLogs}
          filters={controller.filters}
          deletingLogId={controller.deletingLogId}
          onUpdateFilter={controller.updateFilter}
          onLoadLog={(log) => {
            setActiveTab("send");
            controller.loadLog(log);
          }}
          onDeleteLog={controller.deleteLog}
        />
      ) : (
        <PushComposerSection
          pushConfigured={pushConfigured}
          mattermostConfigured={mattermostConfigured}
          errorMessage={controller.errorMessage}
          pending={controller.pending}
          previewPending={controller.previewPending}
          reviewState={controller.reviewState}
          canSearchAudience={controller.canSearchAudience}
          memberPickerOpen={controller.memberPickerOpen}
          recipientModalOpen={controller.recipientModalOpen}
          sendConfirmOpen={controller.sendConfirmOpen}
          audienceYearOptions={controller.audienceYearOptions}
          campusOptions={controller.campusOptions}
          composer={controller.composer}
          partners={partners}
          members={members}
          getMemberLabel={getMemberLabel}
          onSubmit={controller.handleSubmit}
          onConfirmSubmit={controller.confirmSubmit}
          onReview={controller.reviewComposer}
          onOpenMemberPicker={controller.openMemberPicker}
          onCloseMemberPicker={controller.closeMemberPicker}
          onToggleMember={controller.selectMember}
          onSelectAllFilteredMembers={controller.selectAllFilteredMembers}
          onOpenRecipientModal={controller.openRecipientModal}
          onCloseRecipientModal={controller.closeRecipientModal}
          onCloseSendConfirm={controller.closeSendConfirm}
          onUpdateComposer={controller.updateComposer}
          onUpdateChannel={controller.updateChannel}
          onUpdateNotificationType={controller.updateNotificationType}
          onPartnerChange={controller.handlePartnerChange}
          onUrlChange={controller.handleUrlChange}
          onAudienceScopeChange={controller.handleAudienceScopeChange}
        />
      )}
    </div>
  );
}
