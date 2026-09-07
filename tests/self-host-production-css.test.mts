import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import postcss from "postcss";
import { optimize } from "@tailwindcss/node";
import { existsSync } from "node:fs";
import { localPromotionFixtures } from "../src/lib/mock/promotions.ts";

test("carousel fixtures require explicit local E2E mode and never become a production fallback", () => {
  const environment = { NODE_ENV: "development", NEXT_PUBLIC_DATA_SOURCE: "mock", E2E_MOCK_MUTATIONS: "1" };
  const slides = localPromotionFixtures(environment);
  assert.equal(slides.length, 1);
  assert.ok(existsSync(new URL(`../public${slides[0].imageSrc}`, import.meta.url)));
  assert.ok(!slides[0].href.startsWith("/events/"));
  for (const patch of [{ NODE_ENV: "production" }, { NEXT_PUBLIC_DATA_SOURCE: "supabase" }, { E2E_MOCK_MUTATIONS: "0" }]) {
    assert.deepEqual(localPromotionFixtures({ ...environment, ...patch }), []);
  }
  slides[0].title = "changed";
  assert.notEqual(localPromotionFixtures(environment)[0].title, "changed");
});

test("production CSS optimization preserves the standard glass filter for toast and mobile navigation", () => {
  const source = postcss.parse(readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8"));
  for (const selector of [".ui-toast-glass", ".site-mobile-nav-glass"]) {
    let css = "";
    source.walkRules(selector, (rule) => { css = rule.toString(); });
    assert.ok(css);
    const optimized = postcss.parse(optimize(css, { minify: true }).code);
    const standard: string[] = [];
    optimized.walkDecls("backdrop-filter", (declaration) => { standard.push(declaration.value); });
    assert.equal(standard.length, 1, `${selector}: standard filter must survive the real production optimizer`);
    assert.ok(standard[0].includes("blur(24px)"));
  }
});

test("every static promotion references a shipped public asset", () => {
  const catalog = readFileSync(new URL("../src/lib/promotions/catalog.ts", import.meta.url), "utf8");
  const assets = [...catalog.matchAll(/imageSrc: "(\/ads\/[^"]+)"/gu)].map((match) => match[1]);
  assert.ok(assets.length > 0);
  for (const asset of assets) assert.ok(existsSync(new URL(`../public${asset}`, import.meta.url)), "static promotion must not request a deleted public asset");
});
