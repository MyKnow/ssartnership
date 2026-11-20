import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { Bell, ChartNoAxesCombined, FileText, Inbox, Settings, Store, Users } from "lucide-react";
import PortalBadge from "./PortalBadge";
import PortalButton from "./PortalButton";
import PortalMetricGrid from "./PortalMetric";
import PortalPageHeader from "./PortalPageHeader";
import PortalPanel from "./PortalPanel";
import PortalShell from "./PortalShell";
import type { PortalNavGroup } from "./portal-shell-navigation";

const partnerGroups: PortalNavGroup[] = [
  {
    id: "home",
    label: "홈",
    items: [{ id: "home", href: "/partner/companies/c1", label: "홈", icon: ChartNoAxesCombined, active: true }],
  },
  {
    id: "services",
    label: "제휴처",
    items: [
      { id: "services", href: "/partner/companies/c1/services", label: "제휴처", icon: Store },
      { id: "plans", href: "/partner/companies/c1/plans", label: "플랜", icon: FileText },
    ],
  },
  {
    id: "alerts",
    label: "알림",
    items: [{ id: "notifications", href: "/partner/notifications", label: "내 알림", icon: Bell }],
  },
  {
    id: "more",
    label: "더보기",
    items: [{ id: "account", href: "/partner/account", label: "계정·담당자 정보", icon: Settings }],
  },
];

const adminGroups: PortalNavGroup[] = [
  {
    id: "ops",
    label: "운영",
    items: [
      { id: "home", href: "/admin", label: "운영 홈", icon: ChartNoAxesCombined, active: true },
      { id: "tasks", href: "/admin/tasks", label: "작업함", icon: Inbox, badge: "3" },
      { id: "members", href: "/admin/members", label: "회원", icon: Users },
    ],
  },
  {
    id: "content",
    label: "콘텐츠 · 설정",
    items: [{ id: "push", href: "/admin/push", label: "발송·내 알림", icon: Bell }],
  },
];

function Content() {
  return (
    <>
      <PortalPageHeader
        title="제휴 성과와 운영 현황"
        description="제휴로 생긴 관심과 지금 처리할 일을 한눈에 확인하세요."
      />
      <PortalPanel title="핵심 현황">
        <PortalMetricGrid
          items={[
            { id: "views", label: "제휴처 조회", value: "1,284회" },
            { id: "saves", label: "관심 저장", value: "96회" },
            { id: "services", label: "운영 제휴처", value: "2곳" },
            { id: "pending", label: "검토 대기", value: "1건" },
          ]}
        />
      </PortalPanel>
    </>
  );
}

const meta = {
  title: "Domains/PortalV2/Shell",
  component: PortalShell,
  parameters: { layout: "fullscreen" },
  args: {
    brand: { name: "싸트너십", area: "파트너 포털", href: "/partner" },
    navGroups: partnerGroups,
    mobileNavItems: [partnerGroups[0].items[0], partnerGroups[1].items[0], partnerGroups[2].items[0]],
    topBarStart: <p className="truncate pv2-label">카페 루프 · 루프 담당자</p>,
    topBarEnd: <PortalButton>내 알림</PortalButton>,
    sidebarFooter: <PortalButton variant="secondary" fullWidth>로그아웃</PortalButton>,
    children: <Content />,
  },
} satisfies Meta<typeof PortalShell>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Partner: Story = {};

export const Admin: Story = {
  args: {
    brand: { name: "싸트너십", area: "어드민", href: "/admin" },
    scope: (
      <div className="rounded-pv2-control bg-pv2-nav-active p-3 pv2-label text-pv2-on-dark">서울 캠퍼스 · 15기</div>
    ),
    navGroups: adminGroups,
    mobileNavItems: adminGroups[0].items,
    topBarEnd: <PortalBadge tone="info">서울 캠퍼스</PortalBadge>,
  },
};

export const MobileMenu: Story = {
  globals: { viewport: { value: "mobile1", isRotated: false } },
  parameters: { viewport: { defaultViewport: "mobile1" } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const opener = canvas.getAllByRole("button", { name: /메뉴/ })[0];
    await userEvent.click(opener);
    const dialog = await within(document.body).findByRole("dialog");
    await expect(dialog).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await expect(canvas.queryByRole("dialog")).toBeNull();
  },
};
