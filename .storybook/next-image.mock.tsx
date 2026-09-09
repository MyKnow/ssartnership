import React from "react";

type NextImageSource = string | { src?: string };

type NextImageMockProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src?: NextImageSource;
  fill?: boolean;
  priority?: boolean;
  placeholder?: string;
  blurDataURL?: string;
  quality?: number;
  unoptimized?: boolean;
  loader?: unknown;
  overrideSrc?: string;
  onLoadingComplete?: unknown;
};

export function getImageProps(props: NextImageMockProps) {
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

  return { props: { src: resolvedSrc, alt: alt ?? "", ...rest } };
}

const NextImageMock = React.forwardRef<HTMLImageElement, NextImageMockProps>(
  function NextImageMock(props, ref) {
    // Storybook deliberately uses the same unoptimized URL for rendering and preloading.
    // eslint-disable-next-line @next/next/no-img-element
    return <img ref={ref} {...getImageProps(props).props} alt={props.alt ?? ""} />;
  },
);

export default NextImageMock;
