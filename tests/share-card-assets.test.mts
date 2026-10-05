import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { DEFAULT_OPEN_GRAPH_IMAGE } from "@/lib/seo";
import { listEventPageDefinitions } from "@/lib/event-pages";

const publicDir = fileURLToPath(new URL("../public/", import.meta.url));
const appDir = fileURLToPath(new URL("../src/app/", import.meta.url));

type ShareScriptModule = {
  OG_WIDTH: number;
  OG_HEIGHT: number;
  EVENT_SHARE_IMAGES: Array<{ source: string; output: string }>;
  buildEventShareSvg(heroSvg: string): string;
};

const shareScriptPromise = import(
  new URL("../scripts/generate-share-assets.mjs", import.meta.url).href
) as Promise<ShareScriptModule>;

function readPngSize(publicPath: string) {
  const buffer = readFileSync(path.join(publicDir, publicPath.replace(/^\//, "")));
  assert.equal(buffer.subarray(1, 4).toString("ascii"), "PNG", `${publicPath} is not a PNG`);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(entryPath);
    return /\.(ts|tsx)$/.test(entry.name) ? [entryPath] : [];
  });
}

test("default share card is a real 1200x630 raster matching its declared size", () => {
  assert.equal(DEFAULT_OPEN_GRAPH_IMAGE.url, "/og-default.png");
  assert.deepEqual(readPngSize(DEFAULT_OPEN_GRAPH_IMAGE.url), {
    width: DEFAULT_OPEN_GRAPH_IMAGE.width,
    height: DEFAULT_OPEN_GRAPH_IMAGE.height,
  });
  assert.deepEqual(
    [DEFAULT_OPEN_GRAPH_IMAGE.width, DEFAULT_OPEN_GRAPH_IMAGE.height],
    [1200, 630],
  );
});

test("event pages share 1200x630 rasters generated from their SVG heroes", async () => {
  const { EVENT_SHARE_IMAGES, OG_WIDTH, OG_HEIGHT } = await shareScriptPromise;
  const generated = new Map(
    EVENT_SHARE_IMAGES.map((entry) => [`/${entry.output}`, `/${entry.source}`]),
  );

  for (const definition of listEventPageDefinitions()) {
    assert.ok(definition.shareImageSrc, `${definition.slug} needs a raster share image`);
    assert.equal(generated.get(definition.shareImageSrc), definition.heroImageSrc, definition.slug);
    assert.deepEqual(readPngSize(definition.shareImageSrc), { width: OG_WIDTH, height: OG_HEIGHT });
  }
});

test("event share SVG letterboxes the hero and extends its full-bleed backdrop", async () => {
  const { buildEventShareSvg } = await shareScriptPromise;
  const svg = buildEventShareSvg(
    '<svg width="1200" height="514" viewBox="0 0 1200 514"><path d="M0 0H1200V514H0V0Z" fill="url(#g)"/><text>헤드라인</text></svg>',
  );

  assert.match(svg, /^<svg width="1200" height="630"/);
  assert.match(svg, /<g transform="translate\(0 58\)">/);
  assert.match(svg, /d="M0 -58H1200V572H0V-58Z"/);
  assert.match(svg, /<text>헤드라인<\/text>/);
  assert.throws(() => buildEventShareSvg('<svg width="800" height="400"></svg>'), /1200px wide/);
});

test("pages do not advertise the square app icon as a large share card", () => {
  const offenders = listSourceFiles(appDir)
    .filter((filePath) => !filePath.endsWith(`${path.sep}manifest.ts`))
    .filter((filePath) => {
      const source = readFileSync(filePath, "utf8");
      // Favicon entries in `icons` are fine; share images declare dimensions.
      return /images:\s*\[[^\]]*icon-512/.test(source)
        || /url:\s*(?:[\w.]+\s*\?\?\s*)?"\/icon-512\.png",\s*width:/.test(source);
    })
    .map((filePath) => path.relative(appDir, filePath));
  assert.deepEqual(offenders, []);

  const layout = readFileSync(path.join(appDir, "layout.tsx"), "utf8");
  const openGraphBlock = layout.match(/openGraph: \{([\s\S]*?)\n {2}\},/)?.[1] ?? "";
  assert.match(openGraphBlock, /images: \[DEFAULT_OPEN_GRAPH_IMAGE\]/);
  assert.doesNotMatch(openGraphBlock, /title:|description:|url:/);
  assert.match(layout, /twitter: \{\s*card: "summary_large_image",\s*\}/);
});
