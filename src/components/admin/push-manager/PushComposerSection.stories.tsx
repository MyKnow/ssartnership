import { useState } from "react";
import type { FormEvent } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import type {
  AdminNotificationPreview,
  AdminNotificationType,
} from "@/lib/admin-notification-ops";
import { PushComposerSection } from "./PushComposerSection";
import { getMemberLabel } from "./constants";
import type {
  AdminPushComposerState,
  AdminPushManagerProps,
  MemberOption,
} from "./types";

const partners: AdminPushManagerProps["partners"] = [
  { id: "partner-1", name: "분식랩" },
  { id: "partner-2", name: "커피캠프" },
];

const members: MemberOption[] = [
  {
    id: "member-1",
    display_name: "김싸피",
    mm_username: "ssafy15",
    year: 15,
    campus: "서울",
  },
  {
    id: "member-2",
    display_name: "박운영",
    mm_username: "ops15",
    year: 15,
    campus: "서울",
  },
  {
    id: "member-3",
    display_name: "최동문",
    mm_username: "alumni14",
    year: 14,
    campus: "대전",
  },
];

const baseComposer: AdminPushComposerState = {
  notificationType: "announcement",
  channels: {
    in_app: true,
    push: true,
    mm: true,
  },
  title: "서울 제휴 공지",
  body: "분식랩 혜택이 갱신되었습니다.",
  url: "/partners/partner-1",
  selectedPartnerId: "",
  audienceScope: "member",
  selectedYear: "",
  selectedCampus: "",
  selectedMemberIds: [],
  confirmationText: "",
};

const preview: AdminNotificationPreview = {
  notificationType: "announcement",
  selectedChannels: ["in_app", "push", "mm"],
  audienceScope: "member",
  audienceLabel: "개인 2명",
  totalAudienceCount: 3,
  eligibleMemberCount: 2,
  eligibleMembers: [
    {
      id: "member-1",
      name: "김싸피",
      mmUsername: "ssafy15",
      year: 15,
      campus: "서울",
      channels: ["in_app", "push", "mm"],
    },
    {
      id: "member-2",
      name: "박운영",
      mmUsername: "ops15",
      year: 15,
      campus: "서울",
      channels: ["in_app", "mm"],
    },
  ],
  destinationLabel: "분식랩",
  channels: [
    { channel: "in_app", label: "앱", eligibleCount: 2, excludedCount: 1, reasons: [] },
    {
      channel: "push",
      label: "푸시",
      eligibleCount: 1,
      excludedCount: 2,
      reasons: [{ code: "no_push_subscription", label: "푸시 미구독", count: 1 }],
    },
    { channel: "mm", label: "MM", eligibleCount: 2, excludedCount: 1, reasons: [] },
  ],
  canSend: true,
  highRisk: true,
  requiresConfirmation: true,
  confirmationPhrase: "2명 발송",
  validationMessage: "푸시 미구독 1명이 제외됩니다.",
};

function StatefulPushComposerSection({
  pushConfigured = false,
  mattermostConfigured = true,
  errorMessage = "푸시 설정을 확인해 주세요.",
  initialComposer = baseComposer,
  initialReviewState = null,
  onReview = async () => {},
  onConfirmSubmit = async () => {},
}: {
  pushConfigured?: boolean;
  mattermostConfigured?: boolean;
  errorMessage?: string | null;
  initialComposer?: AdminPushComposerState;
  initialReviewState?: { preview: AdminNotificationPreview } | null;
  onReview?: () => Promise<void>;
  onConfirmSubmit?: () => Promise<void>;
}) {
  const [composer, setComposer] = useState(initialComposer);
  const [reviewState, setReviewState] = useState<{ preview: AdminNotificationPreview } | null>(
    initialReviewState,
  );
  const [memberPickerOpen, setMemberPickerOpen] = useState(false);
  const [recipientModalOpen, setRecipientModalOpen] = useState(false);
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSendConfirmOpen(true);
  };

  return (
    <PushComposerSection
      pushConfigured={pushConfigured}
      mattermostConfigured={mattermostConfigured}
      errorMessage={errorMessage}
      pending={false}
      previewPending={false}
      reviewState={reviewState}
      audienceYearOptions={[15, 14]}
      campusOptions={["서울", "대전"]}
      canSearchAudience
      memberPickerOpen={memberPickerOpen}
      recipientModalOpen={recipientModalOpen}
      sendConfirmOpen={sendConfirmOpen}
      composer={composer}
      partners={partners}
      members={members}
      getMemberLabel={getMemberLabel}
      onSubmit={handleSubmit}
      onConfirmSubmit={async () => {
        await onConfirmSubmit();
        setSendConfirmOpen(false);
      }}
      onReview={async () => {
        await onReview();
        setReviewState({ preview });
      }}
      onOpenMemberPicker={() => setMemberPickerOpen(true)}
      onCloseMemberPicker={() => setMemberPickerOpen(false)}
      onToggleMember={(memberId) => {
        setComposer((current) => ({
          ...current,
          selectedMemberIds: current.selectedMemberIds.includes(memberId)
            ? current.selectedMemberIds.filter((id) => id !== memberId)
            : [...current.selectedMemberIds, memberId],
        }));
      }}
      onSelectAllFilteredMembers={(memberIds) => {
        setComposer((current) => ({ ...current, selectedMemberIds: memberIds }));
      }}
      onOpenRecipientModal={() => setRecipientModalOpen(true)}
      onCloseRecipientModal={() => setRecipientModalOpen(false)}
      onCloseSendConfirm={() => setSendConfirmOpen(false)}
      onUpdateComposer={(key, value) => {
        setComposer((current) => ({
          ...current,
          [key]:
            key === "selectedMemberIds"
              ? value
                ? value.split(",")
                : []
              : value,
        }));
      }}
      onUpdateChannel={(channel, next) => {
        setComposer((current) => ({
          ...current,
          channels: { ...current.channels, [channel]: next },
        }));
      }}
      onUpdateNotificationType={(type: AdminNotificationType) => {
        setComposer((current) => ({ ...current, notificationType: type }));
      }}
      onPartnerChange={(partnerId) => {
        setComposer((current) => ({
          ...current,
          selectedPartnerId: partnerId,
          url: partnerId ? `/partners/${partnerId}` : current.url,
        }));
      }}
      onUrlChange={(nextUrl) => {
        setComposer((current) => ({ ...current, url: nextUrl, selectedPartnerId: "" }));
      }}
      onAudienceScopeChange={(scope) => {
        setComposer((current) => ({
          ...current,
          audienceScope: scope,
          selectedYear: "",
          selectedCampus: "",
          selectedMemberIds: [],
        }));
      }}
    />
  );
}

const meta = {
  title: "Domains/Admin/PushComposerSection",
  component: StatefulPushComposerSection,
  args: {
    pushConfigured: false,
    mattermostConfigured: true,
    errorMessage: "푸시 설정을 확인해 주세요.",
    initialComposer: baseComposer,
    initialReviewState: null,
    onReview: fn(async () => {}),
    onConfirmSubmit: fn(async () => {}),
  },
} satisfies Meta<typeof StatefulPushComposerSection>;

export default meta;

type Story = StoryObj<typeof meta>;

export const InteractiveComposer: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("일부 채널을 현재 사용할 수 없습니다.")).toBeInTheDocument();
    await expect(canvas.getAllByText("먼저 대상자 검색을 완료해 주세요.").length).toBeGreaterThan(0);

    await userEvent.click(canvas.getByRole("button", { name: "개인 선택" }));

    const body = within(document.body);
    await expect(await body.findByText("개인 대상 선택")).toBeInTheDocument();
    await userEvent.type(body.getByPlaceholderText("이름, Mattermost 아이디, 기수, 캠퍼스"), "김");
    await userEvent.click(body.getByRole("button", { name: "기수순" }));
    await userEvent.click(body.getByRole("button", { name: "캠퍼스순" }));
    await userEvent.click(body.getAllByRole("checkbox")[0]);
    await userEvent.click(body.getByRole("button", { name: "전체 선택" }));
    await expect(body.getByText("현재 선택 1명")).toBeInTheDocument();
    await userEvent.click(body.getByRole("button", { name: "완료" }));

    await waitFor(async () => {
      await expect(body.queryByText("개인 대상 선택")).not.toBeInTheDocument();
    });
    await expect(canvas.getByRole("button", { name: /김싸피/ })).toBeInTheDocument();

    await userEvent.click(canvas.getByRole("button", { name: "3. 대상자 검색" }));
    await expect(args.onReview).toHaveBeenCalled();
    await expect(await canvas.findByText("발송 가능 대상")).toBeInTheDocument();
    await expect(canvas.getAllByText(/푸시 미구독 1명/).length).toBeGreaterThan(0);

    await userEvent.click(canvas.getByText("대상자 보기"));
    await expect(await body.findByText("발송 대상자 2명")).toBeInTheDocument();
    await userEvent.type(body.getByPlaceholderText("이름, Mattermost 아이디, 캠퍼스"), "ops");
    await expect(body.getByText("현재 표시 1명")).toBeInTheDocument();
    await userEvent.click(body.getByText("닫기"));

    await waitFor(async () => {
      await expect(body.queryByText("발송 대상자 2명")).not.toBeInTheDocument();
    });

    await userEvent.selectOptions(canvas.getByLabelText("연결 페이지 선택(선택)"), "partner-2");
    await userEvent.clear(canvas.getByLabelText("이동 URL(선택)"));
    await userEvent.type(canvas.getByLabelText("이동 URL(선택)"), "/partners/custom");
    await userEvent.clear(canvas.getByLabelText("제목"));
    await userEvent.type(canvas.getByLabelText("제목"), "최종 발송 안내");
    await userEvent.clear(canvas.getByLabelText("내용"));
    await userEvent.type(canvas.getByLabelText("내용"), "오늘 저녁 제휴 이벤트가 진행됩니다.");

    await userEvent.click(canvas.getByRole("button", { name: "마지막 확인" }));
    await expect(await body.findByText("2명에게 발송")).toBeInTheDocument();

    const confirmInput = body.getByPlaceholderText("2명 발송");
    const sendButton = body.getByRole("button", { name: "메시지 보내기" });
    await expect(sendButton).toBeDisabled();
    await userEvent.type(confirmInput, "2명 발송");
    await expect(sendButton).toBeEnabled();
    await userEvent.click(sendButton);

    await waitFor(async () => {
      await expect(args.onConfirmSubmit).toHaveBeenCalled();
      await expect(body.queryByText("2명에게 발송")).not.toBeInTheDocument();
    });
  },
};

export const YearScopeWithoutWarning: Story = {
  args: {
    pushConfigured: true,
    mattermostConfigured: true,
    errorMessage: null,
    initialComposer: {
      ...baseComposer,
      audienceScope: "year",
      selectedYear: "15",
    },
    initialReviewState: { preview: { ...preview, requiresConfirmation: false, confirmationPhrase: "" } },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText("일부 채널을 현재 사용할 수 없습니다.")).not.toBeInTheDocument();
    await expect(canvas.getByLabelText("기수")).toHaveValue("15");
    await expect(canvas.getByText("현재 발송 가능 회원 2명")).toBeInTheDocument();
  },
};
