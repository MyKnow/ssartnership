import assert from "node:assert/strict";
import test from "node:test";

type CarouselHelpersModule = typeof import(
  "../src/components/partner-image-carousel/helpers.ts"
);

const carouselHelpersPromise = import(
  new URL("../src/components/partner-image-carousel/helpers.ts", import.meta.url).href,
) as Promise<CarouselHelpersModule>;

test("desktop carousel thumb placement stays on the side when the summary card is shorter", async () => {
  const { getDesktopThumbPlacement } = await carouselHelpersPromise;

  assert.equal(
    getDesktopThumbPlacement({
      containerWidth: 720,
      targetHeight: 360,
      imageCount: 5,
    }),
    "side",
  );
});

test("desktop carousel thumb placement moves below when the summary card is taller", async () => {
  const { getDesktopThumbPlacement } = await carouselHelpersPromise;

  assert.equal(
    getDesktopThumbPlacement({
      containerWidth: 720,
      targetHeight: 520,
      imageCount: 5,
    }),
    "bottom",
  );
});

test("desktop carousel thumb placement stays on the side when thumbnails are unnecessary", async () => {
  const { getDesktopThumbPlacement } = await carouselHelpersPromise;

  assert.equal(
    getDesktopThumbPlacement({
      containerWidth: 720,
      targetHeight: 520,
      imageCount: 1,
    }),
    "side",
  );
});
