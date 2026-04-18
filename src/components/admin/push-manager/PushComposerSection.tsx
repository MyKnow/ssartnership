"use client";

import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import FilterBar from "@/components/ui/FilterBar";
import FormMessage from "@/components/ui/FormMessage";
import InlineMessage from "@/components/ui/InlineMessage";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import SectionHeading from "@/components/ui/SectionHeading";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { getNotificationChannelLabel } from "@/lib/notifications/shared";
import {
  formatSsafyMemberLifecycleLabel,
  formatSsafyYearLabel,
} from "@/lib/ssafy-year";
import type { AdminNotificationType, AdminNotificationPreview } from "@/lib/admin-notification-ops";
import type { PushAudienceScope } from "@/lib/push";
import type { AdminPushManagerProps } from "./types";
import { typeLabels } from "./constants";

type Props = {
  pushConfigured: boolean;
  mattermostConfigured: boolean;
  errorMessage: string | null;
  pending: boolean;
  previewPending: boolean;
  reviewState: { preview: AdminNotificationPreview } | null;
  audienceYearOptions: number[];
  campusOptions: string[];
  canSearchAudience: boolean;
  memberPickerOpen: boolean;
  recipientModalOpen: boolean;
  sendConfirmOpen: boolean;
  composer: {
    notificationType: AdminNotificationType;
    channels: Record<"in_app" | "push" | "mm", boolean>;
    title: string;
    body: string;
    url: string;
    selectedPartnerId: string;
    audienceScope: PushAudienceScope;
    selectedYear: string;
    selectedCampus: string;
    selectedMemberId: string;
    confirmationText: string;
  };
  partners: AdminPushManagerProps["partners"];
  members: AdminPushManagerProps["members"];
  getMemberLabel: (member: AdminPushManagerProps["members"][number]) => string;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onConfirmSubmit: () => Promise<void>;
  onReview: () => Promise<void>;
  onOpenMemberPicker: () => void;
  onCloseMemberPicker: () => void;
  onSelectMember: (memberId: string) => void;
  onOpenRecipientModal: () => void;
  onCloseRecipientModal: () => void;
  onCloseSendConfirm: () => void;
  onUpdateComposer: (
    key:
      | "title"
      | "body"
      | "url"
      | "selectedYear"
      | "selectedCampus"
      | "selectedMemberId"
      | "confirmationText",
    value: string,
  ) => void;
  onUpdateChannel: (channel: "in_app" | "push" | "mm", next: boolean) => void;
  onUpdateNotificationType: (type: AdminNotificationType) => void;
  onPartnerChange: (partnerId: string) => void;
  onUrlChange: (nextUrl: string) => void;
  onAudienceScopeChange: (scope: PushAudienceScope) => void;
};

function ChannelToggle({
  label,
  checked,
  disabled,
  onChange,
  description,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  description: string;
}) {
  return (
    <label className="grid gap-2 rounded-2xl border border-border bg-surface px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          className="h-4 w-4 accent-primary"
        />
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
    </label>
  );
}

function formatRecipientMeta(year: number, campus: string | null) {
  const yearLabel = year === 0 ? "운영진" : formatSsafyMemberLifecycleLabel(year);
  return `${yearLabel} · ${campus ?? "캠퍼스 미지정"}`;
}

const ctaButtonClassName = "w-full justify-center lg:w-auto";

function AudienceResultCard({
  preview,
  onOpen,
}: {
  preview: AdminNotificationPreview;
  onOpen: () => void;
}) {
  const totalDeliveries = preview.channels.reduce((sum, channel) => sum + channel.eligibleCount, 0);
  const excludedMembers = Math.max(preview.totalAudienceCount - preview.eligibleMemberCount, 0);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="grid w-full gap-4 rounded-2xl border border-primary/15 bg-primary-soft/55 px-4 py-4 text-left shadow-[var(--shadow-flat)] transition-colors hover:bg-primary-soft/70"
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
            className="inline-flex h-8 items-center rounded-full border border-border bg-surface px-3 text-xs font-medium text-foreground"
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
        <p className="text-sm text-muted-foreground">카드를 누르면 실제 대상자를 확인할 수 있습니다.</p>
        <span className="text-sm font-medium text-foreground">대상자 보기</span>
      </div>

      {preview.validationMessage ? <FormMessage variant="error">{preview.validationMessage}</FormMessage> : null}
    </button>
  );
}

function RecipientListModal({
  open,
  preview,
  onClose,
}: {
  open: boolean;
  preview: AdminNotificationPreview;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");

  const filteredMembers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return preview.eligibleMembers;
    }

    return preview.eligibleMembers.filter((member) =>
      [member.name, member.mmUsername, member.campus ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [preview.eligibleMembers, query]);

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
          <div className="grid gap-1 rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-muted-foreground">
            <p>선택 채널 {preview.selectedChannels.map(getNotificationChannelLabel).join(" · ")}</p>
            <p>현재 표시 {filteredMembers.length}명</p>
          </div>
        </div>

        <div className="max-h-[58vh] overflow-y-auto rounded-2xl border border-border bg-surface">
          {filteredMembers.length > 0 ? (
            <div className="divide-y divide-border/70">
              {filteredMembers.map((member) => (
                <div
                  key={member.id}
                  className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <div className="grid gap-1">
                    <p className="text-sm font-semibold text-foreground">
                      {member.name}
                      <span className="ml-2 font-normal text-muted-foreground">
                        @{member.mmUsername}
                      </span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatRecipientMeta(member.year, member.campus)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {member.channels.map((channel) => (
                      <span
                        key={`${member.id}-${channel}`}
                        className="inline-flex h-8 items-center rounded-full border border-border bg-background px-3 text-xs font-medium text-foreground"
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

        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            닫기
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function MemberPickerModal({
  open,
  members,
  selectedMemberId,
  getMemberLabel,
  onSelectMember,
  onClose,
}: {
  open: boolean;
  members: AdminPushManagerProps["members"];
  selectedMemberId: string;
  getMemberLabel: (member: AdminPushManagerProps["members"][number]) => string;
  onSelectMember: (memberId: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");

  const filteredMembers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return members;
    }

    return members.filter((member) =>
      getMemberLabel(member).toLowerCase().includes(normalized),
    );
  }, [getMemberLabel, members, query]);

  const selectedMember = members.find((member) => member.id === selectedMemberId) ?? null;

  return (
    <Modal
      open={open}
      title="개인 대상 선택"
      description="이름, Mattermost 아이디, 기수, 캠퍼스로 검색해 한 명을 선택합니다."
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
              placeholder="이름, Mattermost 아이디, 기수, 캠퍼스"
            />
          </label>
          <div className="grid gap-1 rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-muted-foreground">
            <p>검색 결과 {filteredMembers.length}명</p>
            <p>현재 선택 {selectedMember ? getMemberLabel(selectedMember) : "없음"}</p>
          </div>
        </div>

        <div className="max-h-[58vh] overflow-y-auto rounded-2xl border border-border bg-surface">
          {filteredMembers.length > 0 ? (
            <div className="divide-y divide-border/70">
              {filteredMembers.map((member) => {
                const isSelected = member.id === selectedMemberId;
                return (
                  <button
                    key={member.id}
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left hover:bg-surface-muted"
                    onClick={() => onSelectMember(member.id)}
                  >
                    <div className="grid gap-1">
                      <p className="text-sm font-semibold text-foreground">
                        {member.display_name?.trim() || member.mm_username}
                        <span className="ml-2 font-normal text-muted-foreground">
                          @{member.mm_username}
                        </span>
                      </p>
                      <p className="text-sm text-muted-foreground">{getMemberLabel(member)}</p>
                    </div>
                    <span className="text-sm font-medium text-foreground">
                      {isSelected ? "선택됨" : "선택"}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              검색 조건에 맞는 대상자가 없습니다.
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          {selectedMember ? (
            <Button variant="secondary" onClick={() => onSelectMember("")}>
              선택 해제
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onClose}>
            닫기
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function SendConfirmModal({
  open,
  pending,
  preview,
  title,
  body,
  confirmationText,
  onChangeConfirmationText,
  onClose,
  onConfirm,
}: {
  open: boolean;
  pending: boolean;
  preview: AdminNotificationPreview;
  title: string;
  body: string;
  confirmationText: string;
  onChangeConfirmationText: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const isConfirmationPhraseValid =
    !preview.requiresConfirmation ||
    confirmationText.trim() === preview.confirmationPhrase;

  return (
    <Modal
      open={open}
      title={`${preview.eligibleMemberCount}명에게 발송`}
      description={`정말 ${preview.eligibleMemberCount}명에게 ${typeLabels[preview.notificationType]}를 발송할까요?`}
      onClose={onClose}
      panelClassName="max-w-2xl"
      bodyClassName="block"
    >
      <div className="w-full space-y-4">
        <div className="grid gap-3 rounded-2xl border border-border bg-surface px-4 py-4 text-sm text-muted-foreground">
          <p>대상 범위 {preview.audienceLabel}</p>
          <p>선택 채널 {preview.selectedChannels.map(getNotificationChannelLabel).join(" · ")}</p>
          <p>예상 수신자 {preview.eligibleMemberCount}명</p>
          <p>예상 전송 {preview.channels.reduce((sum, channel) => sum + channel.eligibleCount, 0)}건</p>
        </div>

        <div className="grid gap-2 rounded-2xl border border-border bg-surface px-4 py-4">
          <div className="grid gap-1">
            <p className="text-sm font-semibold text-foreground">제목</p>
            <p className="text-sm text-muted-foreground">{title}</p>
          </div>
          <div className="grid gap-1">
            <p className="text-sm font-semibold text-foreground">내용</p>
            <p className="line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{body}</p>
          </div>
        </div>

        {preview.requiresConfirmation ? (
          <label className="grid gap-2 text-sm font-medium text-foreground">
            확인 문구 입력
            <Input
              value={confirmationText}
              onChange={(event) => onChangeConfirmationText(event.target.value)}
              placeholder={preview.confirmationPhrase}
            />
          </label>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            취소
          </Button>
          <Button
            size="lg"
            className={ctaButtonClassName}
            onClick={onConfirm}
            loading={pending}
            loadingText="발송 중"
            disabled={!isConfirmationPhraseValid}
          >
            {preview.eligibleMemberCount}명 발송하기
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function PushComposerSection({
  audienceYearOptions,
  campusOptions,
  canSearchAudience,
  composer,
  errorMessage,
  getMemberLabel,
  mattermostConfigured,
  members,
  onAudienceScopeChange,
  onCloseMemberPicker,
  onCloseRecipientModal,
  onCloseSendConfirm,
  onConfirmSubmit,
  onOpenMemberPicker,
  onOpenRecipientModal,
  onPartnerChange,
  onReview,
  onSubmit,
  onUpdateChannel,
  onUpdateComposer,
  onUpdateNotificationType,
  onSelectMember,
  onUrlChange,
  partners,
  pending,
  previewPending,
  pushConfigured,
  memberPickerOpen,
  recipientModalOpen,
  reviewState,
  sendConfirmOpen,
}: Props) {
  const unavailableChannels = [
    !pushConfigured ? "푸시" : null,
    !mattermostConfigured ? "Mattermost" : null,
  ].filter((value): value is string => Boolean(value));
  const selectedMember = members.find((member) => member.id === composer.selectedMemberId) ?? null;

  return (
    <section className="grid min-w-0 gap-4 overflow-hidden rounded-3xl border border-border bg-surface-muted/50 p-4 sm:p-5">
      <SectionHeading
        title="통합 알림 운영"
        description="대상 설정, 메시지 작성, 최종 확인 순서로만 진행합니다."
      />

      {errorMessage ? <FormMessage variant="error">{errorMessage}</FormMessage> : null}

      {unavailableChannels.length > 0 ? (
        <InlineMessage
          tone="warning"
          title="일부 채널을 현재 사용할 수 없습니다."
          description={`${unavailableChannels.join(", ")} 채널은 설정 전까지 선택할 수 없습니다.`}
        />
      ) : null}

      <form className="grid gap-4" onSubmit={onSubmit}>
        <FilterBar title="채널" description="발송할 채널을 먼저 고릅니다.">
          <div className="grid min-w-full gap-3 md:grid-cols-3">
            <ChannelToggle
              label="인앱"
              checked={composer.channels.in_app}
              onChange={(next) => onUpdateChannel("in_app", next)}
              description="알림 수신함에 저장됩니다."
            />
            <ChannelToggle
              label="푸시"
              checked={composer.channels.push}
              disabled={!pushConfigured}
              onChange={(next) => onUpdateChannel("push", next)}
              description="브라우저 푸시 구독이 있는 회원에게만 발송됩니다."
            />
            <ChannelToggle
              label="Mattermost"
              checked={composer.channels.mm}
              disabled={!mattermostConfigured}
              onChange={(next) => onUpdateChannel("mm", next)}
              description="MM 수신 설정을 켠 회원에게 DM으로 전달됩니다."
            />
          </div>
        </FilterBar>

        <FilterBar title="대상 설정" description="유형과 범위를 고른 뒤 필요한 대상만 선택합니다.">
          <div className="grid w-full gap-3">
            <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:flex-nowrap lg:items-end">
              <label className="grid min-w-0 gap-2 text-sm font-medium text-foreground lg:w-[11rem] lg:flex-none">
                알림 유형
                <Select
                  value={composer.notificationType}
                  onChange={(event) =>
                    onUpdateNotificationType(event.target.value as AdminNotificationType)
                  }
                >
                  <option value="announcement">운영 공지</option>
                  <option value="marketing">마케팅/이벤트</option>
                </Select>
              </label>

              <label className="grid min-w-0 gap-2 text-sm font-medium text-foreground lg:w-[11rem] lg:flex-none">
                대상 범위
                <Select
                  value={composer.audienceScope}
                  onChange={(event) =>
                    onAudienceScopeChange(event.target.value as PushAudienceScope)
                  }
                >
                  <option value="all">전체</option>
                  <option value="year">기수</option>
                  <option value="campus">캠퍼스</option>
                  <option value="member">개인</option>
                </Select>
              </label>

              {composer.audienceScope === "year" ? (
                <label className="grid min-w-0 gap-2 text-sm font-medium text-foreground lg:w-[11rem] lg:flex-none">
                  기수
                  <Select
                    value={composer.selectedYear}
                    onChange={(event) => onUpdateComposer("selectedYear", event.target.value)}
                  >
                    <option value="">기수 선택</option>
                    {audienceYearOptions.map((year) => (
                      <option key={year} value={String(year)}>
                        {formatSsafyYearLabel(year)}
                      </option>
                    ))}
                  </Select>
                </label>
              ) : null}

              {composer.audienceScope === "campus" ? (
                <label className="grid min-w-0 gap-2 text-sm font-medium text-foreground lg:w-[11rem] lg:flex-none">
                  캠퍼스
                  <Select
                    value={composer.selectedCampus}
                    onChange={(event) => onUpdateComposer("selectedCampus", event.target.value)}
                  >
                    <option value="">캠퍼스 선택</option>
                    {campusOptions.map((campus) => (
                      <option key={campus} value={campus}>
                        {campus}
                      </option>
                    ))}
                  </Select>
                </label>
              ) : null}

              {composer.audienceScope === "member" ? (
                <div className="grid min-w-0 gap-2 lg:w-[14rem] lg:flex-none">
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full justify-start text-left"
                    onClick={onOpenMemberPicker}
                  >
                    {selectedMember ? getMemberLabel(selectedMember) : "개인 선택"}
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="flex w-full justify-end">
              <Button
                type="button"
                size="lg"
                className={ctaButtonClassName}
                loading={previewPending}
                loadingText="검색 중"
                disabled={!canSearchAudience}
                onClick={() => {
                  void onReview();
                }}
              >
                대상자 검색
              </Button>
            </div>
          </div>
        </FilterBar>

        {reviewState ? (
          <AudienceResultCard
            preview={reviewState.preview}
            onOpen={onOpenRecipientModal}
          />
        ) : null}

        <FilterBar
          title="메시지"
          description="대상자가 정해진 뒤 제목, 내용, 이동 경로만 입력합니다."
          tone="default"
        >
          <label className="grid min-w-[12rem] flex-1 gap-2 text-sm font-medium text-foreground">
            제목
            <Input
              value={composer.title}
              onChange={(event) => onUpdateComposer("title", event.target.value)}
              placeholder="알림 제목"
              maxLength={60}
              required
            />
          </label>

          <label className="grid min-w-[12rem] flex-1 gap-2 text-sm font-medium text-foreground">
            가게 상세 페이지 선택
            <Select
              value={composer.selectedPartnerId}
              onChange={(event) => onPartnerChange(event.target.value)}
            >
              <option value="">직접 URL 입력</option>
              {partners.map((partner) => (
                <option key={partner.id} value={partner.id}>
                  {partner.name}
                </option>
              ))}
            </Select>
          </label>

          <label className="grid min-w-full gap-2 text-sm font-medium text-foreground">
            내용
            <Textarea
              value={composer.body}
              onChange={(event) => onUpdateComposer("body", event.target.value)}
              placeholder="알림 내용"
              rows={4}
              maxLength={160}
              required
            />
          </label>

          <label className="grid min-w-full gap-2 text-sm font-medium text-foreground">
            이동 URL
            <Input
              value={composer.url}
              onChange={(event) => onUrlChange(event.target.value)}
              placeholder="예: /partners/uuid"
            />
          </label>
        </FilterBar>

        <FilterBar
          title="최종 발송"
          description="대상 검색이 끝난 상태에서만 발송합니다."
          tone="default"
        >
          <div className="grid gap-1 text-sm text-muted-foreground">
            {reviewState ? (
              <>
                <p>현재 발송 가능 회원 {reviewState.preview.eligibleMemberCount}명</p>
                <p>발송 버튼을 누르면 최종 확인 모달에서 인원을 다시 확인합니다.</p>
              </>
            ) : (
              <>
                <p>먼저 발송 대상 섹션에서 대상자 검색을 완료해 주세요.</p>
                <p>검색 결과가 없으면 발송 버튼이 비활성화됩니다.</p>
              </>
            )}
          </div>

          <div className="flex w-full justify-end">
            <Button
              type="submit"
              size="lg"
              className={ctaButtonClassName}
              disabled={!reviewState?.preview.canSend}
            >
              발송하기
            </Button>
          </div>
        </FilterBar>
      </form>

      {reviewState ? (
        <>
          <RecipientListModal
            open={recipientModalOpen}
            preview={reviewState.preview}
            onClose={onCloseRecipientModal}
          />
          <SendConfirmModal
            open={sendConfirmOpen}
            pending={pending}
            preview={reviewState.preview}
            title={composer.title}
            body={composer.body}
            confirmationText={composer.confirmationText}
            onChangeConfirmationText={(value) => onUpdateComposer("confirmationText", value)}
            onClose={onCloseSendConfirm}
            onConfirm={() => {
              void onConfirmSubmit();
            }}
          />
        </>
      ) : null}
      <MemberPickerModal
        open={memberPickerOpen}
        members={members}
        selectedMemberId={composer.selectedMemberId}
        getMemberLabel={getMemberLabel}
        onSelectMember={onSelectMember}
        onClose={onCloseMemberPicker}
      />
    </section>
  );
}
