import { useMemo, useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { AdminLogsExplorer } from "./AdminLogsExplorer";
import type { GroupFilter, NormalizedLog, SortFilter, StatusFilter } from "./types";

const baseLogs: NormalizedLog[] = [
  {
    id: "product-1",
    group: "product",
    name: "partner_detail_view",
    label: "파트너 상세 조회",
    status: null,
    actorType: "member",
    actorId: "member-1",
    actorName: "김싸피",
    actorMmUsername: "ssafy15",
    identifier: null,
    ipAddress: "127.0.0.1",
    path: "/partners/partner-1",
    referrer: "/",
    targetType: "partner",
    targetId: "partner-1",
    partnerId: "partner-1",
    partnerName: "역삼 분식랩",
    properties: { partnerName: "역삼 분식랩" },
    createdAt: "2026-04-25T09:00:00.000Z",
    actorSearchLabel: "@ssafy15",
    searchText: "김싸피 ssafy15 127.0.0.1 /partners/partner-1 역삼 분식랩",
  },
  {
    id: "audit-1",
    group: "audit",
    name: "partner_update",
    label: "브랜드 수정",
    status: null,
    actorType: "admin",
    actorId: "admin-1",
    actorName: "관리자",
    actorMmUsername: null,
    identifier: null,
    ipAddress: "127.0.0.2",
    path: "/admin/partners/partner-1",
    referrer: null,
    targetType: "partner",
    targetId: "partner-1",
    partnerId: "partner-1",
    partnerName: "역삼 분식랩",
    properties: { field: "benefits" },
    createdAt: "2026-04-25T08:00:00.000Z",
    actorSearchLabel: "관리자",
    searchText: "관리자 127.0.0.2 /admin/partners/partner-1 benefits",
  },
  {
    id: "security-1",
    group: "security",
    name: "member_login",
    label: "회원 로그인",
    status: "success",
    actorType: "member",
    actorId: "member-2",
    actorName: "박운영",
    actorMmUsername: "ops15",
    identifier: "ops15",
    ipAddress: "127.0.0.3",
    path: "/auth/login",
    referrer: null,
    targetType: null,
    targetId: null,
    partnerId: null,
    partnerName: null,
    properties: null,
    createdAt: "2026-04-25T07:00:00.000Z",
    actorSearchLabel: "@ops15",
    searchText: "박운영 ops15 127.0.0.3 /auth/login success",
  },
];

function AdminLogsExplorerDemo({
  logs,
}: {
  logs: NormalizedLog[];
}) {
  const [searchValue, setSearchValue] = useState("");
  const [groupFilter, setGroupFilter] = useState<GroupFilter>("all");
  const [nameFilter, setNameFilter] = useState("all");
  const [actorFilter, setActorFilter] = useState<"all" | string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortFilter, setSortFilter] = useState<SortFilter>("newest");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInputValue, setPageInputValue] = useState("1");

  const filteredLogs = useMemo(() => {
    const normalized = logs.filter((log) => {
      if (groupFilter !== "all" && log.group !== groupFilter) return false;
      if (nameFilter !== "all" && log.name !== nameFilter) return false;
      if (actorFilter !== "all" && log.actorType !== actorFilter) return false;
      if (statusFilter !== "all" && log.status !== statusFilter) return false;
      if (searchValue.trim()) {
        const needle = searchValue.trim().toLowerCase();
        if (!log.searchText.toLowerCase().includes(needle)) return false;
      }
      return true;
    });

    const sorted = [...normalized];
    if (sortFilter === "oldest") {
      sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    } else if (sortFilter === "actor") {
      sorted.sort((a, b) => a.actorSearchLabel.localeCompare(b.actorSearchLabel));
    } else if (sortFilter === "ip") {
      sorted.sort((a, b) => (a.ipAddress ?? "").localeCompare(b.ipAddress ?? ""));
    } else {
      sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    return sorted;
  }, [actorFilter, groupFilter, logs, nameFilter, searchValue, sortFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * pageSize;
  const visibleLogs = filteredLogs.slice(pageStart, pageStart + pageSize);

  return (
    <AdminLogsExplorer
      filteredLogs={visibleLogs}
      filteredTotal={filteredLogs.length}
      totalLogs={logs.length}
      currentPage={safeCurrentPage}
      totalPages={totalPages}
      pageSize={pageSize}
      pageInputValue={pageInputValue}
      pageSizeOptions={[1, 10, 50, 100]}
      pageStart={pageStart}
      searchValue={searchValue}
      groupFilter={groupFilter}
      nameFilter={nameFilter}
      actorFilter={actorFilter}
      statusFilter={statusFilter}
      sortFilter={sortFilter}
      availableNames={[
        { value: "all", label: "전체" },
        ...Array.from(new Set(logs.map((log) => log.name))).map((name) => ({
          value: name,
          label: name,
        })),
      ]}
      actorOptions={Array.from(new Set(logs.map((log) => log.actorType).filter(Boolean))) as string[]}
      onSearchChange={(value) => {
        setSearchValue(value);
        setCurrentPage(1);
        setPageInputValue("1");
      }}
      onGroupFilterChange={(value) => {
        setGroupFilter(value);
        setCurrentPage(1);
        setPageInputValue("1");
      }}
      onNameFilterChange={setNameFilter}
      onActorFilterChange={setActorFilter}
      onStatusFilterChange={setStatusFilter}
      onSortFilterChange={setSortFilter}
      onPageInputChange={setPageInputValue}
      onPageSizeChange={(value) => {
        setPageSize(value);
        setCurrentPage(1);
        setPageInputValue("1");
      }}
      onPageChange={(value) => {
        const next = Math.min(Math.max(value, 1), totalPages);
        setCurrentPage(next);
        setPageInputValue(String(next));
      }}
    />
  );
}

function AdminLogsExplorerStory(props: { filteredLogs?: NormalizedLog[] }) {
  return <AdminLogsExplorerDemo logs={props.filteredLogs ?? []} />;
}

const meta = {
  title: "Domains/Admin/AdminLogsExplorer",
  component: AdminLogsExplorerStory,
  args: {
    filteredLogs: baseLogs,
  },
} satisfies Meta<typeof AdminLogsExplorer>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByPlaceholderText("유저명, @MM 아이디, IP, 경로, 대상, 속성으로 검색"),
      "ops15",
    );
    await expect(canvas.getByText("회원 로그인")).toBeInTheDocument();
    await expect(canvas.queryByText("파트너 상세 조회")).not.toBeInTheDocument();
  },
};

export const Empty: Story = {
  args: {
    filteredLogs: [],
  },
};

export const Paginated: Story = {
  args: {
    filteredLogs: [...baseLogs, ...baseLogs.map((log, index) => ({
      ...log,
      id: `${log.id}-${index + 2}`,
      createdAt: `2026-04-25T0${(index % 3) + 4}:00:00.000Z`,
    }))],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.selectOptions(canvas.getByLabelText("페이지당"), "1");
    await userEvent.click(canvas.getByRole("button", { name: "다음" }));
    await expect(canvas.getByText("2 / 6")).toBeInTheDocument();
  },
};
