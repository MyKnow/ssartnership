import { useMemo, useState } from "react";
import FormMessage from "@/components/ui/FormMessage";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { getNotificationChannelLabel } from "@/lib/notifications/shared";
import type {
  AdminNotificationEligibleMember,
  AdminNotificationPreview,
} from "@/lib/admin-notification-ops-types";
import { typeLabels } from "./constants";
import { filterEligibleRecipients, formatRecipientMeta } from "./recipient-members";

export function AudienceResultCard({
  preview,
  onOpen,
}: {
  preview: AdminNotificationPreview;
  onOpen: () => void;
}) {
  const totalDeliveries = preview.channels.reduce((sum, channel) => sum + channel.eligibleCount, 0);
  const excludedMembers = Math.max(preview.totalAudienceCount - preview.eligibleMemberCount, 0);
  const selectedLabel =
    preview.eligibleMemberCount === 1
      ? preview.eligibleMembers[0]
        ? `${preview.eligibleMembers[0].name} (@${preview.eligibleMembers[0].mmUsername})`
        : "대상자 1명"
      : preview.eligibleMembers[0]
        ? `${preview.eligibleMembers[0].name} (@${preview.eligibleMembers[0].mmUsername}) 외 ${
            preview.eligibleMemberCount - 1
          }명`
        : `대상자 ${preview.eligibleMemberCount}명`;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="grid w-full gap-4 rounded-2xl border border-primary/15 bg-primary-soft/55 px-4 py-4 text-left shadow-flat transition-colors hover:bg-primary-soft/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <p className="text-sm font-semibold text-foreground">발송 가능 대상</p>
          <p className="text-sm text-muted-foreground">
            {typeLabels[preview.notificationType]} · {preview.audienceLabel}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold text-foreground">{preview.eligibleMemberCount}명</p>
          <p className="text-xs text-muted-foreground">예상 전송 {totalDeliveries}건</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {preview.channels.map((channel) => (
          <span
            key={channel.channel}
            className="inline-flex h-8 items-center rounded-full border border-border bg-surface-control px-3 text-xs font-medium text-foreground"
          >
            {channel.label} {channel.eligibleCount}
          </span>
        ))}
      </div>

      <div className="grid gap-1 text-sm text-muted-foreground">
        <p>
          선택 채널 {preview.selectedChannels.map(getNotificationChannelLabel).join(" · ")}
        </p>
        <p>
          전체 {preview.totalAudienceCount}명 중 발송 {preview.eligibleMemberCount}명
          {excludedMembers > 0 ? ` · 제외 ${excludedMembers}명` : ""}
        </p>
        {preview.channels.some((channel) => channel.reasons.length > 0) ? (
          <p>
            제외 사유{" "}
            {preview.channels
              .flatMap((channel) => channel.reasons)
              .slice(0, 3)
              .map((reason) => `${reason.label} ${reason.count}명`)
              .join(", ")}
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm text-muted-foreground" title={selectedLabel}>
          {selectedLabel}
        </p>
        <span className="shrink-0 text-sm font-medium text-foreground">대상자 보기</span>
      </div>

      {preview.validationMessage ? <FormMessage variant="error">{preview.validationMessage}</FormMessage> : null}
    </button>
  );
}

export function RecipientListModal({
  open,
  preview,
  onClose,
}: {
  open: boolean;
  preview: AdminNotificationPreview;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");

  const filteredMembers = useMemo(
    () => filterEligibleRecipients(preview.eligibleMembers, query),
    [preview.eligibleMembers, query],
  );

  const showMemberLabel = (member: AdminNotificationEligibleMember) =>
    `${member.name} (@${member.mmUsername})`;

  return (
    <Modal
      open={open}
      title={`발송 대상자 ${preview.eligibleMemberCount}명`}
      description={`${typeLabels[preview.notificationType]} · ${preview.audienceLabel}`}
      onClose={onClose}
      panelClassName="max-w-4xl"
      bodyClassName="block"
    >
      <div className="w-full space-y-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <label className="grid gap-2 text-sm font-medium text-foreground">
            대상자 검색
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="이름, Mattermost 아이디, 캠퍼스"
            />
          </label>
          <div className="grid gap-1 rounded-2xl border border-border bg-surface-inset px-4 py-3 text-sm text-muted-foreground">
            <p>선택 채널 {preview.selectedChannels.map(getNotificationChannelLabel).join(" · ")}</p>
            <p>현재 표시 {filteredMembers.length}명</p>
          </div>
        </div>

        <div className="max-h-[58vh] overflow-y-auto rounded-2xl border border-border bg-surface-inset">
          {filteredMembers.length > 0 ? (
            <div className="divide-y divide-border/70">
              {filteredMembers.map((member) => (
                <div key={member.id} className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="min-w-0 grid gap-1">
                    <p className="truncate text-sm font-semibold text-foreground" title={showMemberLabel(member)}>
                      {member.name}
                      <span className="ml-2 font-normal text-muted-foreground">
                        @{member.mmUsername}
                      </span>
                    </p>
                    <p className="truncate text-sm text-muted-foreground" title={formatRecipientMeta(member.year, member.campus)}>
                      {formatRecipientMeta(member.year, member.campus)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {member.channels.map((channel) => (
                      <span
                        key={`${member.id}-${channel}`}
                        className="inline-flex h-8 items-center rounded-full border border-border bg-surface-control px-3 text-xs font-medium text-foreground"
                      >
                        {getNotificationChannelLabel(channel)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              검색 조건에 맞는 대상자가 없습니다.
            </div>
          )}
        </div>

      </div>
    </Modal>
  );
}
