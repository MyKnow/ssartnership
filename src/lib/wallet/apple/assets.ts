import { readFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const APPLE_WALLET_ICON_SOURCE_PATH = path.join(
  process.cwd(),
  "public",
  "icon-192.png",
);

const APPLE_WALLET_ICON_SIZES = [
  ["icon.png", 29],
  ["icon@2x.png", 58],
  ["icon@3x.png", 87],
] as const;

export async function createAppleWalletIconBuffers() {
  const source = await readFile(APPLE_WALLET_ICON_SOURCE_PATH);
  const entries = await Promise.all(
    APPLE_WALLET_ICON_SIZES.map(async ([fileName, size]) => {
      const buffer = await sharp(source)
        .resize(size, size, {
          fit: "contain",
          background: { r: 15, g: 23, b: 42, alpha: 1 },
        })
        .png()
        .toBuffer();

      return [fileName, buffer] as const;
    }),
  );

  return Object.fromEntries(entries);
}
