"use client";

import Checkbox from "@/components/ui/Checkbox";
import Button from "@/components/ui/Button";
import FilterBar from "@/components/ui/FilterBar";
import FormMessage from "@/components/ui/FormMessage";
import InlineMessage from "@/components/ui/InlineMessage";
import Input from "@/components/ui/Input";
import SectionHeading from "@/components/ui/SectionHeading";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { formatSsafyYearLabel } from "@/lib/ssafy-year";
import type {
  AdminNotificationType,
  AdminNotificationPreview,
} from "@/lib/admin-notification-ops-types";
import type { PushAudienceScope } from "@/lib/push";
import type { AdminPushManagerProps } from "./types";
import { MemberPickerModal } from "./MemberPickerModal";
import { AudienceResultCard, RecipientListModal } from "./PushAudienceReview";
import { SendConfirmModal } from "./SendConfirmModal";

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
    selectedMemberIds: string[];
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
  onToggleMember: (memberId: string) => void;
  onSelectAllFilteredMembers: (memberIds: string[]) => void;
  onRecipientOptionsLoaded?: (members: AdminPushManagerProps["members"]) => void;
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
      | "selectedMemberIds"
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
    <label className="grid gap-2 rounded-2xl border border-border bg-surface-inset px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <Checkbox
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

const ctaButtonClassName = "w-full justify-center lg:w-auto";

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
  onToggleMember,
  onSelectAllFilteredMembers,
  onRecipientOptionsLoaded,
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
  const selectedMembers = members.filter((member) =>
    composer.selectedMemberIds.includes(member.id),
  );
  const canComposeMessage = Boolean(reviewState);
  const selectedMemberLabel =
    selectedMembers.length === 0
      ? "개인 선택"
      : selectedMembers.length === 1
        ? getMemberLabel(selectedMembers[0])
        : `${getMemberLabel(selectedMembers[0])} 외 ${selectedMembers.length - 1}명`;

  return (
    <section className="grid min-w-0 gap-4 rounded-3xl border border-border bg-surface p-4 shadow-flat sm:p-5">
      <SectionHeading
        title="통합 발송 관리"
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
        <FilterBar title="1. 채널 선택" description="발송할 채널을 먼저 고릅니다.">
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

        <FilterBar title="2. 대상 설정" description="유형과 범위를 고른 뒤 필요한 대상만 선택합니다.">
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
                    className="h-auto w-full min-w-0 items-start justify-start whitespace-normal px-4 py-3 text-left"
                    onClick={onOpenMemberPicker}
                  >
                    <span className="block min-w-0 whitespace-normal break-words text-left leading-tight">
                      {selectedMemberLabel}
                    </span>
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
                3. 대상자 검색
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
          title="4. 메시지 작성"
          description="대상자 검색 후 제목, 내용, 이동 경로를 입력합니다."
          tone="default"
        >
          {!canComposeMessage ? (
            <InlineMessage
              tone="info"
              title="먼저 대상자 검색을 완료해 주세요."
              description="검색 결과가 있어야 메시지를 작성하고 최종 확인으로 넘어갈 수 있습니다."
            />
          ) : null}
          <label className="grid min-w-[12rem] flex-1 gap-2 text-sm font-medium text-foreground">
            제목
            <Input
              value={composer.title}
              onChange={(event) => onUpdateComposer("title", event.target.value)}
              placeholder="알림 제목"
              maxLength={60}
              required
              disabled={!canComposeMessage}
            />
          </label>

          <label className="grid min-w-[12rem] flex-1 gap-2 text-sm font-medium text-foreground">
            연결 페이지 선택(선택)
            <Select
              value={composer.selectedPartnerId}
              onChange={(event) => onPartnerChange(event.target.value)}
              disabled={!canComposeMessage}
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
              disabled={!canComposeMessage}
            />
          </label>

          <label className="grid min-w-full gap-2 text-sm font-medium text-foreground">
            이동 URL(선택)
            <Input
              value={composer.url}
              onChange={(event) => onUrlChange(event.target.value)}
              placeholder="예: /partners/uuid"
              disabled={!canComposeMessage}
            />
          </label>
        </FilterBar>

        <FilterBar
          title="5. 최종 확인"
          description="대상 검색과 메시지 작성을 마친 뒤 마지막으로 확인합니다."
          tone="default"
        >
          <div className="grid gap-1 text-sm text-muted-foreground">
            {reviewState ? (
              <>
                <p>현재 발송 가능 회원 {reviewState.preview.eligibleMemberCount}명</p>
                <p>버튼을 누르면 최종 확인 모달에서 인원과 내용을 다시 확인합니다.</p>
              </>
            ) : (
              <>
                <p>먼저 대상자 검색을 완료해 주세요.</p>
                <p>검색 결과가 없으면 마지막 확인 버튼이 비활성화됩니다.</p>
              </>
            )}
          </div>

          <div className="flex w-full justify-end">
          <Button
            type="submit"
            size="lg"
            className={ctaButtonClassName}
            disabled={!reviewState || !reviewState.preview.canSend}
          >
            마지막 확인
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
        selectedMemberIds={composer.selectedMemberIds}
        getMemberLabel={getMemberLabel}
        onToggleMember={onToggleMember}
        onSelectAllFiltered={onSelectAllFilteredMembers}
        onRecipientOptionsLoaded={onRecipientOptionsLoaded}
        onClose={onCloseMemberPicker}
      />
    </section>
  );
}
