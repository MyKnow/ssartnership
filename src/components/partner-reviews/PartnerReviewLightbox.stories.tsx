"use client";

import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fireEvent, userEvent, within } from "storybook/test";
import PartnerReviewLightbox from "./PartnerReviewLightbox";

const reviewImageA = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 720">
    <rect width="960" height="720" fill="#fef3c7"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#b45309" font-size="56" font-family="sans-serif">Review A</text>
  </svg>`,
)}`;

const reviewImageB = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 720">
    <rect width="960" height="720" fill="#dcfce7"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#15803d" font-size="56" font-family="sans-serif">Review B</text>
  </svg>`,
)}`;

function StatefulPartnerReviewLightbox() {
  const [open, setOpen] = useState(true);
  const [initialIndex, setInitialIndex] = useState(2);

  return (
    <div className="min-h-[12rem]">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setInitialIndex(1);
            setOpen(true);
          }}
        >
          두번째로 열기
        </button>
        <button
          type="button"
          onClick={() => {
            setInitialIndex(0);
            setOpen(true);
          }}
        >
          첫번째로 열기
        </button>
      </div>
      {open ? (
        <PartnerReviewLightbox
          images={[reviewImageA, reviewImageB]}
          initialIndex={initialIndex}
          onClose={() => setOpen(false)}
        />
      ) : (
        <div className="mt-3 text-sm text-muted-foreground">closed</div>
      )}
    </div>
  );
}

const meta = {
  title: "Domains/PartnerReviews/PartnerReviewLightbox",
  component: StatefulPartnerReviewLightbox,
} satisfies Meta<typeof StatefulPartnerReviewLightbox>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Interactive: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(document.body);

    const image = body.getByAltText("리뷰 사진");
    await expect(image).toBeInTheDocument();

    await userEvent.click(body.getByRole("button", { name: "다음 사진" }));
    await expect(image).toHaveAttribute("src", expect.stringContaining("Review%20B"));

    await userEvent.click(body.getByRole("button", { name: "이전 사진" }));
    await expect(image).toHaveAttribute("src", expect.stringContaining("Review%20A"));

    const surface = image.closest("div");
    await expect(surface).not.toBeNull();
    fireEvent.wheel(surface!, { deltaY: -120 });
    await userEvent.dblClick(image);
    fireEvent.mouseDown(surface!, { clientX: 10, clientY: 20 });
    fireEvent.mouseMove(surface!, { clientX: 35, clientY: 55 });
    fireEvent.mouseUp(surface!);

    await userEvent.click(body.getByRole("button", { name: "닫기" }));
    await expect(canvas.getByText("closed")).toBeInTheDocument();

    await userEvent.click(canvas.getByRole("button", { name: "두번째로 열기" }));
    await expect(body.getByAltText("리뷰 사진")).toHaveAttribute(
      "src",
      expect.stringContaining("Review%20B"),
    );

    await userEvent.click(canvas.getByRole("button", { name: "첫번째로 열기" }));
    await expect(body.getByAltText("리뷰 사진")).toHaveAttribute(
      "src",
      expect.stringContaining("Review%20A"),
    );
  },
};
