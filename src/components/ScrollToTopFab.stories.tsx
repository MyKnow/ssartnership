import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fireEvent, userEvent, within } from "storybook/test";
import ScrollToTopFab from "./ScrollToTopFab";

const meta = {
  title: "Domains/ScrollToTopFab",
  component: ScrollToTopFab,
  args: {
    threshold: 120,
  },
  decorators: [
    (Story) => (
      <div className="min-h-[1200px] bg-background">
        <div className="h-[1000px] p-6 text-sm text-muted-foreground">스크롤 테스트 영역</div>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ScrollToTopFab>;

export default meta;

type Story = StoryObj<typeof meta>;

export const VisibleAndScroll: Story = {
  play: async ({ canvasElement }) => {
    const originalScrollTo = window.scrollTo;
    const originalMatchMedia = window.matchMedia;
    const originalRAF = window.requestAnimationFrame;
    let scrollYValue = 500;

    Object.defineProperty(window, "scrollY", {
      configurable: true,
      get: () => scrollYValue,
    });
    window.matchMedia = ((query: string) =>
      ({
        matches: query === "(prefers-reduced-motion: reduce)" ? false : false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }) as MediaQueryList);
    window.scrollTo = ((x: number | ScrollToOptions, y?: number) => {
      if (typeof x === "number") {
        scrollYValue = y ?? 0;
        return;
      }
      scrollYValue = typeof x.top === "number" ? x.top : 0;
    }) as typeof window.scrollTo;
    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      callback(window.performance.now() + 400);
      return 1;
    }) as typeof window.requestAnimationFrame;

    fireEvent.scroll(window);
    const canvas = within(canvasElement);
    const button = await canvas.findByRole("button", { name: "맨 위로 이동" });
    await expect(button).toBeInTheDocument();

    await userEvent.click(button);
    await expect(scrollYValue).toBe(0);

    window.scrollTo = originalScrollTo;
    window.matchMedia = originalMatchMedia;
    window.requestAnimationFrame = originalRAF;
  },
};

export const ReducedMotion: Story = {
  play: async ({ canvasElement }) => {
    const originalScrollTo = window.scrollTo;
    const originalMatchMedia = window.matchMedia;
    let scrollYValue = 300;

    Object.defineProperty(window, "scrollY", {
      configurable: true,
      get: () => scrollYValue,
    });
    window.matchMedia = ((query: string) =>
      ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }) as MediaQueryList);
    window.scrollTo = ((x: number | ScrollToOptions, y?: number) => {
      if (typeof x === "number") {
        scrollYValue = y ?? 0;
        return;
      }
      scrollYValue = typeof x.top === "number" ? x.top : 0;
    }) as typeof window.scrollTo;

    fireEvent.scroll(window);
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "맨 위로 이동" }));
    await expect(scrollYValue).toBe(0);

    window.scrollTo = originalScrollTo;
    window.matchMedia = originalMatchMedia;
  },
};

export const NoScrollNoop: Story = {
  play: async ({ canvasElement }) => {
    const originalScrollTo = window.scrollTo;
    let scrollYValue = 0;

    Object.defineProperty(window, "scrollY", {
      configurable: true,
      get: () => scrollYValue,
    });
    window.scrollTo = ((x: number | ScrollToOptions, y?: number) => {
      if (typeof x === "number") {
        scrollYValue = y ?? 0;
        return;
      }
      scrollYValue = typeof x.top === "number" ? x.top : 0;
    }) as typeof window.scrollTo;

    fireEvent.scroll(window);
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "맨 위로 이동" }));
    await expect(scrollYValue).toBe(0);

    window.scrollTo = originalScrollTo;
  },
};
