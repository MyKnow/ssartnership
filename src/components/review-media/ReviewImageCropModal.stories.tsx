import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fireEvent, fn, userEvent, within } from "storybook/test";
import ReviewImageCropModal from "./ReviewImageCropModal";

const sourceUrl = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
    <rect width="800" height="600" fill="#ecfeff"/>
    <circle cx="400" cy="300" r="180" fill="#06b6d4"/>
  </svg>`,
)}`;

const meta = {
  title: "Domains/ReviewMedia/ReviewImageCropModal",
  component: ReviewImageCropModal,
  args: {
    open: true,
    sourceUrl,
    outputName: "review-1.webp",
    onCancel: fn(),
    onApply: fn(),
  },
} satisfies Meta<typeof ReviewImageCropModal>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Open: Story = {
  play: async ({ args }) => {
    const body = within(document.body);
    await expect(await body.findByText("사진 조정")).toBeInTheDocument();
    await userEvent.click(body.getByRole("button", { name: "취소" }));
    await expect(args.onCancel).toHaveBeenCalled();
  },
};

export const ImageLoadError: Story = {
  args: {
    sourceUrl: "data:image/svg+xml;utf8,broken",
  },
  play: async () => {
    const body = within(document.body);
    await expect(await body.findByText("사진 조정")).toBeInTheDocument();
    await expect(await body.findByText("이미지를 불러올 수 없습니다. 다른 파일을 선택해 주세요.")).toBeInTheDocument();
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
      await expect(await body.findByText("사진 조정")).toBeInTheDocument();

      const slider = await body.findByRole("slider");
      fireEvent.input(slider, { target: { value: "2" } });
      fireEvent.change(slider, { target: { value: "2" } });

      const frame = body.getByText("드래그와 확대만 조정하세요.").closest("div")?.previousElementSibling;
      if (frame instanceof HTMLElement) {
        await userEvent.pointer([
          { target: frame, coords: { x: 120, y: 120 }, keys: "[MouseLeft>]" },
          { target: frame, coords: { x: 160, y: 170 } },
          { target: frame, keys: "[/MouseLeft]" },
        ]);
      }

      await userEvent.click(body.getByRole("button", { name: "적용" }));
      await expect(args.onApply).toHaveBeenCalled();
    } finally {
      HTMLCanvasElement.prototype.toBlob = originalToBlob;
    }
  },
};
