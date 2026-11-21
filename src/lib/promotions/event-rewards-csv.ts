import { toCsvCell } from "@/lib/csv";
import type { EventConditionKey } from "@/lib/promotions/catalog";
import type {
  EventRewardAdminMemberRow,
  EventRewardAdminOverview,
  EventRewardBeforeStatus,
  EventRewardComparisonOverview,
} from "@/lib/promotions/event-rewards-types";

function conditionStatusLabel(
  row: EventRewardAdminMemberRow,
  key: EventConditionKey,
) {
  const condition = row.conditions.find((item) => item.key === key);
  if (key === "review") {
    return String(condition?.currentCount ?? 0);
  }
  return condition?.status === "received" ? "완료" : "미완료";
}

function beforeConditionStatusLabel(value: EventRewardBeforeStatus | undefined) {
  if (value === "received") {
    return "완료";
  }
  if (value === "missing") {
    return "미완료";
  }
  return "확인불가";
}

export function createEventRewardCsv(overview: EventRewardAdminOverview) {
  const headers = [
    "이름",
    "MM ID",
    "기수",
    "캠퍼스",
    "총 추첨권",
    "signup",
    "mm",
    "push",
    "marketing",
    "review",
  ];
  const rows = overview.members.map((member) => [
    member.displayName ?? "",
    member.mmUsername,
    member.year,
    member.campus ?? "",
    member.totalTickets,
    conditionStatusLabel(member, "signup"),
    conditionStatusLabel(member, "mm"),
    conditionStatusLabel(member, "push"),
    conditionStatusLabel(member, "marketing"),
    conditionStatusLabel(member, "review"),
  ]);

  return `\uFEFF${[headers, ...rows]
    .map((row) => row.map((value) => toCsvCell(value)).join(","))
    .join("\n")}`;
}

export function createEventRewardComparisonCsv(
  overview: EventRewardComparisonOverview,
) {
  const headers = [
    "이름",
    "MM ID",
    "기수",
    "캠퍼스",
    "이벤트 전 가입",
    "이벤트 중 가입",
    "Before 추첨권(확인가능)",
    "After 추첨권",
    "증감(확인가능)",
    "before_signup",
    "before_mm",
    "before_push",
    "before_marketing",
    "after_signup",
    "after_mm",
    "after_push",
    "after_marketing",
    "after_review",
  ];
  const rows = overview.members.map((member) => [
    member.displayName ?? "",
    member.mmUsername,
    member.year,
    member.campus ?? "",
    member.existedBeforeEvent ? "Y" : "N",
    member.joinedDuringEvent ? "Y" : "N",
    member.beforeKnownTickets,
    member.afterTickets,
    member.knownTicketDelta,
    beforeConditionStatusLabel(member.beforeConditions.signup),
    beforeConditionStatusLabel(member.beforeConditions.mm),
    beforeConditionStatusLabel(member.beforeConditions.push),
    beforeConditionStatusLabel(member.beforeConditions.marketing),
    conditionStatusLabel(member, "signup"),
    conditionStatusLabel(member, "mm"),
    conditionStatusLabel(member, "push"),
    conditionStatusLabel(member, "marketing"),
    conditionStatusLabel(member, "review"),
  ]);

  return `\uFEFF${[headers, ...rows]
    .map((row) => row.map((value) => toCsvCell(value)).join(","))
    .join("\n")}`;
}
