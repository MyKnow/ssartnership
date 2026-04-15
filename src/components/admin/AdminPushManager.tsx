"use client";

import StatsRow from "@/components/ui/StatsRow";
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

export default function AdminPushManager({
  activeSubscriptions,
  configured,
  enabledMembers,
  members,
  partners,
  recentLogs,
}: AdminPushManagerProps) {
  const controller = useAdminPushManager({
    configured,
    members,
    partners,
    recentLogs,
  });

  return (
    <div className="grid min-w-0 gap-8 overflow-x-hidden">
      <StatsRow
        items={[
          {
            label: "활성 구독",
            value: `${activeSubscriptions}개`,
            hint: "실제 전송 가능한 기기 구독 수",
          },
          {
            label: "공지 가능 회원",
            value: `${enabledMembers}명`,
            hint: "공지 푸시를 받을 수 있는 회원 수",
          },
          {
            label: "최근 메시지 로그",
            value: `${recentLogs.length}건`,
            hint: "최근 발송 및 자동 알림 이력",
          },
        ]}
      />

      <PushComposerSection
        configured={configured}
        errorMessage={controller.errorMessage}
        targetableCount={controller.targetableCount}
        pending={controller.pending}
        audienceYearOptions={controller.audienceYearOptions}
        campusOptions={controller.campusOptions}
        composer={controller.composer}
        partners={partners}
        members={members}
        getMemberLabel={getMemberLabel}
        onSubmit={controller.handleSubmit}
        onUpdateComposer={controller.updateComposer}
        onPartnerChange={controller.handlePartnerChange}
        onUrlChange={controller.handleUrlChange}
        onAudienceScopeChange={controller.handleAudienceScopeChange}
      />

      <PushLogsSection
        filteredLogs={controller.filteredLogs}
        filters={controller.filters}
        deletingLogId={controller.deletingLogId}
        onUpdateFilter={controller.updateFilter}
        onLoadLog={controller.loadLog}
        onDeleteLog={controller.deleteLog}
      />
    </div>
  );
}
