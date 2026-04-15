export type MediaRole = "thumbnail" | "gallery";

export type MediaItem = {
  id: string;
  kind: "existing" | "file";
  url: string;
  file?: File;
};

export type PendingCrop = {
  id: string;
  sourceUrl: string;
  aspectRatio: number;
  outputName: string;
  onApply: (file: File) => void;
};
