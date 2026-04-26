import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import {
  countTargetableMembers,
  createAudienceYearOptions,
  createCampusOptions,
  createYearOptions,
  filterPushLogs,
} from "./selectors";

const members = [
  {
    id: "member-1",
    mm_username: "ssafy15",
    display_name: "김싸피",
    year: 15,
    campus: "서울",
  },
  {
    id: "member-2",
    mm_username: "ops15",
    display_name: "박운영",
    year: 15,
    campus: "서울",
  },
  {
    id: "member-3",
    mm_username: "alumni14",
    display_name: "최동문",
    year: 14,
    campus: "대전",
  },
  {
    id: "member-4",
    mm_username: "unknown",
    display_name: "무캠퍼스",
    year: null,
    campus: null,
  },
] as const;

const logs = [
  {
    id: "log-1",
    title: "신규 제휴",
    body: "서울 캠퍼스 분식랩 공지",
    url: "/partners/partner-1",
    targetLabel: "전체 사용자",
    notificationType: "announcement",
    source: "manual",
    status: "sent",
    targetScope: "all",
    createdAt: "2026-04-25T10:00:00.000Z",
    channelResults: {
      in_app: { sent: 3, failed: 0 },
      push: { sent: 2, failed: 1 },
      mm: { sent: 0, failed: 0 },
    },
  },
  {
    id: "log-2",
    title: "종료 임박",
    body: "대전 캠퍼스 종료 알림",
    url: "/partners/partner-2",
    targetLabel: "대전 캠퍼스",
    notificationType: "expiring_partner",
    source: "automatic",
    status: "failed",
    targetScope: "campus",
    createdAt: "2026-04-24T10:00:00.000Z",
    channelResults: {
      in_app: { sent: 0, failed: 1 },
      push: { sent: 0, failed: 2 },
      mm: { sent: 0, failed: 1 },
    },
  },
] as never;

function PushManagerSelectorsPreview() {
  const filteredNewest = filterPushLogs({
    logs,
    search: "분식랩",
    typeFilter: "all",
    sourceFilter: "all",
    statusFilter: "all",
    audienceFilter: "all",
    sort: "newest",
  });
  const filteredFailed = filterPushLogs({
    logs,
    search: "",
    typeFilter: "all",
    sourceFilter: "automatic",
    statusFilter: "failed",
    audienceFilter: "campus",
    sort: "failed",
  });

  return (
    <div className="space-y-2 text-sm text-foreground">
      <div>campuses:{createCampusOptions([...members]).join(",")}</div>
      <div>years:{createYearOptions([...members]).join(",")}</div>
      <div>audience-years:{createAudienceYearOptions("13", [15, 14]).join(",")}</div>
      <div>count-all:{countTargetableMembers({ audienceScope: "all", members: [...members], selectedYear: "", selectedCampus: "", selectedMemberId: "" })}</div>
      <div>count-year:{countTargetableMembers({ audienceScope: "year", members: [...members], selectedYear: "15", selectedCampus: "", selectedMemberId: "" })}</div>
      <div>count-campus:{countTargetableMembers({ audienceScope: "campus", members: [...members], selectedYear: "", selectedCampus: "서울", selectedMemberId: "" })}</div>
      <div>count-member:{countTargetableMembers({ audienceScope: "member", members: [...members], selectedYear: "", selectedCampus: "", selectedMemberId: "member-3" })}</div>
      <div>count-member-none:{countTargetableMembers({ audienceScope: "member", members: [...members], selectedYear: "", selectedCampus: "", selectedMemberId: "missing" })}</div>
      <div>filtered-newest:{filteredNewest.map((log) => log.id).join(",")}</div>
      <div>filtered-failed:{filteredFailed.map((log) => log.id).join(",")}</div>
    </div>
  );
}

const meta = {
  title: "Domains/Admin/PushManagerSelectors",
  component: PushManagerSelectorsPreview,
} satisfies Meta<typeof PushManagerSelectorsPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Summary: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("campuses:대전,서울")).toBeInTheDocument();
    await expect(canvas.getByText("years:15,14")).toBeInTheDocument();
    await expect(canvas.getByText("audience-years:15,14,13")).toBeInTheDocument();
    await expect(canvas.getByText("count-all:4")).toBeInTheDocument();
    await expect(canvas.getByText("count-year:2")).toBeInTheDocument();
    await expect(canvas.getByText("count-campus:2")).toBeInTheDocument();
    await expect(canvas.getByText("count-member:1")).toBeInTheDocument();
    await expect(canvas.getByText("count-member-none:0")).toBeInTheDocument();
    await expect(canvas.getByText("filtered-newest:log-1")).toBeInTheDocument();
    await expect(canvas.getByText("filtered-failed:log-2")).toBeInTheDocument();
  },
};
