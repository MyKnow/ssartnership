import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import {
  getCachedImageUrl,
  isCachedImageUrlPreloaded,
  preloadCachedImageUrl,
  preloadCachedImageUrls,
} from "./image-cache";

type ImageCacheSummary = {
  proxied: string;
  local: string;
  storage: string;
  data: string;
  alreadyPrefixed: string;
  empty: string;
  cachedRemoteBefore: boolean;
  cachedRemoteAfter: boolean;
  sharedPending: boolean;
  listStatuses: string;
};

async function buildImageCacheSummary(): Promise<ImageCacheSummary> {
  const OriginalImage = window.Image;
  class SuccessfulImage {
    decoding = "auto";
    onload: null | (() => void) = null;
    onerror: null | (() => void) = null;
    decode() {
      return Promise.resolve();
    }
    set src(_value: string) {
      queueMicrotask(() => {
        this.onload?.();
      });
    }
  }

  try {
    Object.defineProperty(window, "Image", {
      configurable: true,
      value: SuccessfulImage,
    });

    const remote = "https://example.com/image.webp";
    const local = "/local.png";
    const storage =
      "https://project.supabase.co/storage/v1/object/public/partner-media/path/file.webp";
    const data = "data:image/png;base64,abc";
    const proxied = getCachedImageUrl(remote);
    const cachedRemoteBefore = isCachedImageUrlPreloaded(remote);
    const pending = preloadCachedImageUrl(remote);
    const pendingSame = preloadCachedImageUrl(remote);
    await pending;
    const cachedRemoteAfter = isCachedImageUrlPreloaded(remote);
    const listResult = await preloadCachedImageUrls([remote, local, "", null]);

    return {
      proxied,
      local: getCachedImageUrl(local),
      storage: getCachedImageUrl(storage),
      data: getCachedImageUrl(data),
      alreadyPrefixed: getCachedImageUrl(proxied),
      empty: getCachedImageUrl(""),
      cachedRemoteBefore,
      cachedRemoteAfter,
      sharedPending: pending === pendingSame,
      listStatuses: listResult.map((item) => item.status).join(","),
    };
  } finally {
    Object.defineProperty(window, "Image", {
      configurable: true,
      value: OriginalImage,
    });
  }
}

function ImageCachePreview({ summary }: { summary: ImageCacheSummary }) {
  return (
    <div className="space-y-2 text-sm text-foreground">
      <div>proxied:{summary.proxied}</div>
      <div>local:{summary.local}</div>
      <div>storage:{summary.storage}</div>
      <div>data:{summary.data}</div>
      <div>already-prefixed:{summary.alreadyPrefixed}</div>
      <div>empty:{summary.empty}</div>
      <div>cached-before:{String(summary.cachedRemoteBefore)}</div>
      <div>cached-after:{String(summary.cachedRemoteAfter)}</div>
      <div>shared-pending:{String(summary.sharedPending)}</div>
      <div>list-statuses:{summary.listStatuses}</div>
    </div>
  );
}

const meta = {
  title: "Domains/Lib/ImageCache",
  component: ImageCachePreview,
} satisfies Meta<typeof ImageCachePreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Summary: Story = {
  args: {
    summary: {
      proxied: "",
      local: "",
      storage: "",
      data: "",
      alreadyPrefixed: "",
      empty: "",
      cachedRemoteBefore: false,
      cachedRemoteAfter: false,
      sharedPending: false,
      listStatuses: "",
    },
  },
  loaders: [async () => ({ summary: await buildImageCacheSummary() })],
  render: (_, context) => <ImageCachePreview summary={context.loaded.summary} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("proxied:/api/image?url=https%3A%2F%2Fexample.com%2Fimage.webp"),
    ).toBeInTheDocument();
    await expect(canvas.getByText("local:/local.png")).toBeInTheDocument();
    await expect(
      canvas.getByText(
        "storage:https://project.supabase.co/storage/v1/object/public/partner-media/path/file.webp",
      ),
    ).toBeInTheDocument();
    await expect(canvas.getByText("data:data:image/png;base64,abc")).toBeInTheDocument();
    await expect(
      canvas.getByText("already-prefixed:/api/image?url=https%3A%2F%2Fexample.com%2Fimage.webp"),
    ).toBeInTheDocument();
    await expect(canvas.getByText("empty:")).toBeInTheDocument();
    await expect(canvas.getByText("cached-before:false")).toBeInTheDocument();
    await expect(canvas.getByText("cached-after:true")).toBeInTheDocument();
    await expect(canvas.getByText("shared-pending:true")).toBeInTheDocument();
    await expect(canvas.getByText("list-statuses:fulfilled,fulfilled,fulfilled,fulfilled")).toBeInTheDocument();
  },
};
