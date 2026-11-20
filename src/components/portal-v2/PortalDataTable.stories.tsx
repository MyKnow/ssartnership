import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import PortalBadge from "./PortalBadge";
import { PortalButtonLink } from "./PortalButton";
import { PortalTablePanel, type PortalColumn } from "./PortalDataTable";
import PortalPagination from "./PortalPagination";

type Row = { id: string; name: string; benefit: string; status: "운영 중" | "보완 필요"; todo: string };

const rows: Row[] = [
  { id: "1", name: "카페 루프 역삼점", benefit: "음료 10% 할인", status: "운영 중", todo: "변경 검토 중" },
  {
    id: "2",
    name: "루프 스튜디오 서울 역삼 본점 장기 이용권 제휴",
    benefit: "대관 15% 할인과 첫 방문 시 음료 1잔 무료 제공",
    status: "보완 필요",
    todo: "운영 시간 보완",
  },
];

const columns: PortalColumn<Row>[] = [
  { id: "name", header: "제휴처", cell: (row) => row.name, width: "30%", primary: true },
  { id: "benefit", header: "혜택", cell: (row) => row.benefit, width: "28%" },
  {
    id: "status",
    header: "상태",
    cell: (row) => <PortalBadge tone={row.status === "운영 중" ? "success" : "warning"}>{row.status}</PortalBadge>,
    width: "14%",
  },
  { id: "todo", header: "처리 필요", cell: (row) => row.todo, width: "16%" },
  {
    id: "actions",
    header: "관리",
    cell: (row) => (
      <PortalButtonLink href={`/partner/services/${row.id}`} aria-label={`${row.name} 상세 보기`}>
        상세 보기
      </PortalButtonLink>
    ),
    width: "12%",
    align: "end",
    mobileLabel: "관리",
  },
];

const meta = {
  title: "Domains/PortalV2/DataTable",
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="portal-v2 p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const LongKorean: Story = {
  render: () => (
    <PortalTablePanel
      title="내 제휴처"
      caption="내 제휴처 목록"
      columns={columns}
      rows={rows}
      getRowKey={(row) => row.id}
      footer={<PortalPagination summary="전체 2곳" page={1} pageCount={1} />}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // 표(md 이상)와 카드 목록(모바일)은 CSS로 전환되므로 뷰포트와 무관하게 DOM 계약을 확인한다.
    await expect(canvas.getByRole("table", { name: "내 제휴처 목록", hidden: true })).toBeInTheDocument();
    await expect(canvas.getAllByRole("columnheader", { hidden: true })).toHaveLength(5);
    await expect(canvas.getAllByRole("listitem", { hidden: true })).toHaveLength(2);
  },
};
