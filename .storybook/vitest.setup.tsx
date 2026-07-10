import React from "react";
import { vi } from "vitest";

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

vi.mock("next/image", () => {
  const MockNextImage = React.forwardRef<
    HTMLImageElement,
    React.ImgHTMLAttributes<HTMLImageElement> & {
      src?: string | { src?: string };
      fill?: boolean;
      priority?: boolean;
      placeholder?: string;
      blurDataURL?: string;
      quality?: number;
      unoptimized?: boolean;
      loader?: unknown;
      overrideSrc?: string;
      onLoadingComplete?: unknown;
    }
  >(function MockNextImage(props, ref) {
    const {
      src,
      alt,
      fill,
      priority,
      placeholder,
      blurDataURL,
      quality,
      unoptimized,
      loader,
      overrideSrc,
      onLoadingComplete,
      ...rest
    } = props;

    void fill;
    void priority;
    void placeholder;
    void blurDataURL;
    void quality;
    void unoptimized;
    void loader;
    void overrideSrc;
    void onLoadingComplete;

    const resolvedSrc = typeof src === "string" ? src : src?.src ?? "";

    // eslint-disable-next-line @next/next/no-img-element
    return <img ref={ref} src={resolvedSrc} alt={alt ?? ""} {...rest} />;
  });

  MockNextImage.displayName = "MockNextImage";

  return {
    __esModule: true,
    default: MockNextImage,
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
