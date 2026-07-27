import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import Link from "next/link";
import Surface from "@/components/ui/Surface";
import { ADMIN_NAV_GROUPS } from "./admin-navigation";
import AdminShellView from "./AdminShellView";
import AdminPageHeader from "./AdminPageHeader";

const meta = {
  title: "Domains/Admin/AdminShell",
  component: AdminShellView,
  args: {
    title: "관리 홈",
    logoutAction: async () => {},
    navGroups: ADMIN_NAV_GROUPS,
    children: (
      <div className="grid gap-4">
        <AdminPageHeader
          eyebrow="홈"
          title="운영 홈"
          description="처리할 작업을 먼저 확인하고 자주 쓰는 화면으로 이동합니다."
        />
        <Surface level="elevated" padding="lg" className="grid gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="ui-kicker text-primary">다음으로 처리</p>
              <h2 className="mt-1 text-lg font-semibold text-foreground">
                신규 제휴 접수
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                공개 등록 페이지에서 들어온 신청을 확인합니다.
              </p>
            </div>
            <span className="shrink-0 text-sm font-semibold text-primary">
              3건 검토 시작
            </span>
          </div>
          <Link
            href="/admin/partner-registrations?status=pending"
            className="text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            작업함에서 이어서 처리
          </Link>
        </Surface>
        <Surface level="default" padding="lg" className="grid gap-3">
          <h2 className="text-base font-semibold text-foreground">빠른 작업</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <Link
              href="/admin/members"
              className="rounded-2xl border border-border/70 bg-surface-inset p-3 text-sm font-semibold text-foreground hover:border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              회원 찾기
              <span className="mt-1 block text-xs font-medium text-muted-foreground">
                상태와 인증 이력 확인
              </span>
            </Link>
            <Link
              href="/admin/partners"
              className="rounded-2xl border border-border/70 bg-surface-inset p-3 text-sm font-semibold text-foreground hover:border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              제휴처 찾기
              <span className="mt-1 block text-xs font-medium text-muted-foreground">
                혜택과 공개 상태 확인
              </span>
            </Link>
          </div>
        </Surface>
      </div>
    ),
  },
} satisfies Meta<typeof AdminShellView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    await expect(canvas.getByRole("heading", { level: 1 })).toHaveTextContent("운영 홈");
    await expect(
      canvasElement.querySelector('a[href="#admin-main-content"]'),
    ).toBeInTheDocument();
  },
};

export const WithBackAction: Story = {
  args: {
    title: "파트너사 편집",
    backHref: "/admin/partners",
    backLabel: "목록으로",
  },
};

export const MobilePrimaryNavigation: Story = {
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const navigation = canvas.getByRole("navigation", { name: "관리자 주요 탐색" });

    await expect(within(navigation).getByRole("link", { name: "홈" })).toHaveAttribute(
      "href",
      "/admin",
    );
    await expect(within(navigation).getByRole("link", { name: "작업함" })).toHaveAttribute(
      "href",
      "/admin/tasks",
    );
    await expect(within(navigation).getByRole("link", { name: "회원" })).toHaveAttribute(
      "href",
      "/admin/members",
    );
    await expect(
      await within(navigation).findByRole("button", { name: "관리 메뉴 열기" }),
    ).toBeInTheDocument();
    await expect(
      within(navigation).getByRole("button", { name: "빠른 찾기 열기" }),
    ).toBeInTheDocument();
    await expect(within(navigation).getByText("검색")).toBeInTheDocument();
    await expect(
      canvas.getByRole("link", { name: "주요 내용으로 건너뛰기" }),
    ).toHaveAttribute("href", "#admin-main-content");
  },
};
