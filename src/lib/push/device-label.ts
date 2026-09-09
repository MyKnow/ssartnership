function getClientHints(source: string) {
  return source.includes("client-hints=")
    ? source.slice(source.indexOf("client-hints="))
    : "";
}

export function getPushDeviceLabel(userAgent: string | null) {
  const source = userAgent ?? "";
  const clientHints = getClientHints(source);
  const browser =
    clientHints.includes("Microsoft Edge") || source.includes("Edg/")
      ? "Edge"
      : clientHints.includes("Google Chrome") ||
          clientHints.includes("Chromium") ||
          source.includes("Chrome/")
        ? "Chrome"
      : source.includes("Firefox/")
        ? "Firefox"
        : source.includes("Safari/") && !clientHints
          ? "Safari"
          : "브라우저";
  const os =
    clientHints.includes("Android") || source.includes("Android")
      ? "Android"
      : source.includes("iPhone") || source.includes("iPad") || source.includes("iOS")
        ? "iOS"
        : clientHints.includes("macOS") ||
            source.includes("Mac OS X") ||
            source.includes("macOS") ||
            source.includes("Macintosh")
          ? "macOS"
          : clientHints.includes("Windows") || source.includes("Windows")
            ? "Windows"
            : source.includes("Linux")
              ? "Linux"
              : "기기";

  return `${browser} · ${os}`;
}
