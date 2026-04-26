import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import {
  extractReviewMediaStoragePath,
  parseReviewMediaManifest,
  REVIEW_IMAGE_ASPECT_RATIO,
  REVIEW_MEDIA_BUCKET,
} from "./review-media";

function ReviewMediaHelpersPreview() {
  const parsed = parseReviewMediaManifest(
    JSON.stringify({
      images: [
        { kind: "existing", url: "https://example.com/review.webp" },
        { kind: "upload" },
      ],
    }),
  );
  const invalidJson = parseReviewMediaManifest("{invalid");
  const invalidEntry = parseReviewMediaManifest(
    JSON.stringify({
      images: [{ kind: "existing", url: "javascript:alert(1)" }],
    }),
  );
  const extracted = extractReviewMediaStoragePath(
    "https://project.supabase.co/storage/v1/object/public/review-media/path%20to/file.webp",
  );
  const invalidExtract = extractReviewMediaStoragePath("https://example.com/nope");

  return (
    <div className="space-y-2 text-sm text-foreground">
      <div>bucket:{REVIEW_MEDIA_BUCKET}</div>
      <div>aspect:{REVIEW_IMAGE_ASPECT_RATIO}</div>
      <div>parsed-count:{parsed?.images.length ?? 0}</div>
      <div>parsed-first:{parsed?.images[0]?.kind ?? "none"}</div>
      <div>parsed-second:{parsed?.images[1]?.kind ?? "none"}</div>
      <div>invalid-json:{String(invalidJson)}</div>
      <div>invalid-entry:{String(invalidEntry)}</div>
      <div>extract-bucket:{extracted?.bucket ?? "none"}</div>
      <div>extract-path:{extracted?.path ?? "none"}</div>
      <div>extract-invalid:{String(invalidExtract)}</div>
    </div>
  );
}

const meta = {
  title: "Domains/Lib/ReviewMedia",
  component: ReviewMediaHelpersPreview,
} satisfies Meta<typeof ReviewMediaHelpersPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Summary: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("bucket:review-media")).toBeInTheDocument();
    await expect(canvas.getByText("aspect:1")).toBeInTheDocument();
    await expect(canvas.getByText("parsed-count:2")).toBeInTheDocument();
    await expect(canvas.getByText("parsed-first:existing")).toBeInTheDocument();
    await expect(canvas.getByText("parsed-second:upload")).toBeInTheDocument();
    await expect(canvas.getByText("invalid-json:null")).toBeInTheDocument();
    await expect(canvas.getByText("invalid-entry:null")).toBeInTheDocument();
    await expect(canvas.getByText("extract-bucket:review-media")).toBeInTheDocument();
    await expect(canvas.getByText("extract-path:path to/file.webp")).toBeInTheDocument();
    await expect(canvas.getByText("extract-invalid:null")).toBeInTheDocument();
  },
};
