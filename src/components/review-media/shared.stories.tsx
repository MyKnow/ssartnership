import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import {
  buildReviewMediaManifestEntries,
  clamp,
  collectReviewMediaFiles,
  createReviewImageItemFromExisting,
  createReviewImageItemFromFile,
  createWebpFile,
  isImageFile,
} from "./shared";

function ReviewMediaSharedPreview() {
  const pngFile = new File(["img"], "photo.png", { type: "image/png" });
  const unknownImage = new File(["img"], "photo.heic", { type: "" });
  const textFile = new File(["text"], "notes.txt", { type: "text/plain" });
  const webpFile = createWebpFile(new Blob(["img"], { type: "image/webp" }), "cropped.webp");
  const existingItem = createReviewImageItemFromExisting("https://example.com/review.webp");
  const fileItem = createReviewImageItemFromFile(pngFile);
  const manifest = buildReviewMediaManifestEntries([existingItem, fileItem]);
  const files = collectReviewMediaFiles([existingItem, fileItem]);

  return (
    <div className="space-y-2 text-sm text-foreground">
      <div>is-image-png:{String(isImageFile(pngFile))}</div>
      <div>is-image-heic:{String(isImageFile(unknownImage))}</div>
      <div>is-image-text:{String(isImageFile(textFile))}</div>
      <div>clamp-low:{clamp(-1, 0, 5)}</div>
      <div>clamp-high:{clamp(9, 0, 5)}</div>
      <div>webp-name:{webpFile.name}</div>
      <div>webp-type:{webpFile.type}</div>
      <div>existing-kind:{existingItem.kind}</div>
      <div>file-kind:{fileItem.kind}</div>
      <div>manifest:{JSON.stringify(manifest)}</div>
      <div>files-count:{files.length}</div>
      <div>files-name:{files[0]?.name ?? "none"}</div>
    </div>
  );
}

const meta = {
  title: "Domains/ReviewMedia/SharedHelpers",
  component: ReviewMediaSharedPreview,
} satisfies Meta<typeof ReviewMediaSharedPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Summary: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("is-image-png:true")).toBeInTheDocument();
    await expect(canvas.getByText("is-image-heic:true")).toBeInTheDocument();
    await expect(canvas.getByText("is-image-text:false")).toBeInTheDocument();
    await expect(canvas.getByText("clamp-low:0")).toBeInTheDocument();
    await expect(canvas.getByText("clamp-high:5")).toBeInTheDocument();
    await expect(canvas.getByText("webp-name:cropped.webp")).toBeInTheDocument();
    await expect(canvas.getByText("webp-type:image/webp")).toBeInTheDocument();
    await expect(canvas.getByText("existing-kind:existing")).toBeInTheDocument();
    await expect(canvas.getByText("file-kind:file")).toBeInTheDocument();
    await expect(
      canvas.getByText('manifest:[{"kind":"existing","url":"https://example.com/review.webp"},{"kind":"upload"}]'),
    ).toBeInTheDocument();
    await expect(canvas.getByText("files-count:1")).toBeInTheDocument();
    await expect(canvas.getByText("files-name:photo.png")).toBeInTheDocument();
  },
};
