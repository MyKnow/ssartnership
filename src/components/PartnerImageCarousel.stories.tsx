import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import PartnerImageCarousel from "./PartnerImageCarousel";

const demoImageA = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 720">
    <rect width="960" height="720" fill="#dbeafe"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#1d4ed8" font-size="56" font-family="sans-serif">Image A</text>
  </svg>`,
)}`;

const demoImageB = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 720">
    <rect width="960" height="720" fill="#e0f2fe"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#0f766e" font-size="56" font-family="sans-serif">Image B</text>
  </svg>`,
)}`;

const meta = {
  title: "Domains/PartnerImageCarousel",
  component: PartnerImageCarousel,
  args: {
    name: "역삼 캠퍼스 샐러드 바",
    images: [],
  },
} satisfies Meta<typeof PartnerImageCarousel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const WithImages: Story = {
  args: {
    images: [demoImageA, demoImageB, demoImageA],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(document.body);

    await userEvent.click(await canvas.findByRole("button", { name: "이미지 2" }));
    await userEvent.click(
      await canvas.findByRole("button", {
        name: "역삼 캠퍼스 샐러드 바 이미지 크게 보기",
      }),
    );

    await expect(await body.findByRole("button", { name: "닫기" })).toBeInTheDocument();
    await userEvent.click(body.getByRole("button", { name: "다음 사진" }));
    await userEvent.click(body.getByRole("button", { name: "이전 사진" }));

    await waitFor(() => {
      expect(body.getAllByAltText("역삼 캠퍼스 샐러드 바").length).toBeGreaterThan(1);
    });
    await userEvent.dblClick(body.getAllByAltText("역삼 캠퍼스 샐러드 바")[1]!);
    await userEvent.click(body.getByRole("button", { name: "닫기" }));
    await expect(body.queryByRole("button", { name: "닫기" })).not.toBeInTheDocument();
  },
};
