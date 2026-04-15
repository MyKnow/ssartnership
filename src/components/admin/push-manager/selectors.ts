import type { PushAudienceScope, PushMessageLog } from "@/lib/push";
import type { MemberOption, SortOption } from "./types";

export function createCampusOptions(members: MemberOption[]) {
  return Array.from(
    new Set(
      members
        .map((member) => member.campus?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort((a, b) => a.localeCompare(b, "ko-KR"));
}

export function createYearOptions(members: MemberOption[]) {
  return Array.from(
    new Set(
      members
        .map((member) => member.year)
        .filter((value): value is number => typeof value === "number"),
    ),
  ).sort((a, b) => b - a);
}

export function createAudienceYearOptions(
  selectedYear: string,
  yearOptions: number[],
) {
  const next = new Set(yearOptions);
  const parsedSelectedYear = Number.parseInt(selectedYear, 10);
  if (Number.isInteger(parsedSelectedYear)) {
    next.add(parsedSelectedYear);
  }
  return Array.from(next).sort((a, b) => b - a);
}

export function countTargetableMembers(params: {
  audienceScope: PushAudienceScope;
  members: MemberOption[];
  selectedYear: string;
  selectedCampus: string;
  selectedMemberId: string;
}) {
  const { audienceScope, members, selectedCampus, selectedMemberId, selectedYear } = params;
  switch (audienceScope) {
    case "all":
      return members.length;
    case "year":
      return members.filter((member) => String(member.year ?? "") === selectedYear).length;
    case "campus":
      return members.filter((member) => member.campus === selectedCampus).length;
    case "member":
      return members.some((member) => member.id === selectedMemberId) ? 1 : 0;
    default:
      return 0;
  }
}

export function filterPushLogs(params: {
  logs: PushMessageLog[];
  search: string;
  typeFilter: PushMessageLog["type"] | "all";
  sourceFilter: PushMessageLog["source"] | "all";
  statusFilter: PushMessageLog["status"] | "all";
  audienceFilter: PushAudienceScope | "all";
  sort: SortOption;
}) {
  const {
    audienceFilter,
    logs,
    search,
    sort,
    sourceFilter,
    statusFilter,
    typeFilter,
  } = params;
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
    const matchesAudience = audienceFilter === "all" || log.target_scope === audienceFilter;

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
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case "delivered":
        return b.delivered - a.delivered;
      case "failed":
        return b.failed - a.failed;
      case "newest":
      default:
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });

  return next;
}
