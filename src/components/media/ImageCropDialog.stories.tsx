import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fireEvent, fn, userEvent, waitFor, within } from "storybook/test";
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
    title: "대표 이미지",
    subtitle: "카드 목록에서 보일 1:1 이미지입니다.",
    aspectRatio: 1,
    sourceUrl,
    outputName: "partner-thumbnail.webp",
    outputWidth: 1200,
    outputHeight: 1200,
    queueCount: 1,
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
    await expect(await body.findByText("대표 이미지")).toBeInTheDocument();
    await expect(body.getByText("저장 형식")).toBeInTheDocument();
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
    await expect(await body.findByText("대표 이미지")).toBeInTheDocument();
  },
};

export const QueuedGalleryImage: Story = {
  args: {
    title: "추가 이미지",
    subtitle: "상세 페이지에서 보일 4:3 이미지입니다.",
    aspectRatio: 4 / 3,
    outputName: "partner-gallery.webp",
    outputWidth: 1600,
    outputHeight: 1200,
    queueCount: 3,
  },
  play: async () => {
    const body = within(document.body);
    await expect(await body.findByText("추가 이미지")).toBeInTheDocument();
    await expect(body.getByText("여러 이미지를 순차 처리 중입니다. 남은 이미지 3개")).toBeInTheDocument();
  },
};

export const ImageLoadError: Story = {
  args: {
    sourceUrl: "data:image/svg+xml;utf8,broken",
  },
  play: async () => {
    const body = within(document.body);
    await expect(await body.findByText("대표 이미지")).toBeInTheDocument();
    await expect(await body.findByText("이미지를 불러올 수 없습니다. 다른 파일을 선택해 주세요.")).toBeInTheDocument();
  },
};

export const ReplacementValidationError: Story = {
  args: {
    validateFile: (file) =>
      file.type.startsWith("image/") ? null : "이미지 파일만 업로드할 수 있습니다.",
  },
  play: async () => {
    const body = within(document.body);
    await expect(await body.findByText("대표 이미지")).toBeInTheDocument();
    const input = document.body.querySelector<HTMLInputElement>('input[type="file"]');
    await expect(input).not.toBeNull();
    await userEvent.upload(input!, new File(["memo"], "memo.txt", { type: "text/plain" }), {
      applyAccept: false,
    });
    await expect(await body.findByText("이미지 파일만 업로드할 수 있습니다.")).toBeInTheDocument();
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
      await expect(await body.findByText("대표 이미지")).toBeInTheDocument();

      const slider = await body.findByRole("slider");
      fireEvent.input(slider, { target: { value: "1.4" } });
      fireEvent.change(slider, { target: { value: "1.4" } });

      await waitFor(() => {
        expect(document.body.querySelector(".reactEasyCrop_Container")).not.toBeNull();
      });
      await userEvent.click(body.getByRole("button", { name: "적용" }));
      await expect(args.onApply).toHaveBeenCalled();
    } finally {
      HTMLCanvasElement.prototype.toBlob = originalToBlob;
    }
  },
};
