"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AdminNotificationCenter from "@/components/admin/notification-center/AdminNotificationCenter";
import AdminOperationFlow from "@/components/admin/AdminOperationFlow";
import AdminTabs from "@/components/admin/AdminTabs";
import { buildAdminPushTabHref } from "@/lib/admin-operation-paths";
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

export type AdminPushTab = "center" | "logs" | "send";

const adminPushTabOptions = [
  {
    value: "center",
    label: "알림센터",
    description: "발송 현황과 실패 로그를 확인합니다.",
  },
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
  availableYearOptions,
  availableCampusOptions,
  initialTab = "center",
}: AdminPushManagerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [recipientOptions, setRecipientOptions] = useState(members);

  const onRecipientOptionsLoaded = useCallback((next: AdminPushManagerProps["members"]) => {
    setRecipientOptions((current) => mergeRecipientOptions(current, next));
  }, []);

  const controller = useAdminPushManager({
    pushConfigured,
    members: recipientOptions,
    partners,
    recentLogs,
    availableYearOptions,
    availableCampusOptions,
  });
  const [selectedTab, setSelectedTab] = useState<AdminPushTab>(initialTab);
  const requestedTab = searchParams.get("tab");
  const activeTab: AdminPushTab =
    requestedTab === "center" || requestedTab === "logs" || requestedTab === "send"
      ? requestedTab
      : selectedTab;

  function changeTab(nextTab: AdminPushTab) {
    setSelectedTab(nextTab);
    if (pathname === "/admin/push") {
      router.replace(buildAdminPushTabHref(searchParams, nextTab), { scroll: false });
    }
  }

  const composeStepState =
    activeTab === "send" && !controller.reviewState
      ? "current"
      : activeTab === "center"
        ? "upcoming"
        : "complete";
  const reviewStepState =
    activeTab === "send" && controller.reviewState ? "current" : "upcoming";

  return (
    <div className="grid min-w-0 gap-8 overflow-x-hidden">
      <AdminOperationFlow
        steps={[
          {
            label: "수신함",
            description: "운영 알림과 다음 작업을 확인합니다.",
            href: buildAdminPushTabHref(searchParams, "center"),
            state: activeTab === "center" ? "current" : "complete",
          },
          {
            label: "대상·작성",
            description: "수신 범위와 문구를 정리합니다.",
            href: buildAdminPushTabHref(searchParams, "send"),
            state: composeStepState,
          },
          {
            label: "검토",
            description: "채널별 발송 가능 대상을 확인합니다.",
            href: buildAdminPushTabHref(searchParams, "send"),
            state:
              activeTab === "logs"
                ? "complete"
                : reviewStepState,
          },
          {
            label: "결과",
            description: "성공·실패 로그를 확인합니다.",
            href: buildAdminPushTabHref(searchParams, "logs"),
            state: activeTab === "logs" ? "current" : "upcoming",
          },
        ]}
      />

      <AdminTabs value={activeTab} onChange={changeTab} options={adminPushTabOptions} />

      {activeTab === "center" ? (
        <AdminNotificationCenter
          automaticSummaries={automaticSummaries}
          recentLogs={recentLogs}
          onMoveToSend={() => changeTab("send")}
        />
      ) : activeTab === "logs" ? (
        <PushLogsSection
          automaticSummaries={automaticSummaries}
          filteredLogs={controller.filteredLogs}
          filters={controller.filters}
          deletingLogId={controller.deletingLogId}
          onUpdateFilter={controller.updateFilter}
          onLoadLog={(log) => {
            changeTab("send");
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
          members={recipientOptions}
          getMemberLabel={getMemberLabel}
          onSubmit={controller.handleSubmit}
          onConfirmSubmit={controller.confirmSubmit}
          onReview={controller.reviewComposer}
          onOpenMemberPicker={controller.openMemberPicker}
          onCloseMemberPicker={controller.closeMemberPicker}
          onToggleMember={controller.selectMember}
          onSelectAllFilteredMembers={controller.selectAllFilteredMembers}
          onRecipientOptionsLoaded={onRecipientOptionsLoaded}
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

function mergeRecipientOptions(
  current: AdminPushManagerProps["members"],
  next: AdminPushManagerProps["members"],
) {
  const byId = new Map(current.map((member) => [member.id, member]));
  for (const member of next) {
    byId.set(member.id, member);
  }
  return [...byId.values()];
}
