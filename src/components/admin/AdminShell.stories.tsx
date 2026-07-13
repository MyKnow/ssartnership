import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import Card from "@/components/ui/Card";
import { ADMIN_NAV_GROUPS } from "./admin-navigation";
import AdminShellView from "./AdminShellView";
import AdminPageHeader from "./AdminPageHeader";

const meta = {
  title: "Domains/Admin/AdminShell",
  component: AdminShellView,
  args: {
    title: "관리 대시보드",
    logoutAction: async () => {},
    navGroups: ADMIN_NAV_GROUPS,
    children: (
      <div className="grid gap-4">
        <AdminPageHeader
          eyebrow="Operations"
          title="관리 대시보드"
          description="처리가 필요한 항목과 운영 현황을 확인합니다."
        />
        <Card className="grid gap-2">
          <h2 className="text-lg font-semibold text-foreground">오늘의 운영 현황</h2>
          <p className="text-sm text-muted-foreground">
            파트너사, 제휴처, 리뷰, 발송, 로그 영역으로 이동하는 상위 레이아웃입니다.
          </p>
        </Card>
        <Card className="grid gap-2">
          <h3 className="text-base font-semibold text-foreground">빠른 작업</h3>
          <p className="text-sm text-muted-foreground">
            신규 제휴 등록, 리뷰 검수, 공지 발송 같은 작업이 이 안쪽 콘텐츠로 배치됩니다.
          </p>
        </Card>
      </div>
    ),
  },
} satisfies Meta<typeof AdminShellView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithBackAction: Story = {
  args: {
    title: "파트너사 편집",
    backHref: "/admin/partners",
    backLabel: "목록으로",
  },
};
