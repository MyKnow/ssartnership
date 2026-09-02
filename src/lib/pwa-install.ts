export type PwaInstallPlatform = "android" | "ios" | "other";

export type PwaDisplayModeSnapshot = {
  displayModeStandalone?: boolean;
  navigatorStandalone?: boolean;
};

export type PwaNavigatorSnapshot = {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
  userAgentDataPlatform?: string;
};

function normalize(value: string | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export function detectStandalonePwa(snapshot: PwaDisplayModeSnapshot) {
  return Boolean(
    snapshot.displayModeStandalone || snapshot.navigatorStandalone,
  );
}

export function getBrowserStandalonePwa() {
  if (typeof window === "undefined") {
    return false;
  }

  return detectStandalonePwa({
    displayModeStandalone: window.matchMedia("(display-mode: standalone)").matches,
    navigatorStandalone: (
      window.navigator as Navigator & { standalone?: boolean }
    ).standalone,
  });
}

export function detectPwaInstallPlatform(
  snapshot: PwaNavigatorSnapshot,
): PwaInstallPlatform {
  const userAgent = normalize(snapshot.userAgent);
  const platform = normalize(snapshot.platform);
  const clientHintPlatform = normalize(snapshot.userAgentDataPlatform);

  if (clientHintPlatform === "android" || /android/.test(userAgent)) {
    return "android";
  }

  const hasExplicitIosPlatform =
    clientHintPlatform === "ios" ||
    /iphone|ipad|ipod/.test(userAgent) ||
    /iphone|ipad|ipod/.test(platform);
  const isDesktopModeIpad =
    platform === "macintel" && (snapshot.maxTouchPoints ?? 0) > 1;

  if (hasExplicitIosPlatform || isDesktopModeIpad) {
    return "ios";
  }

  return "other";
}

export function getBrowserPwaInstallPlatform(): PwaInstallPlatform {
  if (typeof navigator === "undefined") {
    return "other";
  }

  const navigatorWithClientHints = navigator as Navigator & {
    userAgentData?: { platform?: string };
  };

  return detectPwaInstallPlatform({
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
    userAgentDataPlatform: navigatorWithClientHints.userAgentData?.platform,
  });
}

export function buildPwaInstallGuideHref(platform: PwaInstallPlatform) {
  return `/install?platform=${platform}`;
}

export function parsePwaInstallPlatform(
  value: string | string[] | undefined,
): PwaInstallPlatform {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (candidate === "android" || candidate === "ios" || candidate === "other") {
    return candidate;
  }
  return "other";
}
