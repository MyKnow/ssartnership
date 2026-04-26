import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import {
  appendPartnerReviewList,
  buildReviewFormData,
  formatPartnerReviewDate,
  getPartnerReviewRatingLabel,
  getPartnerReviewRatingOptions,
} from "./helpers";

function PartnerReviewHelpersPreview() {
  const existingItem = {
    id: "existing-1",
    kind: "existing" as const,
    url: "https://example.com/review.webp",
  };
  const file = new File(["image"], "review.png", { type: "image/png" });
  const fileItem = {
    id: "file-1",
    kind: "file" as const,
    url: "blob:review",
    file,
  };
  const formData = buildReviewFormData({
    rating: 5,
    title: "좋아요",
    body: "재방문 의사 있습니다.",
    items: [existingItem, fileItem],
  });
  const merged = appendPartnerReviewList(
    [
      { id: "review-1" },
      { id: "review-2" },
    ] as never,
    [
      { id: "review-2" },
      { id: "review-3" },
    ] as never,
  );

  return (
    <div className="space-y-2 text-sm text-foreground">
      <div>formatted-valid:{formatPartnerReviewDate("2026-04-25T12:34:56.000Z")}</div>
      <div>formatted-invalid:{formatPartnerReviewDate("not-a-date")}</div>
      <div>rating-label:{getPartnerReviewRatingLabel("5")}</div>
      <div>rating-options:{getPartnerReviewRatingOptions().length}</div>
      <div>form-rating:{formData.get("rating")}</div>
      <div>form-title:{formData.get("title")}</div>
      <div>form-body:{formData.get("body")}</div>
      <div>form-manifest:{String(formData.get("imagesManifest"))}</div>
      <div>form-file-count:{formData.getAll("imageFiles").length}</div>
      <div>form-file-name:{(formData.getAll("imageFiles")[0] as File)?.name ?? "none"}</div>
      <div>merged:{merged.map((item) => item.id).join(",")}</div>
    </div>
  );
}

const meta = {
  title: "Domains/PartnerReviews/Helpers",
  component: PartnerReviewHelpersPreview,
} satisfies Meta<typeof PartnerReviewHelpersPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Summary: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("formatted-valid:2026. 4. 25.")).toBeInTheDocument();
    await expect(canvas.getByText("formatted-invalid:")).toBeInTheDocument();
    await expect(canvas.getByText("rating-label:5점")).toBeInTheDocument();
    await expect(canvas.getByText("rating-options:6")).toBeInTheDocument();
    await expect(canvas.getByText("form-rating:5")).toBeInTheDocument();
    await expect(canvas.getByText("form-title:좋아요")).toBeInTheDocument();
    await expect(canvas.getByText("form-body:재방문 의사 있습니다.")).toBeInTheDocument();
    await expect(
      canvas.getByText(
        'form-manifest:{"images":[{"kind":"existing","url":"https://example.com/review.webp"},{"kind":"upload"}]}',
      ),
    ).toBeInTheDocument();
    await expect(canvas.getByText("form-file-count:1")).toBeInTheDocument();
    await expect(canvas.getByText("form-file-name:review.png")).toBeInTheDocument();
    await expect(canvas.getByText("merged:review-1,review-2,review-3")).toBeInTheDocument();
  },
};
