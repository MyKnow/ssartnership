"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import type { PushAudienceScope } from "@/lib/push";
import type {
  AdminNotificationPreview,
  AdminNotificationSendResult,
  AdminNotificationType,
} from "@/lib/admin-notification-ops";
import { extractPartnerIdFromUrl } from "./constants";
import {
  createAudienceYearOptions,
  createCampusOptions,
  createYearOptions,
  filterPushLogs,
} from "./selectors";
import type {
  AdminPushComposerState,
  AdminPushLogFilterState,
  AdminPushManagerProps,
  AdminPushReviewState,
} from "./types";

const initialComposerState: AdminPushComposerState = {
  notificationType: "announcement",
  channels: {
    in_app: true,
    push: true,
    mm: false,
  },
  title: "",
  body: "",
  url: "",
  selectedPartnerId: "",
  audienceScope: "all",
  selectedYear: "",
  selectedCampus: "",
  selectedMemberId: "",
  confirmationText: "",
};

const initialLogFilterState: AdminPushLogFilterState = {
  search: "",
  typeFilter: "all",
  sourceFilter: "all",
  statusFilter: "all",
  audienceFilter: "all",
  sort: "newest",
};

function serializeComposerForReview(composer: AdminPushComposerState) {
  return JSON.stringify({
    notificationType: composer.notificationType,
    channels: composer.channels,
    audienceScope: composer.audienceScope,
    selectedYear: composer.selectedYear,
    selectedCampus: composer.selectedCampus,
    selectedMemberId: composer.selectedMemberId,
  });
}

function isAudienceSelectionComplete(composer: AdminPushComposerState) {
  const hasSelectedChannel = Object.values(composer.channels).some(Boolean);
  if (!hasSelectedChannel) {
    return false;
  }

  switch (composer.audienceScope) {
    case "year":
      return Boolean(composer.selectedYear);
    case "campus":
      return Boolean(composer.selectedCampus);
    case "member":
      return Boolean(composer.selectedMemberId);
    case "all":
    default:
      return true;
  }
}

async function parseAdminResponse<T>(response: Response) {
  return (await response.json().catch(() => null)) as T | null;
}

export function useAdminPushManager({
  pushConfigured,
  members,
  partners,
  recentLogs,
}: Pick<AdminPushManagerProps, "pushConfigured" | "members" | "partners" | "recentLogs">) {
  const { notify } = useToast();
  const router = useRouter();
  const [logs, setLogs] = useState(recentLogs);
  const [composer, setComposer] = useState(initialComposerState);
  const [filters, setFilters] = useState(initialLogFilterState);
  const [reviewState, setReviewState] = useState<AdminPushReviewState | null>(null);
  const [pending, setPending] = useState(false);
  const [previewPending, setPreviewPending] = useState(false);
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [memberPickerOpen, setMemberPickerOpen] = useState(false);
  const [recipientModalOpen, setRecipientModalOpen] = useState(false);
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false);

  useEffect(() => {
    setLogs(recentLogs);
  }, [recentLogs]);

  const composerFingerprint = useMemo(
    () => serializeComposerForReview(composer),
    [composer],
  );

  useEffect(() => {
    setReviewState((current) =>
      current && current.lastSubmittedPayload !== composerFingerprint ? null : current,
    );
    setMemberPickerOpen(false);
    setRecipientModalOpen(false);
    setSendConfirmOpen(false);
  }, [composerFingerprint]);

  const campusOptions = useMemo(() => createCampusOptions(members), [members]);
  const yearOptions = useMemo(() => createYearOptions(members), [members]);
  const audienceYearOptions = useMemo(
    () => createAudienceYearOptions(composer.selectedYear, yearOptions),
    [composer.selectedYear, yearOptions],
  );
  const filteredLogs = useMemo(
    () =>
      filterPushLogs({
        logs,
        search: filters.search,
        typeFilter: filters.typeFilter,
        sourceFilter: filters.sourceFilter,
        statusFilter: filters.statusFilter,
        audienceFilter: filters.audienceFilter,
        sort: filters.sort,
      }),
    [filters, logs],
  );

  function updateComposer<Key extends keyof AdminPushComposerState>(
    key: Key,
    value: AdminPushComposerState[Key],
  ) {
    setComposer((current) => ({ ...current, [key]: value }));
  }

  function updateFilter<Key extends keyof AdminPushLogFilterState>(
    key: Key,
    value: AdminPushLogFilterState[Key],
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function updateChannel(channel: keyof AdminPushComposerState["channels"], next: boolean) {
    setComposer((current) => ({
      ...current,
      channels: {
        ...current.channels,
        [channel]: next,
      },
    }));
  }

  function updateNotificationType(next: AdminNotificationType) {
    setComposer((current) => ({
      ...current,
      notificationType: next,
      channels:
        next === "marketing"
          ? {
              in_app: true,
              push: true,
              mm: false,
            }
          : current.channels,
    }));
  }

  function handlePartnerChange(partnerId: string) {
    setComposer((current) => ({
      ...current,
      selectedPartnerId: partnerId,
      url: partnerId ? `/partners/${partnerId}` : current.url,
    }));
  }

  function handleUrlChange(nextUrl: string) {
    const matchedPartnerId = extractPartnerIdFromUrl(nextUrl);
    setComposer((current) => ({
      ...current,
      url: nextUrl,
      selectedPartnerId: partners.some((partner) => partner.id === matchedPartnerId)
        ? matchedPartnerId
        : "",
    }));
  }

  function handleAudienceScopeChange(scope: PushAudienceScope) {
    setComposer((current) => ({
      ...current,
      audienceScope: scope,
      selectedYear: scope === "year" ? current.selectedYear : "",
      selectedCampus: scope === "campus" ? current.selectedCampus : "",
      selectedMemberId: scope === "member" ? current.selectedMemberId : "",
    }));
    if (scope !== "member") {
      setMemberPickerOpen(false);
    }
  }

  function openMemberPicker() {
    setMemberPickerOpen(true);
  }

  function closeMemberPicker() {
    setMemberPickerOpen(false);
  }

  function selectMember(memberId: string) {
    setComposer((current) => ({
      ...current,
      selectedMemberId: memberId,
    }));
    setMemberPickerOpen(false);
  }

  async function reviewComposer() {
    setPreviewPending(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/push/admin/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          notificationType: composer.notificationType,
          title: composer.title,
          body: composer.body,
          url: composer.url,
          channels: composer.channels,
          audience: {
            scope: composer.audienceScope,
            year: composer.selectedYear || undefined,
            campus: composer.selectedCampus || undefined,
            memberId: composer.selectedMemberId || undefined,
          },
        }),
      });
      const data = await parseAdminResponse<{ message?: string; preview?: AdminNotificationPreview }>(response);
      if (!response.ok || !data?.preview) {
        setErrorMessage(data?.message ?? "발송 검토 정보를 불러오지 못했습니다.");
        return;
      }
      setReviewState({
        preview: data.preview,
        lastSubmittedPayload: composerFingerprint,
        lastSendResult: null,
      });
      setComposer((current) => ({ ...current, confirmationText: "" }));
      notify(`발송 가능 대상 ${data.preview.eligibleMemberCount}명을 찾았습니다.`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "발송 검토 정보를 불러오지 못했습니다.",
      );
    } finally {
      setPreviewPending(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    if (!pushConfigured && composer.channels.push) {
      setErrorMessage("푸시 채널이 아직 설정되지 않았습니다.");
      return;
    }
    if (!reviewState || reviewState.lastSubmittedPayload !== composerFingerprint) {
      setErrorMessage("먼저 발송 대상 섹션에서 대상자 검색을 완료해 주세요.");
      return;
    }
    if (reviewState.preview.eligibleMemberCount === 0) {
      setErrorMessage("현재 조건으로 발송 가능한 대상자가 없습니다.");
      return;
    }

    setSendConfirmOpen(true);
  }

  async function confirmSubmit() {
    if (!reviewState || reviewState.lastSubmittedPayload !== composerFingerprint) {
      setErrorMessage("발송 대상이 변경되었습니다. 다시 대상자 검색을 진행해 주세요.");
      setSendConfirmOpen(false);
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/push/admin/broadcast", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          notificationType: composer.notificationType,
          title: composer.title,
          body: composer.body,
          url: composer.url,
          channels: composer.channels,
          audience: {
            scope: composer.audienceScope,
            year: composer.selectedYear || undefined,
            campus: composer.selectedCampus || undefined,
            memberId: composer.selectedMemberId || undefined,
          },
          confirmationText: composer.confirmationText,
        }),
      });
      const data = await parseAdminResponse<{ message?: string; result?: AdminNotificationSendResult }>(response);
      if (!response.ok || !data?.result) {
        setErrorMessage(data?.message ?? "알림 발송에 실패했습니다.");
        return;
      }

      setComposer(initialComposerState);
      setReviewState(null);
      setRecipientModalOpen(false);
      setSendConfirmOpen(false);
      router.refresh();
      const totalSent =
        data.result.channelResults.in_app.sent +
        data.result.channelResults.push.sent +
        data.result.channelResults.mm.sent;
      const totalFailed =
        data.result.channelResults.in_app.failed +
        data.result.channelResults.push.failed +
        data.result.channelResults.mm.failed;
      notify(`알림 발송 완료: ${totalSent}건 성공, ${totalFailed}건 실패`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "알림 발송에 실패했습니다.",
      );
    } finally {
      setPending(false);
    }
  }

  function openRecipientModal() {
    if (!reviewState) {
      return;
    }
    setRecipientModalOpen(true);
  }

  function closeRecipientModal() {
    setRecipientModalOpen(false);
  }

  function closeSendConfirm() {
    setSendConfirmOpen(false);
  }

  function loadLog(log: AdminPushManagerProps["recentLogs"][number]) {
    const matchedPartnerId = extractPartnerIdFromUrl(log.url);
    setComposer({
      notificationType: log.notificationType,
      channels: {
        in_app: log.selectedChannels.includes("in_app"),
        push: log.selectedChannels.includes("push"),
        mm: log.selectedChannels.includes("mm"),
      },
      title: log.title,
      body: log.body,
      url: log.url ?? "",
      selectedPartnerId: partners.some((partner) => partner.id === matchedPartnerId)
        ? matchedPartnerId
        : "",
      audienceScope: log.targetScope,
      selectedYear: typeof log.targetYear === "number" ? String(log.targetYear) : "",
      selectedCampus: log.targetCampus ?? "",
      selectedMemberId: log.targetMemberId ?? "",
      confirmationText: "",
    });
    setReviewState(null);
    setRecipientModalOpen(false);
    setSendConfirmOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
    notify("기존 알림 구성을 작성 폼으로 불러왔습니다.");
  }

  async function deleteLog(logId: string) {
    if (deletingLogId) {
      return;
    }
    const ok = window.confirm("이 알림 운영 로그를 삭제하시겠습니까?");
    if (!ok) {
      return;
    }

    try {
      setDeletingLogId(logId);
      setErrorMessage(null);
      const response = await fetch(`/api/push/admin/logs/${logId}`, {
        method: "DELETE",
      });
      const data = await parseAdminResponse<{ message?: string }>(response);

      if (!response.ok) {
        setErrorMessage(data?.message ?? "알림 운영 로그 삭제에 실패했습니다.");
        return;
      }

      setLogs((current) => current.filter((log) => log.id !== logId));
      notify("알림 운영 로그를 삭제했습니다.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "알림 운영 로그 삭제에 실패했습니다.",
      );
    } finally {
      setDeletingLogId(null);
    }
  }

  return {
    composer,
    filters,
    reviewState,
    campusOptions,
    yearOptions,
    audienceYearOptions,
    filteredLogs,
    pending,
    previewPending,
    deletingLogId,
    errorMessage,
    recipientModalOpen,
    memberPickerOpen,
    sendConfirmOpen,
    canSearchAudience: isAudienceSelectionComplete(composer),
    updateComposer,
    updateFilter,
    updateChannel,
    updateNotificationType,
    handlePartnerChange,
    handleUrlChange,
    handleAudienceScopeChange,
    openMemberPicker,
    closeMemberPicker,
    selectMember,
    reviewComposer,
    handleSubmit,
    confirmSubmit,
    openRecipientModal,
    closeRecipientModal,
    closeSendConfirm,
    loadLog,
    deleteLog,
  };
}
