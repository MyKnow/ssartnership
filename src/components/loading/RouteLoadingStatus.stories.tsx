import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";
import { CertificationPageSkeleton } from "@/components/loading/SitePageSkeletons";

function SiteRouteLoading() {
  return (
    <>
      <RouteLoadingStatus />
      <CertificationPageSkeleton />
    </>
  );
}

const meta = {
  title: "Loading/RouteLoadingStatus",
  component: SiteRouteLoading,
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "mobile1" },
  },
} satisfies Meta<typeof SiteRouteLoading>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SingleAnnouncement: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const statuses = canvas.getAllByRole("status");
    await expect(statuses).toHaveLength(1);
    await expect(statuses[0]).toHaveTextContent("화면을 불러오는 중입니다.");
    await expect(statuses[0]).toHaveClass("sr-only");
  },
};
