import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import PartnerPortalShellView from "./PartnerPortalShellView";

const companyId = "mock-partner-company-cafe-ssafy";
const session = {
  accountId: "mock-partner-account-cafe-ssafy",
  loginId: "partner@cafessafy.example",
  displayName: "김싸피 담당자",
  companyIds: [companyId],
  mustChangePassword: false,
  issuedAt: Date.now(),
  expiresAt: Date.now() + 60_000,
};
const companies = [
  {
    id: companyId,
    name: "카페 싸피 파트너사",
    slug: "cafe-ssafy",
    description: "서울 캠퍼스 인근 카페 파트너사",
    serviceCount: 3,
  },
];

const meta = {
  title: "Domains/Partner/ActualView/PortalShell",
  component: PartnerPortalShellView,
  args: {
    session,
    companies,
    isMock: false,
    children: (
      <div className="p-5">
        <h1 className="text-xl font-semibold text-foreground">운영 홈</h1>
      </div>
    ),
  },
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "mobile1" },
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: `/partner/companies/${companyId}`,
      },
    },
  },
} satisfies Meta<typeof PartnerPortalShellView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const MobileFourItemNavigation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const navigation = canvas.getByRole("navigation", {
      name: "파트너 포털 주요 메뉴",
    });
    const nav = within(navigation);

    await expect(nav.getByText("홈")).toBeVisible();
    await expect(nav.getByText("제휴처")).toBeVisible();
    await expect(nav.getByText("알림")).toBeVisible();
    await expect(nav.getByText("더보기")).toBeVisible();
    await expect(navigation.children).toHaveLength(4);

    await userEvent.click(nav.getByText("더보기"));
    await expect(nav.getByRole("link", { name: "계정" })).toHaveAttribute(
      "href",
      `/partner/account?companyId=${companyId}`,
    );
    await expect(
      nav.getByRole("link", { name: "기술 지원" }),
    ).toHaveAttribute(
      "href",
      `/partner/support?companyId=${companyId}`,
    );
  },
};
