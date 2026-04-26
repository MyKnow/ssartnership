import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import {
  clampCarouselZoom,
  getDesktopThumbPlacement,
  getTouchDistance,
  normalizeCarouselIndex,
} from "./helpers";

function HelpersPreview() {
  return (
    <div className="space-y-2 text-sm text-foreground">
      <div>clamp-low:{clampCarouselZoom(0.25)}</div>
      <div>clamp-high:{clampCarouselZoom(9)}</div>
      <div>index-empty:{normalizeCarouselIndex(3, 0)}</div>
      <div>index-wrap:{normalizeCarouselIndex(-1, 4)}</div>
      <div>
        placement-side:
        {getDesktopThumbPlacement({
          containerWidth: 0,
          targetHeight: null,
          imageCount: 1,
        })}
      </div>
      <div>
        placement-bottom:
        {getDesktopThumbPlacement({
          containerWidth: 600,
          targetHeight: 500,
          imageCount: 4,
        })}
      </div>
      <div>
        distance:
        {getTouchDistance(
          { clientX: 0, clientY: 0 },
          { clientX: 3, clientY: 4 },
        )}
      </div>
    </div>
  );
}

const meta = {
  title: "Domains/PartnerImageCarousel/Helpers",
  component: HelpersPreview,
} satisfies Meta<typeof HelpersPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Summary: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("clamp-low:1")).toBeInTheDocument();
    await expect(canvas.getByText("clamp-high:4")).toBeInTheDocument();
    await expect(canvas.getByText("index-empty:0")).toBeInTheDocument();
    await expect(canvas.getByText("index-wrap:3")).toBeInTheDocument();
    await expect(canvas.getByText("placement-side:side")).toBeInTheDocument();
    await expect(canvas.getByText("placement-bottom:bottom")).toBeInTheDocument();
    await expect(canvas.getByText("distance:5")).toBeInTheDocument();
  },
};
