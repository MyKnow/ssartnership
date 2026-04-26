import React from "react";

type NextImageSource = string | { src?: string };

type NextImageMockProps = React.ImgHTMLAttributes<HTMLImageElement> & {
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

const NextImageMock = React.forwardRef<HTMLImageElement, NextImageMockProps>(
  function NextImageMock(props, ref) {
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
  },
);

export default NextImageMock;
