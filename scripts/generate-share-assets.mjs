// Regenerates the committed raster share assets and favicon from vector sources:
//   node scripts/generate-share-assets.mjs
// Outputs are deterministic for a given sharp/Pretendard version. Review the
// images visually before committing; crawlers cache share cards aggressively.
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const publicDir = path.join(root, "public");
const fontDir = path.join(root, "node_modules", "pretendard", "dist", "public", "static");

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;
const BRAND_BASE = "#101B2F";

// Raster copies of SVG event heroes for crawlers that reject SVG og:image.
export const EVENT_SHARE_IMAGES = [
  { source: "ads/review-reward.svg", output: "ads/review-reward-og.png" },
  { source: "ads/reward-event.svg", output: "ads/reward-event-og.png" },
];

// Browsers pick the closest frame; three frames keep the file small.
export const FAVICON_SIZES = [16, 32, 48];

/** Packs PNG frames into an ICO container (PNG-in-ICO, supported since Vista). */
export function buildIco(frames) {
  const headerSize = 6;
  const entrySize = 16;
  const header = Buffer.alloc(headerSize + entrySize * frames.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);
  let offset = header.length;
  frames.forEach(({ size, png }, index) => {
    if (!Number.isInteger(size) || size < 1 || size > 256) {
      throw new Error(`favicon frame size ${size} is outside 1..256`);
    }
    const entry = headerSize + entrySize * index;
    header.writeUInt8(size === 256 ? 0 : size, entry);
    header.writeUInt8(size === 256 ? 0 : size, entry + 1);
    header.writeUInt8(0, entry + 2);
    header.writeUInt8(0, entry + 3);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...frames.map((frame) => frame.png)]);
}

function escapeXml(value) {
  return value.replace(/[<>&"']/g, (character) => `&#${character.charCodeAt(0)};`);
}

function extractIconBody(iconSvg) {
  const match = iconSvg.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
  if (!match) throw new Error("public/icon.svg has no <svg> body");
  return match[1];
}

function buildDefaultShareSvg(iconBody) {
  const title = escapeXml("싸트너십");
  const subtitle = escapeXml("SSAFY 구성원을 위한 제휴 혜택 플랫폼");
  const detail = escapeXml("제휴처와 혜택 정보를 한곳에서 확인하세요.");
  return `<svg width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="${BRAND_BASE}"/>
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="url(#glow)"/>
  <path d="M812 132C912 104 1018 128 1100 190C1160 236 1192 300 1200 372V630H720C664 572 640 504 650 428C664 296 712 160 812 132Z" fill="#28558B" fill-opacity="0.45"/>
  <g transform="translate(96 104) scale(0.3125)">${iconBody}</g>
  <text x="96" y="368" fill="#FFFFFF" font-family="Pretendard" font-size="96" font-weight="800" letter-spacing="-2">${title}</text>
  <text x="100" y="440" fill="#D9E8FF" font-family="Pretendard" font-size="42" font-weight="700">${subtitle}</text>
  <text x="100" y="500" fill="#B8CBE4" font-family="Pretendard" font-size="32" font-weight="500">${detail}</text>
  <text x="100" y="566" fill="#6FD3FF" font-family="Pretendard" font-size="22" font-weight="700" letter-spacing="4">SSARTNERSHIP</text>
  <defs>
    <radialGradient id="glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(198 76) rotate(30) scale(952 722)">
      <stop stop-color="#1E40AF" stop-opacity="0.45"/>
      <stop offset="0.48" stop-color="#1D4ED8" stop-opacity="0.12"/>
      <stop offset="1" stop-color="#020617" stop-opacity="0"/>
    </radialGradient>
  </defs>
</svg>`;
}

async function withPretendardFontconfig(run) {
  const configDir = await mkdtemp(path.join(tmpdir(), "ssartnership-fonts-"));
  const configPath = path.join(configDir, "fonts.conf");
  await writeFile(
    configPath,
    `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${escapeXml(fontDir)}</dir>
  <cachedir>${escapeXml(path.join(configDir, "cache"))}</cachedir>
  <alias><family>Arial</family><prefer><family>Pretendard</family></prefer></alias>
  <alias><family>sans-serif</family><prefer><family>Pretendard</family></prefer></alias>
</fontconfig>
`,
  );
  // fontconfig reads this once when libvips first renders text.
  process.env.FONTCONFIG_FILE = configPath;
  try {
    return await run();
  } finally {
    await rm(configDir, { recursive: true, force: true });
  }
}

async function renderDefaultShareImage(sharp) {
  const iconSvg = await readFile(path.join(publicDir, "icon.svg"), "utf8");
  const svg = buildDefaultShareSvg(extractIconBody(iconSvg));
  const output = path.join(publicDir, "og-default.png");
  await sharp(Buffer.from(svg))
    .flatten({ background: BRAND_BASE })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(output);
  return output;
}

export function buildEventShareSvg(heroSvg) {
  const match = heroSvg.match(/<svg[^>]*\bwidth="(\d+)"[^>]*\bheight="(\d+)"[^>]*>([\s\S]*)<\/svg>/);
  if (!match) throw new Error("event hero must be an <svg> with numeric width and height");
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (width !== OG_WIDTH || height > OG_HEIGHT) {
    throw new Error(`event hero must be ${OG_WIDTH}px wide and at most ${OG_HEIGHT}px tall`);
  }
  const top = Math.floor((OG_HEIGHT - height) / 2);
  // Letterbox instead of cropping (1.91:1 crawlers would cut the headline) and
  // stretch the full-bleed backdrop path so its gradient continues into the bands.
  const body = match[3].replaceAll(
    `d="M0 0H${width}V${height}H0V0Z"`,
    `d="M0 ${-top}H${width}V${OG_HEIGHT - top}H0V${-top}Z"`,
  );
  return `<svg width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="${BRAND_BASE}"/>
  <g transform="translate(0 ${top})">${body}</g>
</svg>`;
}

async function renderEventShareImage(sharp, { source, output }) {
  const heroSvg = await readFile(path.join(publicDir, source), "utf8");
  const target = path.join(publicDir, output);
  await sharp(Buffer.from(buildEventShareSvg(heroSvg)))
    .flatten({ background: BRAND_BASE })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(target);
  return target;
}

async function renderFavicon(sharp) {
  const iconSvg = await readFile(path.join(publicDir, "icon.svg"));
  const frames = await Promise.all(
    FAVICON_SIZES.map(async (size) => ({
      size,
      png: await sharp(iconSvg).resize(size, size).png({ compressionLevel: 9 }).toBuffer(),
    })),
  );
  const output = path.join(publicDir, "favicon.ico");
  await writeFile(output, buildIco(frames));
  return output;
}

async function main() {
  const outputs = await withPretendardFontconfig(async () => {
    const { default: sharp } = await import("sharp");
    return [
      await renderDefaultShareImage(sharp),
      ...(await Promise.all(EVENT_SHARE_IMAGES.map((entry) => renderEventShareImage(sharp, entry)))),
      await renderFavicon(sharp),
    ];
  });
  for (const output of outputs) {
    console.log(path.relative(root, output));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
