import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import manifest from "@/app/manifest";
import { SITE_THEME_COLOR_DARK, SITE_THEME_COLOR_LIGHT } from "@/lib/site";

const globalsCss = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const layoutSource = readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");

function readCssBlockToken(selector: string, token: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const block = globalsCss.match(new RegExp(`(?:^|\\n)${escaped} \\{([\\s\\S]*?)\\n\\}`))?.[1];
  assert.ok(block, `${selector} block is missing from globals.css`);
  return block.match(new RegExp(`--${token}:\\s*([^;]+);`))?.[1]?.trim().toLowerCase();
}

function readPngSize(publicPath: string) {
  const buffer = readFileSync(new URL(`../public${publicPath}`, import.meta.url));
  return `${buffer.readUInt32BE(16)}x${buffer.readUInt32BE(20)}`;
}

test("theme color constants mirror the light and dark background tokens", () => {
  assert.equal(readCssBlockToken(":root", "background"), SITE_THEME_COLOR_LIGHT);
  assert.equal(readCssBlockToken("html.dark", "background"), SITE_THEME_COLOR_DARK);
  assert.match(layoutSource, /color: SITE_THEME_COLOR_LIGHT/);
  assert.match(layoutSource, /color: SITE_THEME_COLOR_DARK/);
  assert.doesNotMatch(layoutSource, /color: "#/);
});

test("web app manifest uses shared colors, a stable id, and no orientation lock", () => {
  const value = manifest();

  assert.equal(value.id, "/");
  assert.equal(value.start_url, "/");
  assert.equal(value.scope, "/");
  assert.equal(value.display, "standalone");
  assert.equal(value.background_color, SITE_THEME_COLOR_LIGHT);
  assert.equal(value.theme_color, SITE_THEME_COLOR_LIGHT);
  assert.equal("orientation" in value, false);
  assert.deepEqual(value.categories, ["lifestyle", "shopping"]);
  assert.equal(value.lang, "ko-KR");
});

test("manifest icons exist with the sizes they declare", () => {
  const icons = manifest().icons ?? [];
  assert.ok(icons.some((icon) => icon.purpose === "maskable"));
  for (const icon of icons) {
    assert.equal(existsSync(new URL(`../public${icon.src}`, import.meta.url)), true, icon.src);
    assert.equal(readPngSize(icon.src), icon.sizes, icon.src);
  }
});

test("favicon.ico carries exactly the 16, 32, and 48 pixel frames", () => {
  const ico = readFileSync(new URL("../public/favicon.ico", import.meta.url));
  assert.equal(ico.readUInt16LE(2), 1);
  const count = ico.readUInt16LE(4);
  const sizes = Array.from({ length: count }, (_, index) => ico.readUInt8(6 + index * 16));
  assert.deepEqual(sizes, [16, 32, 48]);
  assert.ok(ico.length < 16 * 1024, `favicon.ico is ${ico.length} bytes`);
});

test("file-based app icon and its duplicate PNG stay removed", () => {
  // src/app/icon.tsx overrode the configured icon set with a placeholder glyph.
  assert.equal(existsSync(new URL("../src/app/icon.tsx", import.meta.url)), false);
  assert.equal(existsSync(new URL("../public/icon.png", import.meta.url)), false);
  assert.match(layoutSource, /url: "\/favicon\.ico", sizes: "any"/);
});
