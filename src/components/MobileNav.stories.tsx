import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import MobileNav from "./MobileNav";

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
    await expect(canvas.getByRole("navigation", { name: "모바일 주요 탐색" })).toBeVisible();
    await expect(canvas.getByRole("link", { name: "혜택 검색" })).toHaveAttribute(
      "href",
      "/#benefit-search",
    );
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
