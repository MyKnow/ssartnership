import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import MobileNav from "./MobileNav";
import MobileNavGuestGate from "./MobileNavGuestGate";

const meta = {
  title: "Domains/MobileNav",
  component: MobileNav,
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
  decorators: [
    (Story) => (
      <div className="min-h-[36rem] bg-background px-4 py-8">
        <div className="grid gap-4">
          <div className="h-36 rounded-panel border border-border bg-surface" />
          <div className="h-56 rounded-panel border border-border bg-surface-muted" />
        </div>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MobileNav>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Guest: Story = {
  args: {
    signedInUserId: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("navigation", { name: "모바일 주요 탐색" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("link", { name: "혜택 검색" }),
    ).toHaveAttribute("href", "/#benefit-search");
    await expect(canvas.getByRole("link", { name: "쿠폰함" })).toHaveAttribute(
      "href",
      "/auth/login?returnTo=%2Fcoupons",
    );
    await expect(canvas.getByRole("link", { name: "내 정보" })).toHaveAttribute(
      "href",
      "/auth/login?returnTo=%2Fcertification",
    );
  },
};

export const GuestCouponsGate: Story = {
  args: {
    signedInUserId: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);

    const couponsLink = canvas.getByRole("link", { name: "쿠폰함" });
    await userEvent.click(couponsLink);
    await expect(couponsLink).toHaveAttribute("aria-expanded", "true");

    const dialog = await body.findByRole("dialog", {
      name: "쿠폰함은 로그인 후 이용할 수 있어요",
    });
    const dialogCanvas = within(dialog);
    await expect(
      dialogCanvas.getByRole("link", { name: "로그인하고 쿠폰함 보기" }),
    ).toHaveAttribute("href", "/auth/login?returnTo=%2Fcoupons");
    await expect(
      dialogCanvas.getByRole("link", { name: "회원가입" }),
    ).toHaveAttribute("href", "/auth/signup?returnTo=%2Fcoupons");
  },
};

export const GuestProfileGate: Story = {
  args: {
    signedInUserId: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);

    const profileLink = canvas.getByRole("link", { name: "내 정보" });
    await userEvent.click(profileLink);
    await expect(profileLink).toHaveAttribute("aria-expanded", "true");

    const dialog = await body.findByRole("dialog", {
      name: "내 정보를 확인하려면 로그인해 주세요",
    });
    const dialogCanvas = within(dialog);
    await expect(
      dialogCanvas.getByRole("link", { name: "로그인하고 내 정보 보기" }),
    ).toHaveAttribute("href", "/auth/login?returnTo=%2Fcertification");
    await expect(
      dialogCanvas.getByRole("link", { name: "회원가입" }),
    ).toHaveAttribute("href", "/auth/signup?returnTo=%2Fcertification");
  },
};

export const GuestProfileGatePreview: Story = {
  args: {
    signedInUserId: null,
  },
  render: () => (
    <MobileNavGuestGate destination="profile" onClose={() => undefined} />
  ),
};

export const SignedIn: Story = {
  args: {
    signedInUserId: "member-1",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("link", { name: "홈" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(canvas.getByRole("link", { name: "쿠폰함" })).toHaveAttribute(
      "href",
      "/coupons",
    );
    await expect(canvas.getByRole("link", { name: "내 정보" })).toHaveAttribute(
      "href",
      "/certification",
    );
  },
};

export const RouteLoading: Story = {
  args: {
    signedInUserId: "member-1",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("navigation", { name: "모바일 주요 탐색" }),
    ).toBeVisible();
    await expect(canvas.getByRole("link", { name: "쿠폰함" })).toHaveAttribute(
      "href",
      "/coupons",
    );
  },
};

export const SettingsActive: Story = {
  args: {
    signedInUserId: "member-1",
  },
  parameters: {
    nextjs: {
      navigation: { pathname: "/settings" },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("link", { name: "내 정보" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  },
};

export const HomeSearchFocus: Story = {
  args: {
    signedInUserId: "member-1",
  },
  decorators: [
    (Story) => (
      <div className="min-h-[36rem] bg-background px-4 py-8">
        <label className="grid gap-2 text-sm font-semibold text-foreground">
          검색
          <input
            data-testid="partner-search-input"
            className="h-11 rounded-control border border-border bg-surface-control px-3"
          />
        </label>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const searchInput = canvas.getByTestId("partner-search-input");
    searchInput.scrollIntoView = () => undefined;
    await userEvent.click(canvas.getByRole("link", { name: "혜택 검색" }));
    await waitFor(() => expect(searchInput).toHaveFocus());
  },
};
