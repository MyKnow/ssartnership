export const IMAGE_FETCH_TIMEOUT_MS = 10_000;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export class ImageProxyError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ImageProxyError";
    this.status = status;
  }
}
