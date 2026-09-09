import React from "react";
import { afterAll, vi } from "vitest";

const nativeMatchMedia = window.matchMedia.bind(window);

vi.stubGlobal("matchMedia", (query: string) => {
  const result = nativeMatchMedia(query);
  if (!query.includes("prefers-reduced-motion")) {
    return result;
  }
  return {
    matches: true,
    media: query,
    onchange: result.onchange,
    addListener: result.addListener.bind(result),
    removeListener: result.removeListener.bind(result),
    addEventListener: result.addEventListener.bind(result),
    removeEventListener: result.removeEventListener.bind(result),
    dispatchEvent: result.dispatchEvent.bind(result),
  };
});

afterAll(() => {
  vi.unstubAllGlobals();
});

vi.mock("next/image", async (importOriginal) => {
  const imageMock = await importOriginal<typeof import("./next-image.mock")>();
  return {
    __esModule: true,
    default: imageMock.default,
    getImageProps: imageMock.getImageProps,
  };
});

vi.mock("next/script", () => {
  function MockNextScript({
    onLoad,
    onReady,
  }: {
    onLoad?: (event: Event) => void;
    onReady?: () => void;
  }) {
    React.useEffect(() => {
      onLoad?.(new Event("load"));
      onReady?.();
    }, [onLoad, onReady]);

    return null;
  }

  return {
    __esModule: true,
    default: MockNextScript,
  };
});
