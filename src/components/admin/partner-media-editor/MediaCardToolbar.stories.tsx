import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import MediaCardToolbar from "./MediaCardToolbar";

const meta = {
  title: "Domains/Admin/PartnerMediaEditor/MediaCardToolbar",
  component: MediaCardToolbar,
  args: {
    multiple: false,
    allowUrl: true,
    accept: "image/*",
    onAddUrl: fn(() => true),
    onAddUrls: fn(() => true),
    onAddFiles: fn(() => true),
  },
  parameters: {
    chromatic: {
      viewports: [360, 820, 1366],
    },
  },
} satisfies Meta<typeof MediaCardToolbar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const UrlAndImage: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByPlaceholderText("이미지 링크를 붙여넣으세요"), "https://example.com/image.jpg");
    await userEvent.click(canvas.getByRole("button", { name: "추가" }));
    await expect(args.onAddUrl).toHaveBeenCalledWith("https://example.com/image.jpg");
    await expect(canvas.getByRole("button", { name: "이미지 추가" })).toBeInTheDocument();
  },
};

export const FileOnly: Story = {
  args: {
    allowUrl: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("JPG, PNG, WebP, AVIF 파일을 선택하면 구도를 조정한 뒤 저장됩니다.")).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "이미지 추가" })).toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "추가" })).not.toBeInTheDocument();
  },
};

export const MultipleUrls: Story = {
  args: {
    multiple: true,
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByPlaceholderText("이미지 링크를 여러 개 붙여넣으세요. 줄바꿈 또는 | 로 구분합니다."),
      "https://example.com/a.jpg|https://example.com/b.jpg",
    );
    await userEvent.click(canvas.getByRole("button", { name: "추가" }));
    await expect(args.onAddUrls).toHaveBeenCalledWith([
      "https://example.com/a.jpg",
      "https://example.com/b.jpg",
    ]);
  },
};

export const UploadFile: Story = {
  play: async ({ canvasElement, args }) => {
    const input = canvasElement.querySelector<HTMLInputElement>('input[type="file"]');
    await expect(input).not.toBeNull();
    await userEvent.upload(
      input!,
      new File(["image"], "thumbnail.png", { type: "image/png" }),
    );
    await expect(args.onAddFiles).toHaveBeenCalled();
  },
};
