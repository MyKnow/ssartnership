import { useEffect } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { useCarouselController } from "./useCarouselController";

const demoImageA = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 150">
    <rect width="200" height="150" fill="#dbeafe"/>
    <text x="100" y="75" dominant-baseline="middle" text-anchor="middle" fill="#1d4ed8">A</text>
  </svg>`,
)}`;

const demoImageB = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 150">
    <rect width="200" height="150" fill="#bae6fd"/>
    <text x="100" y="75" dominant-baseline="middle" text-anchor="middle" fill="#0369a1">B</text>
  </svg>`,
)}`;

function installDesktopEnvironment() {
  const originalMatchMedia = window.matchMedia;
  const OriginalResizeObserver = window.ResizeObserver;

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({
      matches: query.includes("min-width: 1280px"),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });

  class MockResizeObserver {
    callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    observe() {
      this.callback([], this as never);
    }
    disconnect() {}
    unobserve() {}
  }

  Object.defineProperty(window, "ResizeObserver", {
    configurable: true,
    value: MockResizeObserver,
  });

  return () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: originalMatchMedia,
    });
    Object.defineProperty(window, "ResizeObserver", {
      configurable: true,
      value: OriginalResizeObserver,
    });
  };
}

function CarouselControllerHarness({
  images,
  matchHeightSelector,
}: {
  images: string[];
  matchHeightSelector?: string;
}) {
  const {
    hasImages,
    imageCount,
    activeIndex,
    activeImage,
    canNavigate,
    rootRef,
    activeThumbRef,
    thumbStripRef,
    thumbPlacement,
    isPreloaded,
    isOpen,
    zoom,
    offset,
    setOpen,
    handleZoom,
    handlePanStart,
    handlePanMove,
    handlePanEnd,
    activateImage,
    goNext,
    goPrev,
    resetInteractiveState,
  } = useCarouselController({ images, matchHeightSelector });

  useEffect(() => {
    if (rootRef.current) {
      Object.defineProperty(rootRef.current, "getBoundingClientRect", {
        configurable: true,
        value: () => ({
          width: 900,
          height: 600,
          top: 0,
          left: 0,
          right: 900,
          bottom: 600,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }),
      });
    }
  });

  return (
    <div className="space-y-3 text-sm text-foreground">
      <div
        id="match-height-target"
        style={{ height: 900 }}
      />
      <div ref={rootRef} className="rounded border p-3">
        <button
          ref={activeThumbRef}
          type="button"
          onClick={() => activateImage(1)}
        >
          thumb
        </button>
        <div ref={thumbStripRef} />
      </div>
      <div>has-images:{String(hasImages)}</div>
      <div>image-count:{imageCount}</div>
      <div>active-index:{activeIndex}</div>
      <div>active-image:{activeImage || "none"}</div>
      <div>can-navigate:{String(canNavigate)}</div>
      <div>thumb-placement:{thumbPlacement}</div>
      <div>preloaded:{String(isPreloaded)}</div>
      <div>open:{String(isOpen)}</div>
      <div>zoom:{zoom}</div>
      <div>offset:{`${offset.x},${offset.y}`}</div>
      <button type="button" onClick={() => setOpen(true)}>
        open
      </button>
      <button type="button" onClick={goNext}>
        next
      </button>
      <button type="button" onClick={goPrev}>
        prev
      </button>
      <button type="button" onClick={() => activateImage(99)}>
        activate-99
      </button>
      <button type="button" onClick={() => handleZoom(2)}>
        zoom-2
      </button>
      <button type="button" onClick={() => handleZoom(99)}>
        zoom-max
      </button>
      <button
        type="button"
        onClick={() => {
          handlePanStart(10, 20);
          handlePanMove(50, 70);
          handlePanEnd();
        }}
      >
        pan
      </button>
      <button type="button" onClick={resetInteractiveState}>
        reset
      </button>
    </div>
  );
}

const meta = {
  title: "Domains/PartnerImageCarousel/UseCarouselController",
  component: CarouselControllerHarness,
  decorators: [
    (Story) => {
      const restore = installDesktopEnvironment();
      try {
        return <Story />;
      } finally {
        queueMicrotask(restore);
      }
    },
  ],
} satisfies Meta<typeof CarouselControllerHarness>;

export default meta;

type Story = StoryObj<typeof meta>;

export const MultiImage: Story = {
  args: {
    images: [demoImageA, demoImageB],
    matchHeightSelector: "#match-height-target",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("has-images:true")).toBeInTheDocument();
    await expect(canvas.getByText("image-count:2")).toBeInTheDocument();
    await waitFor(() => {
      expect(canvas.getByText("preloaded:true")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(canvas.getByText(/thumb-placement:(bottom|side)/)).toBeInTheDocument();
    });
    await userEvent.click(canvas.getByRole("button", { name: "next" }));
    await expect(canvas.getByText("active-index:1")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "prev" }));
    await expect(canvas.getByText("active-index:0")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "activate-99" }));
    await expect(canvas.getByText("active-index:1")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "zoom-2" }));
    await expect(canvas.getByText("zoom:2")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "zoom-max" }));
    await expect(canvas.getByText("zoom:4")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "pan" }));
    await expect(canvas.getByText("offset:40,50")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "reset" }));
    await expect(canvas.getByText("zoom:1")).toBeInTheDocument();
    await expect(canvas.getByText("offset:0,0")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "open" }));
    await expect(canvas.getByText("open:true")).toBeInTheDocument();
    await waitFor(() => {
      expect(document.body.style.overflow).toBe("hidden");
      expect(document.body.style.touchAction).toBe("none");
    });
  },
};

export const EmptyState: Story = {
  args: {
    images: [],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("has-images:false")).toBeInTheDocument();
    await expect(canvas.getByText("image-count:0")).toBeInTheDocument();
    await expect(canvas.getByText("active-image:none")).toBeInTheDocument();
    await expect(canvas.getByText("can-navigate:false")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "activate-99" }));
    await expect(canvas.getByText("active-index:0")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "pan" }));
    await expect(canvas.getByText("offset:0,0")).toBeInTheDocument();
  },
};
