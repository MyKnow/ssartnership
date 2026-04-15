"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import type { PushAudienceScope, PushMessageLog } from "@/lib/push";
import { extractPartnerIdFromUrl } from "./constants";
import {
  countTargetableMembers,
  createAudienceYearOptions,
  createCampusOptions,
  createYearOptions,
  filterPushLogs,
} from "./selectors";
import type {
  AdminPushComposerState,
  AdminPushLogFilterState,
  AdminPushManagerProps,
} from "./types";

const initialComposerState: AdminPushComposerState = {
  title: "",
  body: "",
  url: "",
  selectedPartnerId: "",
  audienceScope: "all",
  selectedYear: "",
  selectedCampus: "",
  selectedMemberId: "",
};

const initialLogFilterState: AdminPushLogFilterState = {
  search: "",
  typeFilter: "all",
  sourceFilter: "all",
  statusFilter: "all",
  audienceFilter: "all",
  sort: "newest",
};

export function useAdminPushManager({
  configured,
  members,
  partners,
  recentLogs,
}: Pick<AdminPushManagerProps, "configured" | "members" | "partners" | "recentLogs">) {
  const { notify } = useToast();
  const router = useRouter();
  const [logs, setLogs] = useState(recentLogs);
  const [composer, setComposer] = useState(initialComposerState);
  const [filters, setFilters] = useState(initialLogFilterState);
  const [pending, setPending] = useState(false);
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setLogs(recentLogs);
  }, [recentLogs]);

  const campusOptions = useMemo(() => createCampusOptions(members), [members]);
  const yearOptions = useMemo(() => createYearOptions(members), [members]);
  const audienceYearOptions = useMemo(
    () => createAudienceYearOptions(composer.selectedYear, yearOptions),
    [composer.selectedYear, yearOptions],
  );
  const targetableCount = useMemo(
    () =>
      countTargetableMembers({
        audienceScope: composer.audienceScope,
        members,
        selectedYear: composer.selectedYear,
        selectedCampus: composer.selectedCampus,
        selectedMemberId: composer.selectedMemberId,
      }),
    [
      composer.audienceScope,
      composer.selectedCampus,
      composer.selectedMemberId,
      composer.selectedYear,
      members,
    ],
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
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    if (!configured) {
      setErrorMessage("VAPID 환경 변수와 CRON 시크릿이 준비된 뒤 발송할 수 있습니다.");
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
          title: composer.title,
          body: composer.body,
          url: composer.url,
          audience: {
            scope: composer.audienceScope,
            year: composer.selectedYear || undefined,
            campus: composer.selectedCampus || undefined,
            memberId: composer.selectedMemberId || undefined,
          },
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | {
            message?: string;
            result?: {
              targeted: number;
              delivered: number;
              failed: number;
            };
          }
        | null;
      if (!response.ok) {
        setErrorMessage(data?.message ?? "공지 알림 발송에 실패했습니다.");
        return;
      }

      setComposer(initialComposerState);
      router.refresh();
      notify(
        `공지 알림 발송 완료: ${data?.result?.delivered ?? 0}건 성공, ${data?.result?.failed ?? 0}건 실패`,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "공지 알림 발송에 실패했습니다.",
      );
    } finally {
      setPending(false);
    }
  }

  function loadLog(log: PushMessageLog) {
    const matchedPartnerId = extractPartnerIdFromUrl(log.url);
    setComposer({
      title: log.title,
      body: log.body,
      url: log.url ?? "",
      selectedPartnerId: partners.some((partner) => partner.id === matchedPartnerId)
        ? matchedPartnerId
        : "",
      audienceScope: log.target_scope,
      selectedYear: typeof log.target_year === "number" ? String(log.target_year) : "",
      selectedCampus: log.target_campus ?? "",
      selectedMemberId: log.target_member_id ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
    notify("기존 푸시 메시지를 입력 폼으로 불러왔습니다.");
  }

  async function deleteLog(logId: string) {
    if (deletingLogId) {
      return;
    }
    const ok = window.confirm("이 푸시 메시지 로그를 삭제하시겠습니까?");
    if (!ok) {
      return;
    }

    try {
      setDeletingLogId(logId);
      setErrorMessage(null);
      const response = await fetch(`/api/push/admin/logs/${logId}`, {
        method: "DELETE",
      });
      const data = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      if (!response.ok) {
        setErrorMessage(data?.message ?? "푸시 메시지 로그 삭제에 실패했습니다.");
        return;
      }

      setLogs((current) => current.filter((log) => log.id !== logId));
      notify("푸시 메시지 로그를 삭제했습니다.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "푸시 메시지 로그 삭제에 실패했습니다.",
      );
    } finally {
      setDeletingLogId(null);
    }
  }

  return {
    composer,
    filters,
    campusOptions,
    yearOptions,
    audienceYearOptions,
    targetableCount,
    filteredLogs,
    pending,
    deletingLogId,
    errorMessage,
    updateComposer,
    updateFilter,
    handlePartnerChange,
    handleUrlChange,
    handleAudienceScopeChange,
    handleSubmit,
    loadLog,
    deleteLog,
  };
}
