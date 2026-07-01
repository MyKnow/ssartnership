import type { TabOption } from "@/components/ui/Tabs";

export type AdminPartnerWorkspaceTab = "partners" | "requests" | "categories";

type AdminPartnerWorkspaceTabCounts = {
  partnerCount: number;
  requestCount: number;
  categoryCount: number;
};

function formatCount(value: number) {
  return Math.max(0, value).toLocaleString("ko-KR");
}

export function normalizeAdminPartnerWorkspaceTab(
  value: string | null | undefined,
): AdminPartnerWorkspaceTab {
  if (value === "requests") {
    return "requests";
  }
  if (value === "categories" || value === "category") {
    return "categories";
  }
  return "partners";
}

export function createAdminPartnerWorkspaceTabOptions({
  partnerCount,
  requestCount,
  categoryCount,
}: AdminPartnerWorkspaceTabCounts): ReadonlyArray<TabOption<AdminPartnerWorkspaceTab>> {
  return [
    {
      value: "partners",
      label: "제휴처(브랜드)",
      description: `등록 ${formatCount(partnerCount)}개 · 노출/혜택 정보`,
    },
    {
      value: "requests",
      label: "변경 요청",
      description: `승인 대기 ${formatCount(requestCount)}건`,
    },
    {
      value: "categories",
      label: "카테고리",
      description: `분류 ${formatCount(categoryCount)}개`,
    },
  ];
}
