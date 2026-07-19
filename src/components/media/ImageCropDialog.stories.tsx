import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import ImageCropDialog from "./ImageCropDialog";

const sourceUrl = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
    <rect width="1200" height="900" fill="#e0f2fe"/>
    <rect x="120" y="120" width="960" height="660" rx="48" fill="#f8fafc"/>
    <circle cx="430" cy="450" r="180" fill="#2563eb"/>
    <rect x="650" y="300" width="280" height="260" rx="36" fill="#14b8a6"/>
    <text x="600" y="750" text-anchor="middle" fill="#0f172a" font-size="72" font-family="sans-serif">카페 싸피</text>
  </svg>`,
)}`;

const meta = {
  title: "Media/ImageCropDialog",
  component: ImageCropDialog,
  args: {
    open: true,
    aspectRatio: 1,
    sourceUrl,
    outputName: "partner-thumbnail.webp",
    outputWidth: 1200,
    outputHeight: 1200,
    onCancel: fn(),
    onApply: fn(),
  },
  parameters: {
    chromatic: {
      viewports: [360, 820, 1366],
    },
  },
} satisfies Meta<typeof ImageCropDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async () => {
    const body = within(document.body);
    await expect(await body.findByText("이미지 편집")).toBeInTheDocument();
    await expect(body.getByTestId("image-crop-frame")).toBeVisible();
    await expect(body.queryByTestId("image-crop-tools")).not.toBeInTheDocument();
  },
};

export const MobileViewport: Story = {
  parameters: {
    chromatic: {
      viewports: [360],
    },
  },
  play: async () => {
    const body = within(document.body);
    await expect(await body.findByText("이미지 편집")).toBeInTheDocument();
  },
};

export const GalleryImage: Story = {
  args: {
    aspectRatio: 4 / 3,
    outputName: "partner-gallery.webp",
    outputWidth: 1600,
    outputHeight: 1200,
  },
  play: async () => {
    const body = within(document.body);
    await expect(await body.findByText("이미지 편집")).toBeInTheDocument();
    await expect(body.getByTestId("image-crop-frame")).toBeVisible();
  },
};

export const PromotionLandscape: Story = {
  args: {
    aspectRatio: 21 / 9,
    outputName: "promotion-slide.webp",
    outputWidth: 2100,
    outputHeight: 900,
  },
  parameters: {
    chromatic: {
      viewports: [360, 820, 1024, 1366],
    },
  },
  play: async () => {
    const body = within(document.body);
    await expect(await body.findByText("이미지 편집")).toBeInTheDocument();
    await expect(body.queryByText("결과 미리보기")).not.toBeInTheDocument();
    await expect(document.body.querySelector('input[type="range"]')).toBeNull();
    await expect(body.queryByTestId("image-crop-tools")).not.toBeInTheDocument();
    await expect(body.queryByRole("button", { name: "초기화" })).not.toBeInTheDocument();
    await expect(body.queryByRole("button", { name: "이미지 변경" })).not.toBeInTheDocument();
    const content = body.getByTestId("image-crop-dialog-content");
    await waitFor(() => {
      expect(content.clientWidth).toBeGreaterThan(0);
      expect(content.scrollWidth).toBeLessThanOrEqual(content.clientWidth);
    });
  },
};

export const ImageLoadError: Story = {
  args: {
    sourceUrl: "data:image/svg+xml;utf8,broken",
  },
  play: async () => {
    const body = within(document.body);
    await expect(await body.findByText("이미지 편집")).toBeInTheDocument();
    await expect(
      await body.findByText("이미지를 불러올 수 없습니다. 팝업을 닫고 다른 파일을 선택해 주세요."),
    ).toBeInTheDocument();
  },
};

export const ApplySuccess: Story = {
  play: async ({ args }) => {
    const originalToBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function toBlob(callback) {
      callback(new Blob(["image"], { type: "image/webp" }));
    };

    try {
      const body = within(document.body);
      await expect(await body.findByText("이미지 편집")).toBeInTheDocument();

      await waitFor(() => {
        expect(document.body.querySelector(".reactEasyCrop_Container")).not.toBeNull();
      });
      await userEvent.click(body.getByRole("button", { name: "적용" }));
      await waitFor(() => expect(args.onApply).toHaveBeenCalled());
    } finally {
      HTMLCanvasElement.prototype.toBlob = originalToBlob;
    }
  },
};
