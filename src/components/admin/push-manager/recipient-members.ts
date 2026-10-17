import { formatSsafyMemberLifecycleLabel } from "@/lib/ssafy-year";
import type { AdminNotificationEligibleMember } from "@/lib/admin-notification-ops-types";
import type { MemberOption } from "./types";

export type MemberSortOption = "name" | "year" | "campus";

export function formatRecipientMeta(year: number, campus: string | null) {
  const yearLabel = year === 0 ? "운영진" : formatSsafyMemberLifecycleLabel(year);
  return `${yearLabel} · ${campus ?? "캠퍼스 미지정"}`;
}

export function filterAndSortRecipientOptions(
  members: MemberOption[],
  query: string,
  sortBy: MemberSortOption,
  getMemberLabel: (member: MemberOption) => string,
) {
  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
  const matchedMembers = normalizedQuery
    ? members.filter((member) =>
        [
          member.display_name ?? "",
          member.mm_username,
          member.year ?? "",
          member.campus ?? "",
          getMemberLabel(member),
        ]
          .join(" ")
          .toLocaleLowerCase("ko-KR")
          .includes(normalizedQuery),
      )
    : members;

  return [...matchedMembers].sort((left, right) => {
    switch (sortBy) {
      case "year":
        return (right.year ?? -1) - (left.year ?? -1) || (left.campus ?? "").localeCompare(right.campus ?? "", "ko-KR") || getMemberLabel(left).localeCompare(getMemberLabel(right), "ko-KR");
      case "campus":
        return (left.campus ?? "zzz").localeCompare(right.campus ?? "zzz", "ko-KR") || (right.year ?? -1) - (left.year ?? -1) || getMemberLabel(left).localeCompare(getMemberLabel(right), "ko-KR");
      case "name":
      default:
        return getMemberLabel(left).localeCompare(getMemberLabel(right), "ko-KR");
    }
  });
}

export function filterEligibleRecipients(
  members: AdminNotificationEligibleMember[],
  query: string,
) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return members;
  }

  return members.filter((member) =>
    [member.name, member.mmUsername, member.campus ?? ""]
      .join(" ")
      .toLowerCase()
      .includes(normalized),
  );
}
