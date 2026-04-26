import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";
import LightboxModal from "./LightboxModal";
import type { CarouselOffset } from "./types";

const demoImageA = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 720">
    <rect width="960" height="720" fill="#dbeafe"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#1d4ed8" font-size="56" font-family="sans-serif">Lightbox A</text>
  </svg>`,
)}`;

const demoImageB = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 720">
    <rect width="960" height="720" fill="#e0f2fe"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#0f766e" font-size="56" font-family="sans-serif">Lightbox B</text>
  </svg>`,
)}`;

function StatefulLightbox({
  images,
  initialOpen = true,
}: {
  images: string[];
  initialOpen?: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);
  const [activeIndex, setActiveIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<CarouselOffset>({ x: 0, y: 0 });
  const [panOrigin, setPanOrigin] = useState<CarouselOffset>({ x: 0, y: 0 });

  const activeImage = images[activeIndex] ?? "";
  const canNavigate = images.length > 1;

  return (
    <div className="min-h-[24rem]">
      <LightboxModal
        open={open}
        canNavigate={canNavigate}
        activeImage={activeImage}
        name="라이트박스 미리보기"
        zoom={zoom}
        offset={offset}
        onClose={() => setOpen(false)}
        onPrev={() => setActiveIndex((prev) => (prev - 1 + images.length) % images.length)}
        onNext={() => setActiveIndex((prev) => (prev + 1) % images.length)}
        onZoomChange={(value) =>
          setZoom((prev) => (typeof value === "function" ? value(prev) : value))
        }
        onOffsetChange={setOffset}
        onPanStart={(x, y) => setPanOrigin({ x, y })}
        onPanMove={(x, y) => {
          setOffset({ x: x - panOrigin.x, y: y - panOrigin.y });
        }}
        onPanEnd={() => undefined}
        fallback={<div>이미지가 없습니다.</div>}
      />
      <div className="mt-3 text-sm text-muted-foreground">
        zoom:{zoom.toFixed(1)} / offset:{offset.x},{offset.y} / active:{activeIndex}
      </div>
    </div>
  );
}

const meta = {
  title: "Domains/PartnerImageCarousel/LightboxModal",
  component: StatefulLightbox,
  args: {
    images: [demoImageA, demoImageB],
    initialOpen: true,
  },
} satisfies Meta<typeof StatefulLightbox>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Interactive: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(document.body);

    await expect(body.getByRole("button", { name: "닫기" })).toBeInTheDocument();
    await userEvent.click(body.getByRole("button", { name: "다음 사진" }));
    await expect(canvas.getByText(/active:1/)).toBeInTheDocument();
    await userEvent.click(body.getByRole("button", { name: "이전 사진" }));
    await expect(canvas.getByText(/active:0/)).toBeInTheDocument();

    const surface = body.getByAltText("라이트박스 미리보기").closest("div");
    await expect(surface).not.toBeNull();
    fireEvent.wheel(surface!, { deltaY: -120 });
    await waitFor(() => expect(canvas.getByText(/zoom:1\.1/)).toBeInTheDocument());
    fireEvent.wheel(surface!, { deltaY: 120 });
    await waitFor(() => expect(canvas.getByText(/zoom:1\.0/)).toBeInTheDocument());
    await userEvent.dblClick(body.getByAltText("라이트박스 미리보기"));
    await waitFor(() => expect(canvas.getByText(/zoom:2\.0/)).toBeInTheDocument());

    fireEvent.mouseDown(surface!, { clientX: 10, clientY: 20 });
    fireEvent.mouseMove(surface!, { clientX: 30, clientY: 55 });
    fireEvent.mouseUp(surface!);
    await expect(body.getByAltText("라이트박스 미리보기")).toBeInTheDocument();
    fireEvent.mouseDown(surface!, { clientX: 20, clientY: 20 });
    fireEvent.mouseLeave(surface!);

    await userEvent.click(body.getByRole("button", { name: "닫기" }));
    await expect(body.queryByRole("button", { name: "닫기" })).not.toBeInTheDocument();
  },
};

export const Fallback: Story = {
  args: {
    images: [],
    initialOpen: true,
  },
  play: async () => {
    await expect(within(document.body).getByText("이미지가 없습니다.")).toBeInTheDocument();
  },
};

export const TouchInteractions: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(document.body);
    const surface = body.getByAltText("라이트박스 미리보기").closest("div");
    await expect(surface).not.toBeNull();
    const makeTouch = (identifier: number, clientX: number, clientY: number) =>
      new Touch({
        identifier,
        target: surface!,
        clientX,
        clientY,
      });

    fireEvent.touchStart(surface!, {
      touches: [makeTouch(1, 10, 20)],
    });
    fireEvent.touchMove(surface!, {
      touches: [makeTouch(1, 35, 65)],
    });
    fireEvent.touchEnd(surface!, {
      touches: [],
    });
    await expect(body.getByAltText("라이트박스 미리보기")).toBeInTheDocument();

    fireEvent.touchStart(surface!, {
      touches: [
        makeTouch(1, 0, 0),
        makeTouch(2, 30, 0),
      ],
    });
    fireEvent.touchMove(surface!, {
      touches: [
        makeTouch(1, 0, 0),
        makeTouch(2, 90, 0),
      ],
    });
    await waitFor(() => expect(canvas.getByText(/zoom:3\.0/)).toBeInTheDocument());

    fireEvent.touchStart(surface!, {
      touches: [
        makeTouch(1, 10, 10),
        makeTouch(2, 10, 10),
      ],
    });
    fireEvent.touchMove(surface!, {
      touches: [
        makeTouch(1, 10, 10),
        makeTouch(2, 10, 10),
      ],
    });
    await waitFor(() => expect(canvas.getByText(/zoom:3\.0/)).toBeInTheDocument());

    fireEvent.touchEnd(surface!, {
      touches: [],
    });
    fireEvent.touchEnd(surface!, {
      touches: [],
    });
    await waitFor(() => expect(canvas.getByText(/zoom:1\.0/)).toBeInTheDocument());
  },
};
