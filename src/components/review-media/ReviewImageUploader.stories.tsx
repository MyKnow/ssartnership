import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import ReviewImageUploader from "./ReviewImageUploader";
import type { ReviewImageItem } from "./shared";

const demoImage = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640">
    <rect width="640" height="640" fill="#e0f2fe"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#0f766e" font-size="44" font-family="sans-serif">Review</text>
  </svg>`,
)}`;

function StatefulUploader({
  initialItems,
  onChange,
  error,
  disabled,
}: {
  initialItems: ReviewImageItem[];
  onChange: (nextItems: ReviewImageItem[]) => void;
  error?: string | null;
  disabled?: boolean;
}) {
  const [items, setItems] = useState(initialItems);

  return (
    <ReviewImageUploader
      items={items}
      onChange={(nextItems) => {
        setItems(nextItems);
        onChange(nextItems);
      }}
      error={error}
      disabled={disabled}
    />
  );
}

const meta = {
  title: "Domains/ReviewMedia/ReviewImageUploader",
  component: StatefulUploader,
  args: {
    initialItems: [],
    onChange: fn(),
    error: null,
    disabled: false,
  },
} satisfies Meta<typeof StatefulUploader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("선택 사항")).toBeInTheDocument();

    const fileInput = canvasElement.querySelector<HTMLInputElement>('input[type="file"]');
    await expect(fileInput).not.toBeNull();
    await userEvent.upload(fileInput!, new File(["not image"], "notes.txt", { type: "text/plain" }), {
      applyAccept: false,
    });
    await expect(await canvas.findByText("이미지 파일만 최대 5장까지 업로드할 수 있습니다.")).toBeInTheDocument();
    await expect(args.onChange).not.toHaveBeenCalled();
  },
};

export const WithExistingImages: Story = {
  args: {
    initialItems: [
      {
        id: "existing-1",
        kind: "existing",
        url: demoImage,
      },
    ],
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByAltText("리뷰 사진 1")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "리뷰 사진 제거" }));
    await expect(args.onChange).toHaveBeenCalledWith([]);
    await expect(canvas.getByText("선택 사항")).toBeInTheDocument();
  },
};

export const DisabledWithError: Story = {
  args: {
    disabled: true,
    error: "사진은 최대 5장까지 등록할 수 있습니다.",
    initialItems: [
      {
        id: "existing-1",
        kind: "existing",
        url: demoImage,
      },
    ],
  },
};

export const UploadAndCancelCrop: Story = {
  play: async ({ canvasElement, args }) => {
    const fileInput = canvasElement.querySelector<HTMLInputElement>('input[type="file"]');
    await expect(fileInput).not.toBeNull();

    await userEvent.upload(
      fileInput!,
      new File(
        [
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#bae6fd"/></svg>`,
        ],
        "photo.svg",
        { type: "image/svg+xml" },
      ),
    );

    const body = within(document.body);
    await expect(await body.findByText("사진 조정")).toBeInTheDocument();
    await userEvent.click(body.getByRole("button", { name: "취소" }));
    await expect(body.queryByText("사진 조정")).not.toBeInTheDocument();
    await expect(args.onChange).not.toHaveBeenCalled();
  },
};

export const UploadAndApplyCrop: Story = {
  play: async ({ canvasElement, args }) => {
    const originalToBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function toBlob(callback) {
      callback(new Blob(["image"], { type: "image/webp" }));
    };

    try {
      const fileInput = canvasElement.querySelector<HTMLInputElement>('input[type="file"]');
      await expect(fileInput).not.toBeNull();

      await userEvent.upload(
        fileInput!,
        new File(
          [
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><circle cx="60" cy="60" r="48" fill="#38bdf8"/></svg>`,
          ],
          "apply.svg",
          { type: "image/svg+xml" },
        ),
      );

      const body = within(document.body);
      await expect(await body.findByText("사진 조정")).toBeInTheDocument();
      await userEvent.click(body.getByRole("button", { name: "적용" }));
      await expect(args.onChange).toHaveBeenCalled();
      await expect(
        await within(canvasElement).findByAltText("리뷰 사진 1"),
      ).toBeInTheDocument();
    } finally {
      HTMLCanvasElement.prototype.toBlob = originalToBlob;
    }
  },
};
