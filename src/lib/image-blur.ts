function shimmer(width: number, height: number) {
  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g">
          <stop stop-color="#e2e8f0" offset="20%" />
          <stop stop-color="#f8fafc" offset="50%" />
          <stop stop-color="#e2e8f0" offset="70%" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="#e2e8f0" />
      <rect id="r" width="${width}" height="${height}" fill="url(#g)" />
      <animate xlink:href="#r" attributeName="x" from="-${width}" to="${width}" dur="1.2s" repeatCount="indefinite" />
    </svg>
  `;
}

function toBase64(str: string) {
  return typeof window === "undefined"
    ? Buffer.from(str).toString("base64")
    : window.btoa(str);
}

export function getBlurDataURL(width = 32, height = 32) {
  return `data:image/svg+xml;base64,${toBase64(shimmer(width, height))}`;
}
