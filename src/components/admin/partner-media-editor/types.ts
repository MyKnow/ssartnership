export type MediaRole = "thumbnail" | "gallery";

export type MediaItem = {
  id: string;
  kind: "existing" | "file";
  url: string;
  file?: File;
  /**
   * Assigned after the cropped WebP reaches private staging. Keeping this
   * separately from the preview URL prevents the binary from reaching a
   * Server Action on the eventual form submit.
   */
  uploadId?: string;
};

export type PendingCrop = {
  id: string;
  sourceUrl: string;
  sourceFile?: File;
  aspectRatio: number;
  outputName: string;
  onApply: (file: File) => void;
};
