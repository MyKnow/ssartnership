"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import SectionHeading from "@/components/ui/SectionHeading";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import type { PushAudienceScope, PushMessageLog } from "@/lib/push";
import { formatOptionalSsafyYearLabel, formatSsafyYearLabel } from "@/lib/ssafy-year";

type PartnerOption = {
  id: string;
  name: string;
};

type MemberOption = {
  id: string;
  display_name: string | null;
  mm_username: string;
  year: number | null;
  campus: string | null;
  class_number: number | null;
};

type Props = {
  configured: boolean;
  activeSubscriptions: number;
  enabledMembers: number;
  partners: PartnerOption[];
  members: MemberOption[];
  recentLogs: PushMessageLog[];
};

type SortOption = "newest" | "oldest" | "delivered" | "failed";

const audienceLabels: Record<PushAudienceScope, string> = {
  all: "전체",
  year: "기수",
  campus: "캠퍼스",
  class: "반",
  member: "개인",
};

const typeLabels: Record<PushMessageLog["type"], string> = {
  announcement: "운영 공지",
  new_partner: "신규 제휴",
  expiring_partner: "종료 임박",
};

const sourceLabels: Record<PushMessageLog["source"], string> = {
  manual: "수동 발송",
  automatic: "자동 발송",
};

const statusLabels: Record<PushMessageLog["status"], string> = {
  pending: "대기",
  sent: "발송 완료",
  partial_failed: "일부 실패",
  failed: "발송 실패",
  no_target: "대상 없음",
};

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-surface-muted px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold text-foreground">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}

function getStatusBadgeClass(status: PushMessageLog["status"]) {
  switch (status) {
    case "sent":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "partial_failed":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    case "failed":
      return "bg-danger/15 text-danger";
    case "no_target":
      return "bg-surface-muted text-muted-foreground";
    case "pending":
    default:
      return "bg-surface-muted text-muted-foreground";
  }
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("ko-KR", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function extractPartnerIdFromUrl(url: string | null | undefined) {
  const trimmed = url?.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const parsed = trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? new URL(trimmed)
      : new URL(trimmed, "https://ssartnership.local");
    const match = parsed.pathname.match(/^\/partners\/([^/]+)$/);
    return match?.[1] ?? "";
  } catch {
    const match = trimmed.match(/^\/partners\/([^/]+)$/);
    return match?.[1] ?? "";
  }
}

function getMemberLabel(member: MemberOption) {
  const name = member.display_name?.trim() || member.mm_username;
  const yearLabel = formatOptionalSsafyYearLabel(member.year);
  const campusLabel = member.campus ?? "캠퍼스 미지정";
  const classLabel = member.class_number ? `${member.class_number}반` : "반 미지정";
  return `${name} (@${member.mm_username}) · ${yearLabel} · ${campusLabel} ${classLabel}`;
}

export default function AdminPushManager({
  configured,
  activeSubscriptions,
  enabledMembers,
  partners,
  members,
  recentLogs,
}: Props) {
  const { notify } = useToast();
  const router = useRouter();
  const [logs, setLogs] = useState(recentLogs);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [selectedPartnerId, setSelectedPartnerId] = useState("");
  const [audienceScope, setAudienceScope] = useState<PushAudienceScope>("all");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedCampus, setSelectedCampus] = useState("");
  const [selectedClassNumber, setSelectedClassNumber] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<PushMessageLog["type"] | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<
    PushMessageLog["source"] | "all"
  >("all");
  const [statusFilter, setStatusFilter] = useState<
    PushMessageLog["status"] | "all"
  >("all");
  const [audienceFilter, setAudienceFilter] = useState<PushAudienceScope | "all">("all");
  const [sort, setSort] = useState<SortOption>("newest");
  const [pending, setPending] = useState(false);
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);

  useEffect(() => {
    setLogs(recentLogs);
  }, [recentLogs]);

  const campusOptions = useMemo(
    () =>
      Array.from(
        new Set(
          members
            .map((member) => member.campus?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((a, b) => a.localeCompare(b, "ko-KR")),
    [members],
  );

  const classOptions = useMemo(() => {
    if (!selectedCampus) {
      return [];
    }
    return Array.from(
      new Set(
        members
          .filter((member) => member.campus === selectedCampus)
          .map((member) => member.class_number)
          .filter((value): value is number => typeof value === "number"),
      ),
    ).sort((a, b) => a - b);
  }, [members, selectedCampus]);

  const yearOptions = useMemo(
    () =>
      Array.from(
        new Set(
          members
            .map((member) => member.year)
            .filter((value): value is number => typeof value === "number"),
        ),
      ).sort((a, b) => b - a),
    [members],
  );

  const audienceYearOptions = useMemo(() => {
    const next = new Set(yearOptions);
    const parsedSelectedYear = Number.parseInt(selectedYear, 10);
    if (Number.isInteger(parsedSelectedYear)) {
      next.add(parsedSelectedYear);
    }
    return Array.from(next).sort((a, b) => b - a);
  }, [selectedYear, yearOptions]);

  const targetableCount = useMemo(() => {
    switch (audienceScope) {
      case "all":
        return members.length;
      case "year":
        return members.filter(
          (member) => String(member.year ?? "") === selectedYear,
        ).length;
      case "campus":
        return members.filter((member) => member.campus === selectedCampus).length;
      case "class":
        return members.filter(
          (member) =>
            member.campus === selectedCampus &&
            String(member.class_number ?? "") === selectedClassNumber,
        ).length;
      case "member":
        return members.some((member) => member.id === selectedMemberId) ? 1 : 0;
      default:
        return 0;
    }
  }, [
    audienceScope,
    members,
    selectedCampus,
    selectedClassNumber,
    selectedMemberId,
    selectedYear,
  ]);

  const filteredLogs = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const next = logs.filter((log) => {
      const matchesSearch =
        !normalizedSearch ||
        [log.title, log.body, log.url ?? "", log.target_label].some((value) =>
          value.toLowerCase().includes(normalizedSearch),
        );
      const matchesType = typeFilter === "all" || log.type === typeFilter;
      const matchesSource = sourceFilter === "all" || log.source === sourceFilter;
      const matchesStatus = statusFilter === "all" || log.status === statusFilter;
      const matchesAudience =
        audienceFilter === "all" || log.target_scope === audienceFilter;

      return (
        matchesSearch &&
        matchesType &&
        matchesSource &&
        matchesStatus &&
        matchesAudience
      );
    });

    next.sort((a, b) => {
      switch (sort) {
        case "oldest":
          return (
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        case "delivered":
          return b.delivered - a.delivered;
        case "failed":
          return b.failed - a.failed;
        case "newest":
        default:
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
      }
    });

    return next;
  }, [
    audienceFilter,
    logs,
    search,
    sourceFilter,
    sort,
    statusFilter,
    typeFilter,
  ]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured) {
      notify("VAPID 환경 변수와 CRON 시크릿이 준비된 뒤 발송할 수 있습니다.");
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
          title,
          body,
          url,
          audience: {
            scope: audienceScope,
            year: selectedYear || undefined,
            campus: selectedCampus || undefined,
            classNumber: selectedClassNumber || undefined,
            memberId: selectedMemberId || undefined,
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
        throw new Error(data?.message ?? "공지 알림 발송에 실패했습니다.");
      }

      setTitle("");
      setBody("");
      setUrl("");
      setSelectedPartnerId("");
      setAudienceScope("all");
      setSelectedYear("");
      setSelectedCampus("");
      setSelectedClassNumber("");
      setSelectedMemberId("");
      router.refresh();
      notify(
        `공지 알림 발송 완료: ${data?.result?.delivered ?? 0}건 성공, ${data?.result?.failed ?? 0}건 실패`,
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : "공지 알림 발송에 실패했습니다.");
    } finally {
      setPending(false);
    }
  }

  function handlePartnerChange(partnerId: string) {
    setSelectedPartnerId(partnerId);
    if (!partnerId) {
      return;
    }
    setUrl(`/partners/${partnerId}`);
  }

  function handleUrlChange(nextUrl: string) {
    setUrl(nextUrl);
    const matchedPartnerId = extractPartnerIdFromUrl(nextUrl);
    setSelectedPartnerId(
      partners.some((partner) => partner.id === matchedPartnerId)
        ? matchedPartnerId
        : "",
    );
  }

  function handleAudienceScopeChange(scope: PushAudienceScope) {
    setAudienceScope(scope);
    if (scope === "all") {
      setSelectedYear("");
      setSelectedCampus("");
      setSelectedClassNumber("");
      setSelectedMemberId("");
      return;
    }
    if (scope === "year") {
      setSelectedCampus("");
      setSelectedClassNumber("");
      setSelectedMemberId("");
      return;
    }
    if (scope === "campus") {
      setSelectedYear("");
      setSelectedClassNumber("");
      setSelectedMemberId("");
      return;
    }
    if (scope === "class") {
      setSelectedYear("");
      setSelectedMemberId("");
      return;
    }
    setSelectedYear("");
    setSelectedCampus("");
    setSelectedClassNumber("");
  }

  function loadLog(log: PushMessageLog) {
    setTitle(log.title);
    setBody(log.body);
    setUrl(log.url ?? "");
    const matchedPartnerId = extractPartnerIdFromUrl(log.url);
    setSelectedPartnerId(
      partners.some((partner) => partner.id === matchedPartnerId)
        ? matchedPartnerId
        : "",
    );
    setAudienceScope(log.target_scope);
    setSelectedYear(
      typeof log.target_year === "number" ? String(log.target_year) : "",
    );
    setSelectedCampus(log.target_campus ?? "");
    setSelectedClassNumber(
      typeof log.target_class_number === "number"
        ? String(log.target_class_number)
        : "",
    );
    setSelectedMemberId(log.target_member_id ?? "");
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
      const response = await fetch(`/api/push/admin/logs/${logId}`, {
        method: "DELETE",
      });
      const data = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      if (!response.ok) {
        throw new Error(data?.message ?? "푸시 메시지 로그 삭제에 실패했습니다.");
      }

      setLogs((current) => current.filter((log) => log.id !== logId));
      notify("푸시 메시지 로그를 삭제했습니다.");
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "푸시 메시지 로그 삭제에 실패했습니다.",
      );
    } finally {
      setDeletingLogId(null);
    }
  }

  return (
    <div className="grid min-w-0 gap-8 overflow-x-hidden">
      <section className="grid min-w-0 gap-3 md:grid-cols-3">
        <MetricCard
          label="활성 구독"
          value={`${activeSubscriptions}개`}
          hint="실제 전송 가능한 기기 구독 수입니다."
        />
        <MetricCard
          label="공지 가능 회원"
          value={`${enabledMembers}명`}
          hint="현재 공지 푸시를 실제로 받을 수 있는 회원 수입니다."
        />
        <MetricCard
          label="최근 메시지 로그"
          value={`${logs.length}건`}
          hint="최근 발송/자동 알림 메시지 이력입니다."
        />
      </section>

      <section className="grid min-w-0 gap-4 overflow-hidden rounded-3xl border border-border bg-surface-muted/50 p-4 sm:p-5">
        <SectionHeading
          title="공지 메시지 작성"
          description="발송 대상을 먼저 정하고, 직접 URL 입력 또는 등록된 제휴 업체 선택으로 이동 경로를 구성합니다."
        />

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid min-w-0 gap-4 rounded-2xl border border-border bg-surface px-4 py-4">
            <SectionHeading
              title="발송 대상"
              description="전체, 캠퍼스, 반, 개인 단위로 메시지 도달 범위를 지정할 수 있습니다."
              className="gap-1"
            />

            <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,0.7fr)_repeat(4,minmax(0,1fr))]">
              <label className="grid gap-2 text-sm font-medium text-foreground">
                대상 범위
                <Select
                  value={audienceScope}
                  onChange={(event) =>
                    handleAudienceScopeChange(
                      event.target.value as PushAudienceScope,
                    )
                  }
                >
                  <option value="all">전체</option>
                  <option value="year">기수</option>
                  <option value="campus">캠퍼스</option>
                  <option value="class">반</option>
                  <option value="member">개인</option>
                </Select>
              </label>

              <label className="grid gap-2 text-sm font-medium text-foreground">
                기수
                <Select
                  value={selectedYear}
                  disabled={audienceScope !== "year"}
                  onChange={(event) => setSelectedYear(event.target.value)}
                >
                  <option value="">기수 선택</option>
                  {audienceYearOptions.map((year) => (
                    <option key={year} value={String(year)}>
                      {formatSsafyYearLabel(year)}
                    </option>
                  ))}
                </Select>
              </label>

              <label className="grid gap-2 text-sm font-medium text-foreground">
                캠퍼스
                <Select
                  value={selectedCampus}
                  disabled={
                    audienceScope === "all" ||
                    audienceScope === "year" ||
                    audienceScope === "member"
                  }
                  onChange={(event) => {
                    setSelectedCampus(event.target.value);
                    setSelectedClassNumber("");
                  }}
                >
                  <option value="">캠퍼스 선택</option>
                  {campusOptions.map((campus) => (
                    <option key={campus} value={campus}>
                      {campus}
                    </option>
                  ))}
                </Select>
              </label>

              <label className="grid gap-2 text-sm font-medium text-foreground">
                반
                <Select
                  value={selectedClassNumber}
                  disabled={audienceScope !== "class" || !selectedCampus}
                  onChange={(event) => setSelectedClassNumber(event.target.value)}
                >
                  <option value="">반 선택</option>
                  {classOptions.map((classNumber) => (
                    <option key={classNumber} value={classNumber}>
                      {classNumber}반
                    </option>
                  ))}
                </Select>
              </label>

              <label className="grid gap-2 text-sm font-medium text-foreground">
                개인
                <Select
                  value={selectedMemberId}
                  disabled={audienceScope !== "member"}
                  onChange={(event) => setSelectedMemberId(event.target.value)}
                >
                  <option value="">개인 선택</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {getMemberLabel(member)}
                    </option>
                  ))}
                </Select>
              </label>
            </div>
          </div>

          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <label className="grid gap-2 text-sm font-medium text-foreground">
              제목
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="알림 제목"
                maxLength={60}
                required
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-foreground">
              가게 상세 페이지 선택
              <Select
                value={selectedPartnerId}
                onChange={(event) => handlePartnerChange(event.target.value)}
              >
                <option value="">직접 URL 입력</option>
                {partners.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.name}
                  </option>
                ))}
              </Select>
            </label>
          </div>

          <label className="grid gap-2 text-sm font-medium text-foreground">
            내용
            <Textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="알림 내용"
              rows={4}
              maxLength={160}
              required
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-foreground">
            이동 URL
            <Input
              value={url}
              onChange={(event) => handleUrlChange(event.target.value)}
              placeholder="예: /partners/uuid 또는 https://..."
            />
          </label>

          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid min-w-0 gap-1">
              <p className="text-sm text-muted-foreground">
                신규 제휴와 종료 7일 전 알림은 자동 발송되며, 수동 공지는 위 대상 범위에 맞춰 발송됩니다.
              </p>
              <p className="text-xs font-medium text-muted-foreground">
                예상 발송 대상 {targetableCount}명
              </p>
            </div>
            <Button
              type="submit"
              className="w-full justify-center sm:w-auto"
              loading={pending}
              loadingText="공지 발송 중"
              disabled={!configured || targetableCount === 0}
            >
              공지 발송
            </Button>
          </div>
        </form>
      </section>

      <section className="grid min-w-0 gap-4 overflow-hidden rounded-3xl border border-border bg-surface-muted/50 p-4 sm:p-5">
        <SectionHeading
          title="푸시 메시지 로그"
          description="과거 메시지를 검색, 정렬, 필터링하고 필요하면 입력 폼으로 다시 불러올 수 있습니다."
        />

        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.35fr)_repeat(5,minmax(0,0.75fr))]">
          <Input
            className="sm:col-span-2 xl:col-span-1"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="제목, 내용, URL, 대상 검색"
          />
          <Select
            value={typeFilter}
            onChange={(event) =>
              setTypeFilter(event.target.value as PushMessageLog["type"] | "all")
            }
          >
            <option value="all">전체 유형</option>
            <option value="announcement">운영 공지</option>
            <option value="new_partner">신규 제휴</option>
            <option value="expiring_partner">종료 임박</option>
          </Select>
          <Select
            value={sourceFilter}
            onChange={(event) =>
              setSourceFilter(
                event.target.value as PushMessageLog["source"] | "all",
              )
            }
          >
            <option value="all">전체 발송 방식</option>
            <option value="manual">수동 발송</option>
            <option value="automatic">자동 발송</option>
          </Select>
          <Select
            value={audienceFilter}
            onChange={(event) =>
              setAudienceFilter(
                event.target.value as PushAudienceScope | "all",
              )
            }
          >
            <option value="all">전체</option>
            <option value="year">기수</option>
            <option value="campus">캠퍼스</option>
            <option value="class">반</option>
            <option value="member">개인</option>
          </Select>
          <Select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as PushMessageLog["status"] | "all",
              )
            }
          >
            <option value="all">전체 상태</option>
            <option value="sent">발송 완료</option>
            <option value="partial_failed">일부 실패</option>
            <option value="failed">발송 실패</option>
            <option value="no_target">대상 없음</option>
            <option value="pending">대기</option>
          </Select>
          <Select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortOption)}
          >
            <option value="newest">최신순</option>
            <option value="oldest">오래된순</option>
            <option value="delivered">성공 수 많은순</option>
            <option value="failed">실패 수 많은순</option>
          </Select>
        </div>

        <div className="grid min-w-0 gap-3">
          {filteredLogs.length === 0 ? (
            <div className="min-w-0 overflow-hidden rounded-2xl border border-dashed border-border bg-surface px-4 py-8 text-center text-sm text-muted-foreground">
              조건에 맞는 푸시 메시지 로그가 없습니다.
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface px-4 py-4"
              >
                <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="bg-surface-muted text-foreground">
                        {typeLabels[log.type]}
                      </Badge>
                      <Badge className="bg-surface-muted text-muted-foreground">
                        {audienceLabels[log.target_scope]}
                      </Badge>
                      <Badge className="bg-surface-muted text-muted-foreground">
                        {sourceLabels[log.source]}
                      </Badge>
                      <Badge className={getStatusBadgeClass(log.status)}>
                        {statusLabels[log.status]}
                      </Badge>
                    </div>
                    <p className="mt-3 break-words text-base font-semibold text-foreground">
                      {log.title}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                      {log.body}
                    </p>
                    <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
                      <p>발송 시각: {formatDateTime(log.created_at)}</p>
                      <p className="break-all">발송 대상: {log.target_label}</p>
                      <p className="break-all">이동 URL: {log.url || "없음"}</p>
                      <p>
                        대상 {log.targeted} · 성공 {log.delivered} · 실패 {log.failed}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                    <Button
                      className="w-full justify-center sm:w-auto"
                      variant="ghost"
                      onClick={() => loadLog(log)}
                    >
                      메시지 불러오기
                    </Button>
                    <Button
                      variant="danger"
                      className="w-full justify-center sm:w-auto"
                      onClick={() => void deleteLog(log.id)}
                      loading={deletingLogId === log.id}
                      loadingText="삭제 중"
                      disabled={Boolean(deletingLogId && deletingLogId !== log.id)}
                    >
                      삭제
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
